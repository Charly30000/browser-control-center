import { html, type TemplateResult } from "lit";
import type { AutomationNode } from "../../../../domain/automations/automation";
import type { NodeExecutionState } from "../../../../domain/automations/executionState";
import type { NodeDescriptor } from "../../../../application/automations/nodeRegistry";

const icons: Record<NodeExecutionState, string> = { idle: "○", queued: "◷", running: "▶", success: "✓", failed: "!", skipped: "–", "waiting-user": "?", cancelled: "×" };

export interface NodeLayerCallbacks {
  readonly onNodePointerDown: (event: PointerEvent, nodeId: string) => void;
  readonly onOutputPointerDown: (event: PointerEvent, nodeId: string) => void;
  readonly onRemovePointerDown: (event: PointerEvent, nodeId: string) => void;
}

export const renderNodeLayer = (nodes: readonly AutomationNode[], selected: ReadonlySet<string>, descriptors: readonly NodeDescriptor[], states: Readonly<Record<string, NodeExecutionState>>, connection: { readonly sourceNodeId: string | null; readonly targetNodeId: string | null }, callbacks: NodeLayerCallbacks): TemplateResult => html`
  <div class="node-layer">
    ${nodes.map((node) => {
      const descriptor = descriptors.find(({ type }) => type === node.type); const state = states[node.id] ?? "idle";
      const source = connection.sourceNodeId === node.id; const target = connection.targetNodeId === node.id;
      return html`<article class=${`flow-node ${selected.has(node.id) ? "selected" : ""} ${source ? "connection-source" : ""} ${target ? "connection-target" : ""} state-${state}`} style=${`transform:translate(${node.position.x}px,${node.position.y}px)`} data-node-id=${node.id} @pointerdown=${(event: PointerEvent) => callbacks.onNodePointerDown(event, node.id)}>
        <button class=${`port input-port ${target ? "connection-target" : ""}`} title="Entrada"></button>
        ${selected.has(node.id) ? html`<button class="node-remove" title="Eliminar nodo" aria-label="Eliminar nodo" @pointerdown=${(event: PointerEvent) => callbacks.onRemovePointerDown(event, node.id)}>×</button>` : null}
        <header><span class="node-state" aria-label=${state}>${icons[state]}</span><strong>${descriptor?.title ?? node.type}</strong></header>
        <small>${descriptor?.category ?? "Nodo"}</small>
        <button class=${`port output-port ${source ? "connection-source" : ""}`} title="Arrastra para conectar" @pointerdown=${(event: PointerEvent) => callbacks.onOutputPointerDown(event, node.id)}></button>
      </article>`;
    })}
  </div>`;
