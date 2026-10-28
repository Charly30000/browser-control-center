import { LitElement, html } from "lit";
import type { NodeDescriptor } from "../../../../application/automations/nodeRegistry";
import type { AutomationEdge, AutomationNode, Point } from "../../../../domain/automations/automation";
import type { NodeExecutionState } from "../../../../domain/automations/executionState";
import { ClipboardManager } from "./ClipboardManager";
import { ConnectionManager } from "./ConnectionManager";
import { renderEdgeLayer } from "./EdgeLayer";
import { HistoryManager } from "./HistoryManager";
import { renderNodeLayer } from "./NodeLayer";
import { SelectionManager } from "./SelectionManager";
import { NODE_HEIGHT, NODE_WIDTH, normalizeRect, screenToWorld, worldToScreen, type CanvasViewport } from "./geometry";
import { ViewportManager } from "./ViewportManager";

interface GraphSnapshot { readonly nodes: readonly AutomationNode[]; readonly edges: readonly AutomationEdge[]; }
type Interaction = "move" | "selection" | "pan" | "connection" | null;

export class FlowCanvas extends LitElement {
  private _nodes: readonly AutomationNode[] = [];
  private _edges: readonly AutomationEdge[] = [];
  private _descriptors: readonly NodeDescriptor[] = [];
  private _states: Readonly<Record<string, NodeExecutionState>> = {};
  private readonly selection = new SelectionManager();
  private readonly clipboard = new ClipboardManager();
  private readonly connections = new ConnectionManager();
  private readonly viewportManager = new ViewportManager();
  private readonly history = new HistoryManager<GraphSnapshot>((value) => structuredClone(value));
  private viewport: CanvasViewport = this.viewportManager.snapshot();
  private interaction: Interaction = null;
  private startWorld: Point = { x: 0, y: 0 };
  private lastScreen: Point = { x: 0, y: 0 };
  private selectionEnd: Point | null = null;
  private selectedEdgeId: string | null = null;
  private selectionBase = new Set<string>();
  private originalPositions = new Map<string, Point>();
  private spacePressed = false;
  private endPointerSession: (() => void) | null = null;

  public set nodes(value: readonly AutomationNode[]) { this._nodes = value; this.requestUpdate(); }
  public get nodes(): readonly AutomationNode[] { return this._nodes; }
  public set edges(value: readonly AutomationEdge[]) { this._edges = value; this.requestUpdate(); }
  public get edges(): readonly AutomationEdge[] { return this._edges; }
  public set descriptors(value: readonly NodeDescriptor[]) { this._descriptors = value; this.requestUpdate(); }
  public set states(value: Readonly<Record<string, NodeExecutionState>>) { this._states = value; this.requestUpdate(); }
  public override createRenderRoot(): this { return this; }
  public override disconnectedCallback(): void { this.endPointerSession?.(); super.disconnectedCallback(); }

  protected override render() {
    const selected = this.selection.ids();
    const pending = this.connections.snapshot();
    const selectionRect = this.selectionEnd === null
      ? null
      : normalizeRect(worldToScreen(this.startWorld, this.viewport), worldToScreen(this.selectionEnd, this.viewport));
    return html`<div class="flow-canvas" tabindex="0" role="application" aria-label="Editor visual de automatización" @keydown=${this.onKeyDown} @keyup=${this.onKeyUp} @wheel=${this.onWheel} @pointerdown=${this.onCanvasPointerDown}>
      <div class="canvas-grid" style=${`transform:translate(${this.viewport.pan.x}px,${this.viewport.pan.y}px) scale(${this.viewport.zoom})`}>
        ${renderEdgeLayer(this._nodes, this._edges, pending, this.selectedEdgeId, { onSelect: this.onEdgePointerDown, onRemove: this.onEdgeRemovePointerDown, onKeyDown: this.onEdgeKeyDown })}
        ${renderNodeLayer(
          this._nodes,
          selected,
          this._descriptors,
          this._states,
          { sourceNodeId: pending?.sourceNodeId ?? null, targetNodeId: pending?.targetNodeId ?? null },
          { onNodePointerDown: this.onNodePointerDown, onNodeKeyDown: this.onNodeKeyDown, onOutputPointerDown: this.onOutputPointerDown, onOutputKeyDown: this.onOutputKeyDown, onInputKeyDown: this.onInputKeyDown, onRemovePointerDown: this.onNodeRemovePointerDown },
        )}
      </div>
      ${selectionRect === null ? null : html`<div class="selection-rectangle" style=${`left:${selectionRect.x}px;top:${selectionRect.y}px;width:${selectionRect.width}px;height:${selectionRect.height}px`}></div>`}
      <div class="canvas-help">Arrastra una card para moverla · Arrastra desde su salida para conectarla · Arrastra el fondo para seleccionar varias</div>
      ${selected.size === 0 ? null : html`<div class="selection-count">${selected.size} ${selected.size === 1 ? "nodo seleccionado" : "nodos seleccionados"}</div>`}
      <div class="canvas-controls"><button title="Deshacer" aria-label="Deshacer" @click=${this.undo}>↶</button><button title="Rehacer" aria-label="Rehacer" @click=${this.redo}>↷</button><button title="Alejar" aria-label="Alejar" @click=${() => this.zoomBy(1 / 1.2)}>−</button><button title="Restablecer zoom" aria-label="Restablecer zoom" @click=${this.resetViewport}>100%</button><button title="Acercar" aria-label="Acercar" @click=${() => this.zoomBy(1.2)}>+</button><span aria-live="polite">${Math.round(this.viewport.zoom * 100)}%</span></div>
    </div>`;
  }

  private readonly onCanvasPointerDown = (event: PointerEvent): void => {
    const target = event.target;
    if (target instanceof Element && (target.closest(".flow-node") !== null || target.closest(".canvas-controls") !== null)) return;
    const screen = this.localPoint(event); this.lastScreen = screen;
    if (event.button === 1 || this.spacePressed) { this.beginPointerSession(event, true); this.interaction = "pan"; event.preventDefault(); return; }
    if (event.button !== 0) return;
    this.selectedEdgeId = null;
    this.beginPointerSession(event, true);
    this.interaction = "selection"; this.startWorld = screenToWorld(screen, this.viewport); this.selectionEnd = this.startWorld;
    this.selectionBase = event.ctrlKey || event.metaKey || event.shiftKey ? new Set(this.selection.ids()) : new Set();
    if (this.selectionBase.size === 0) this.selection.replace([]);
    event.preventDefault(); this.requestUpdate();
  };

  private readonly onNodePointerDown = (event: PointerEvent, nodeId: string): void => {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest(".port") !== null)) return;
    event.preventDefault(); event.stopPropagation(); this.beginPointerSession(event, true);
    this.selectedEdgeId = null;
    const additive = event.ctrlKey || event.metaKey || event.shiftKey;
    if (!this.selection.ids().has(nodeId) || additive) this.selection.select(nodeId, additive);
    this.pushHistory(); this.interaction = "move"; this.startWorld = screenToWorld(this.localPoint(event), this.viewport);
    this.originalPositions = new Map(this._nodes.filter(({ id }) => this.selection.ids().has(id)).map((node) => [node.id, { ...node.position }]));
    this.requestUpdate();
  };

  private readonly onOutputPointerDown = (event: PointerEvent, nodeId: string): void => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); this.selectedEdgeId = null; this.beginPointerSession(event, true); this.interaction = "connection";
    const source = this._nodes.find(({ id }) => id === nodeId);
    const point = source === undefined ? screenToWorld(this.localPoint(event), this.viewport) : this.outputPort(source);
    this.connections.start(nodeId, point); this.requestUpdate();
  };

  private readonly onNodeKeyDown = (event: KeyboardEvent, nodeId: string): void => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      this.selection.select(nodeId, event.ctrlKey || event.metaKey || event.shiftKey);
      this.selectedEdgeId = null;
      this.emitSelection();
      this.requestUpdate();
      event.preventDefault();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      this.removeNodes(new Set([nodeId]));
      event.preventDefault();
      return;
    }
    const directions: Readonly<Record<string, Point>> = {
      ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }
    };
    const direction = directions[event.key];
    if (direction === undefined) return;
    const step = event.shiftKey ? 10 : 1;
    this.pushHistory();
    this._nodes = this._nodes.map((node) => node.id === nodeId
      ? { ...node, position: { x: node.position.x + direction.x * step, y: node.position.y + direction.y * step } }
      : node);
    this.emitGraph();
    event.preventDefault();
  };

  private readonly onOutputKeyDown = (event: KeyboardEvent, nodeId: string): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const source = this._nodes.find(({ id }) => id === nodeId);
    if (source === undefined) return;
    this.connections.start(nodeId, this.outputPort(source));
    this.selectedEdgeId = null;
    this.requestUpdate();
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly onInputKeyDown = (event: KeyboardEvent, nodeId: string): void => {
    if ((event.key !== "Enter" && event.key !== " ") || this.connections.snapshot() === null) return;
    const changed = this.finishConnection(nodeId);
    if (this.connections.snapshot() !== null) this.connections.cancel();
    if (changed) this.emitGraph(); else this.requestUpdate();
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly onNodeRemovePointerDown = (event: PointerEvent, nodeId: string): void => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); this.removeNodes(new Set([nodeId]));
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const screen = this.localPoint(event); const world = screenToWorld(screen, this.viewport);
    if (this.interaction === "connection") {
      const targetNodeId = this.connectionTargetAt(world); const target = this._nodes.find(({ id }) => id === targetNodeId);
      this.connections.update(target === undefined ? world : this.inputPort(target), targetNodeId); this.requestUpdate(); return;
    }
    if (this.interaction === "pan") { this.viewport = this.viewportManager.pan({ x: screen.x - this.lastScreen.x, y: screen.y - this.lastScreen.y }); this.lastScreen = screen; this.requestUpdate(); }
    else if (this.interaction === "selection") {
      this.selectionEnd = world; this.selection.replace(this.selectionBase); this.selection.rectangle(this._nodes, this.startWorld, world, true); this.requestUpdate();
    } else if (this.interaction === "move") {
      const delta = { x: world.x - this.startWorld.x, y: world.y - this.startWorld.y };
      this._nodes = this._nodes.map((node) => { const origin = this.originalPositions.get(node.id); return origin === undefined ? node : { ...node, position: { x: origin.x + delta.x, y: origin.y + delta.y } }; });
      this.paintNodePositions(); this.requestUpdate();
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    const completedInteraction = this.interaction;
    let graphChanged = false;
    if (completedInteraction === "connection") graphChanged = this.finishConnection(this.connectionTargetAt(screenToWorld(this.localPoint(event), this.viewport)));
    this.endPointerSession?.(); this.interaction = null; this.selectionEnd = null;
    if (this.connections.snapshot() !== null) this.connections.cancel();
    if (completedInteraction === "move" || graphChanged) this.emitGraph(); else this.requestUpdate();
    if (completedInteraction === "move" || completedInteraction === "selection") this.emitSelection();
  };

  private readonly onPointerCancel = (): void => {
    if (this.interaction === "move") {
      this._nodes = this._nodes.map((node) => { const origin = this.originalPositions.get(node.id); return origin === undefined ? node : { ...node, position: origin }; });
      this.paintNodePositions();
    }
    this.endPointerSession?.(); this.interaction = null; this.selectionEnd = null; this.connections.cancel(); this.requestUpdate();
  };

  private finishConnection(targetNodeId: string | null): boolean {
    const edge = this.connections.finish(targetNodeId); if (edge === null) return false;
    if (this._edges.some((item) => item.sourceNodeId === edge.sourceNodeId && item.targetNodeId === edge.targetNodeId)) return false;
    this.pushHistory(); this._edges = [...this._edges, edge]; this.selectedEdgeId = edge.id; return true;
  }

  private readonly onEdgePointerDown = (event: PointerEvent, edgeId: string): void => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); this.selectedEdgeId = edgeId; this.selection.replace([]); this.emitSelection(); this.requestUpdate();
  };

  private readonly onEdgeRemovePointerDown = (event: PointerEvent, edgeId: string): void => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); this.removeEdge(edgeId);
  };

  private readonly onEdgeKeyDown = (event: KeyboardEvent, edgeId: string): void => {
    if (event.key === "Enter" || event.key === " ") {
      this.selectedEdgeId = edgeId;
      this.selection.replace([]);
      this.emitSelection();
      this.requestUpdate();
      event.preventDefault();
    } else if (event.key === "Delete" || event.key === "Backspace") {
      this.removeEdge(edgeId);
      event.preventDefault();
    }
  };

  private removeEdge(edgeId: string): void {
    if (!this._edges.some(({ id }) => id === edgeId)) return;
    this.pushHistory(); this._edges = this._edges.filter(({ id }) => id !== edgeId); this.selectedEdgeId = null; this.emitGraph();
  }

  private connectionTargetAt(point: Point): string | null {
    const pending = this.connections.snapshot(); if (pending === null) return null;
    const tolerance = 28 / this.viewport.zoom;
    let result: { readonly id: string; readonly distance: number } | null = null;
    for (const node of this._nodes) {
      if (!this.canConnect(pending.sourceNodeId, node.id)) continue;
      const input = this.inputPort(node); const distance = Math.hypot(point.x - input.x, point.y - input.y);
      const inside = point.x >= node.position.x && point.x <= node.position.x + NODE_WIDTH && point.y >= node.position.y && point.y <= node.position.y + NODE_HEIGHT;
      if (!inside && distance > tolerance) continue;
      if (result === null || distance < result.distance) result = { id: node.id, distance };
    }
    return result?.id ?? null;
  }

  private canConnect(sourceNodeId: string, targetNodeId: string): boolean {
    if (sourceNodeId === targetNodeId || this._edges.some((edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId)) return false;
    const outgoing = new Map<string, string[]>();
    for (const edge of this._edges) outgoing.set(edge.sourceNodeId, [...(outgoing.get(edge.sourceNodeId) ?? []), edge.targetNodeId]);
    const pending = [targetNodeId]; const visited = new Set<string>();
    while (pending.length > 0) {
      const current = pending.pop(); if (current === undefined || visited.has(current)) continue;
      if (current === sourceNodeId) return false;
      visited.add(current); pending.push(...(outgoing.get(current) ?? []));
    }
    return true;
  }

  private inputPort(node: AutomationNode): Point { return { x: node.position.x, y: node.position.y + NODE_HEIGHT / 2 }; }
  private outputPort(node: AutomationNode): Point { return { x: node.position.x + NODE_WIDTH, y: node.position.y + NODE_HEIGHT / 2 }; }
  private readonly onWheel = (event: WheelEvent): void => { event.preventDefault(); this.viewport = this.viewportManager.zoomAt(this.localPoint(event), event.deltaY < 0 ? 1.1 : 0.9); this.requestUpdate(); };
  private zoomBy(factor: number): void { const canvas = this.canvasElement(); if (canvas === null) return; this.viewport = this.viewportManager.zoomAt({ x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }, factor); this.requestUpdate(); }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Space") { this.spacePressed = true; event.preventDefault(); }
    const modifier = event.ctrlKey || event.metaKey;
    if (modifier && event.key.toLowerCase() === "c") { this.clipboard.copy(this._nodes, this._edges, this.selection.ids()); event.preventDefault(); }
    else if (modifier && event.key.toLowerCase() === "v") { this.paste(); event.preventDefault(); }
    else if (modifier && event.key.toLowerCase() === "d") { this.clipboard.copy(this._nodes, this._edges, this.selection.ids()); this.paste(); event.preventDefault(); }
    else if (modifier && event.key.toLowerCase() === "z" && !event.shiftKey) { this.undo(); event.preventDefault(); }
    else if ((modifier && event.key.toLowerCase() === "y") || (modifier && event.shiftKey && event.key.toLowerCase() === "z")) { this.redo(); event.preventDefault(); }
    else if (event.key === "Delete" || event.key === "Backspace") { this.deleteSelection(); event.preventDefault(); }
  };
  private readonly onKeyUp = (event: KeyboardEvent): void => { if (event.code === "Space") this.spacePressed = false; };

  private paste(): void { const result = this.clipboard.paste(); if (result === null) return; this.pushHistory(); this._nodes = [...this._nodes, ...result.nodes]; this._edges = [...this._edges, ...result.edges]; this.selection.replace(result.selectedIds); this.emitGraph(); this.emitSelection(); }
  private deleteSelection(): void {
    if (this.selectedEdgeId !== null) { this.removeEdge(this.selectedEdgeId); return; }
    const ids = this.selection.ids();
    if (ids.size > 0) this.removeNodes(ids);
  }

  private removeNodes(ids: ReadonlySet<string>): void {
    if (!this._nodes.some(({ id }) => ids.has(id))) return;
    this.pushHistory();
    this._nodes = this._nodes.filter(({ id }) => !ids.has(id));
    this._edges = this._edges.filter((edge) => !ids.has(edge.sourceNodeId) && !ids.has(edge.targetNodeId));
    this.selection.replace([...this.selection.ids()].filter((id) => !ids.has(id)));
    if (!this._edges.some(({ id }) => id === this.selectedEdgeId)) this.selectedEdgeId = null;
    this.emitGraph(); this.emitSelection();
  }
  private readonly undo = (): void => { const value = this.history.undo(this.snapshot()); if (value !== null) this.restore(value); };
  private readonly redo = (): void => { const value = this.history.redo(this.snapshot()); if (value !== null) this.restore(value); };
  private readonly resetViewport = (): void => { this.viewport = this.viewportManager.reset(); this.requestUpdate(); };
  private pushHistory(): void { this.history.push(this.snapshot()); }
  private snapshot(): GraphSnapshot { return { nodes: this._nodes, edges: this._edges }; }
  private restore(value: GraphSnapshot): void { this._nodes = value.nodes; this._edges = value.edges; if (!this._edges.some(({ id }) => id === this.selectedEdgeId)) this.selectedEdgeId = null; this.selection.replace([...this.selection.ids()].filter((id) => this._nodes.some((node) => node.id === id))); this.emitGraph(); this.emitSelection(); }
  private localPoint(event: MouseEvent | PointerEvent | WheelEvent): Point { const rect = this.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }

  private beginPointerSession(event: PointerEvent, capture: boolean): void {
    this.endPointerSession?.(); this.canvasElement()?.focus({ preventScroll: true }); const pointerId = event.pointerId;
    const captureTarget = capture ? this.canvasElement() : null;
    if (capture && captureTarget?.setPointerCapture !== undefined) captureTarget.setPointerCapture(pointerId);
    const move = (next: PointerEvent): void => { if (next.pointerId === pointerId) this.onPointerMove(next); };
    const finish = (next: PointerEvent): void => { if (next.pointerId === pointerId) this.onPointerUp(next); };
    const cancel = (next: PointerEvent): void => { if (next.pointerId === pointerId) this.onPointerCancel(); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", cancel);
    this.endPointerSession = (): void => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", cancel);
      if (captureTarget?.hasPointerCapture(pointerId) === true) captureTarget.releasePointerCapture(pointerId);
      this.endPointerSession = null;
    };
  }

  private paintNodePositions(): void { for (const node of this._nodes) { const element = this.querySelector<HTMLElement>(`.flow-node[data-node-id="${CSS.escape(node.id)}"]`); if (element !== null) element.style.transform = `translate(${node.position.x}px,${node.position.y}px)`; } }
  private canvasElement(): HTMLElement | null { return this.querySelector<HTMLElement>(".flow-canvas"); }
  private emitGraph(): void { this.dispatchEvent(new CustomEvent("flow-change", { detail: { nodes: structuredClone(this._nodes), edges: structuredClone(this._edges) }, bubbles: true, composed: true })); this.requestUpdate(); }
  private emitSelection(): void { this.dispatchEvent(new CustomEvent("selection-change", { detail: { ids: [...this.selection.ids()] }, bubbles: true, composed: true })); }
}

customElements.define("flow-canvas", FlowCanvas);
