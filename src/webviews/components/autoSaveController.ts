import type { ReactiveController, ReactiveControllerHost } from "lit";

interface AutoSaveOptions {
  enabled(): boolean;
  canSave(): boolean;
  dirty(): boolean;
  save(): void;
}

const activityEvents = ["input", "change", "click", "keydown", "pointerdown", "dragstart", "dragend", "drop"] as const;
const interactiveElements = 'input, textarea, select, button, a[href], summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="switch"], [role="application"], [draggable="true"]';

/** Comparte la espera por inactividad, sin ejecutar acciones de navegador ni de prueba. */
export class AutoSaveController implements ReactiveController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastActivity = 0;
  private dragging = false;
  private activePointerId: number | null = null;

  public constructor(private readonly host: ReactiveControllerHost & HTMLElement, private readonly options: AutoSaveOptions) {
    host.addController(this);
  }

  public hostConnected(): void {
    for (const type of activityEvents) this.host.addEventListener(type, this.activity, { capture: true, passive: true });
  }

  public hostDisconnected(): void {
    for (const type of activityEvents) this.host.removeEventListener(type, this.activity, true);
    this.cancel();
    this.releasePointer();
  }

  public readonly activity = (event?: Event): void => {
    const endingDrag = this.dragging && (event?.type === "drop" || event?.type === "dragend");
    if (event !== undefined && !endingDrag && !event.composedPath().some((target) => target instanceof Element && target.matches(interactiveElements))) return;
    if (event instanceof PointerEvent && event.type === "pointerdown") {
      this.activePointerId = event.pointerId;
      window.addEventListener("pointerup", this.finishPointer, true);
      window.addEventListener("pointercancel", this.finishPointer, true);
      window.addEventListener("blur", this.finishPointerOnBlur);
    }
    if (event?.type === "dragstart") this.dragging = true;
    else if (event?.type === "dragend" || event?.type === "drop") this.dragging = false;
    this.lastActivity = Date.now();
    this.schedule();
  };

  private readonly finishPointer = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    this.releasePointer();
    this.activity();
  };

  private readonly finishPointerOnBlur = (): void => {
    this.releasePointer();
    this.dragging = false;
    this.activity();
  };

  private releasePointer(): void {
    this.activePointerId = null;
    window.removeEventListener("pointerup", this.finishPointer, true);
    window.removeEventListener("pointercancel", this.finishPointer, true);
    window.removeEventListener("blur", this.finishPointerOnBlur);
  }

  public cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  public schedule(): void {
    this.cancel();
    if (!this.host.isConnected || !this.options.enabled() || !this.options.canSave() || !this.options.dirty() || this.dragging || this.activePointerId !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.options.enabled() && this.options.canSave() && this.options.dirty()) this.options.save();
    }, Math.max(0, 5_000 - (Date.now() - this.lastActivity)));
  }
}
