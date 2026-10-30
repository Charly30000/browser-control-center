import { html, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import type { EntryDropPosition } from "../../domain/manual/reorderEntries";
import "./rowReorder.css";

export interface RowReorderOptions {
  readonly controller: RowReorderController;
  readonly group: string;
  readonly move: (sourceId: string, targetId: string, position: EntryDropPosition) => void;
}

export interface RowDropZoneOptions {
  readonly controller: RowReorderController;
  readonly group: string;
  readonly drop: (sourceId: string) => void;
}

interface DropTarget {
  readonly element: HTMLElement;
  readonly marker: string;
  readonly drop: () => void;
}

export class RowReorderController {
  private readonly rows = new WeakMap<HTMLElement, { options: RowReorderOptions; id: string }>();
  private readonly zones = new WeakMap<HTMLElement, RowDropZoneOptions>();
  private active: { group: string; id: string; row: HTMLElement; handle: HTMLElement; pointerId: number; startX: number; startY: number } | null = null;
  private point = { x: 0, y: 0 };
  private dragging = false;
  private marker: HTMLElement | null = null;
  private preview: HTMLElement | null = null;

  public start(event: PointerEvent, group: string, id: string): void {
    if (event.button !== 0 || !event.isPrimary || !(event.currentTarget instanceof HTMLElement)) return;
    const handle = event.currentTarget;
    const row = handle.closest<HTMLElement>("[data-reorder-row]");
    if (row === null) return;
    event.preventDefault();
    event.stopPropagation();
    this.cancel();
    handle.focus({ preventScroll: true });
    this.active = { group, id, row, handle, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    this.point = { x: event.clientX, y: event.clientY };
    handle.setPointerCapture(event.pointerId);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerCancel);
    window.addEventListener("scroll", this.onScroll, true);
    window.addEventListener("keydown", this.onKeyDown, true);
    window.addEventListener("blur", this.onBlur);
  }

  public cancel(): void {
    const active = this.active;
    this.active = null;
    active?.row.classList.remove("row-is-dragging");
    if (active?.handle.hasPointerCapture(active.pointerId)) active.handle.releasePointerCapture(active.pointerId);
    this.dragging = false;
    this.preview?.remove();
    this.preview = null;
    document.body.classList.remove("row-drag-active");
    this.clearMarker();
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerCancel);
    window.removeEventListener("scroll", this.onScroll, true);
    window.removeEventListener("keydown", this.onKeyDown, true);
    window.removeEventListener("blur", this.onBlur);
  }

  public bindRow(row: HTMLElement, options: RowReorderOptions, id: string): () => void {
    row.dataset.reorderRow = id;
    row.dataset.reorderGroup = options.group;
    this.rows.set(row, { options, id });
    return () => {
      this.rows.delete(row);
      delete row.dataset.reorderRow;
      delete row.dataset.reorderGroup;
    };
  }

  public bindDropZone(element: HTMLElement, options: RowDropZoneOptions): () => void {
    this.zones.set(element, options);
    return () => { this.zones.delete(element); };
  }

  public keyboard(event: KeyboardEvent, options: RowReorderOptions, id: string): void {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown") || !(event.currentTarget instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();
    const container = event.currentTarget.closest<HTMLElement>("[data-reorder-row]")?.parentElement;
    if (container === null || container === undefined) return;
    const rows = [...container.children].filter((element): element is HTMLElement => element instanceof HTMLElement && element.dataset.reorderGroup === options.group);
    const index = rows.findIndex((element) => element.dataset.reorderRow === id);
    const target = rows[index + (event.key === "ArrowUp" ? -1 : 1)];
    if (index < 0 || target?.dataset.reorderRow === undefined) return;
    options.move(id, target.dataset.reorderRow, event.key === "ArrowUp" ? "before" : "after");
    queueMicrotask(() => [...container.children].find((element) => element instanceof HTMLElement && element.dataset.reorderRow === id)?.querySelector<HTMLButtonElement>(".row-drag-handle")?.focus());
  }

  private beginDrag(): void {
    if (this.active === null || this.dragging) return;
    this.dragging = true;
    this.active.row.classList.add("row-is-dragging");
    document.body.classList.add("row-drag-active");
    this.preview = document.createElement("div");
    this.preview.className = "row-drag-preview";
    this.preview.setAttribute("aria-hidden", "true");
    this.preview.textContent = this.active.handle.getAttribute("aria-label") ?? "Mover elemento";
    document.body.append(this.preview);
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.active?.pointerId) return;
    if (!this.active.row.isConnected) { this.cancel(); return; }
    this.point = { x: event.clientX, y: event.clientY };
    if (Math.hypot(event.clientX - this.active.startX, event.clientY - this.active.startY) >= 5) this.beginDrag();
    if (this.dragging) this.updateTarget();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.active?.pointerId) return;
    this.point = { x: event.clientX, y: event.clientY };
    const target = this.dragging ? this.targetAtPoint() : null;
    this.cancel();
    target?.drop();
  };

  private readonly onPointerCancel = (event: PointerEvent): void => { if (event.pointerId === this.active?.pointerId) this.cancel(); };
  private readonly onBlur = (): void => { this.cancel(); };
  private readonly onKeyDown = (event: KeyboardEvent): void => { if (event.key === "Escape") { event.preventDefault(); this.cancel(); } };
  private readonly onScroll = (): void => {
    if (this.active === null) return;
    this.beginDrag();
    this.updateTarget();
  };

  private targetAtPoint(): DropTarget | null {
    const active = this.active;
    if (active === null || !active.row.isConnected) return null;
    let element = document.elementFromPoint(this.point.x, this.point.y);
    while (element !== null) {
      if (element instanceof HTMLElement) {
        const row = this.rows.get(element);
        if (row?.options.group === active.group) {
          if (row.id === active.id) return null;
          const rect = element.getBoundingClientRect();
          const position = this.point.y < rect.top + rect.height / 2 ? "before" : "after";
          return { element, marker: "row-drop-" + position, drop: () => row.options.move(active.id, row.id, position) };
        }
        const zone = this.zones.get(element);
        if (zone?.group === active.group) return { element, marker: "row-drop-inside", drop: () => zone.drop(active.id) };
      }
      element = element.parentElement;
    }
    return null;
  }

  private updateTarget(): void {
    if (this.preview !== null) {
      this.preview.style.left = (this.point.x + 12) + "px";
      this.preview.style.top = (this.point.y + 12) + "px";
    }
    this.clearMarker();
    const target = this.targetAtPoint();
    if (target !== null) { this.marker = target.element; this.marker.classList.add(target.marker); }
  }

  private clearMarker(): void { this.marker?.classList.remove("row-drop-before", "row-drop-after", "row-drop-inside"); this.marker = null; }
}

export const reorderableRow = (options: RowReorderOptions | undefined, id: string) => {
  let detach: (() => void) | undefined;
  return ref((element?: Element) => {
    detach?.();
    detach = options !== undefined && element instanceof HTMLElement ? options.controller.bindRow(element, options, id) : undefined;
  });
};

export const rowDropZone = (options: RowDropZoneOptions) => {
  let detach: (() => void) | undefined;
  return ref((element?: Element) => {
    detach?.();
    detach = element instanceof HTMLElement ? options.controller.bindDropZone(element, options) : undefined;
  });
};

export const renderRowDragHandle = (options: RowReorderOptions | undefined, id: string, label: string) => options === undefined ? nothing : html`
  <button type="button" class="row-drag-handle" draggable="false" aria-label=${`Mover ${label}`} title="Arrastra para cambiar el orden · Usa la rueda para desplazarte · Alt+↑ / Alt+↓"
    @click=${(event: Event) => { event.preventDefault(); event.stopPropagation(); }}
    @pointerdown=${(event: PointerEvent) => options.controller.start(event, options.group, id)}
    @keydown=${(event: KeyboardEvent) => options.controller.keyboard(event, options, id)}>
    <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true"><circle cx="5" cy="4" r="1.3"/><circle cx="11" cy="4" r="1.3"/><circle cx="5" cy="9" r="1.3"/><circle cx="11" cy="9" r="1.3"/><circle cx="5" cy="14" r="1.3"/><circle cx="11" cy="14" r="1.3"/></svg>
  </button>`;
