import { t } from "../../../../localization";
import { svg, type TemplateResult } from "lit";
import type { AutomationEdge, AutomationNode, Point } from "../../../../domain/automations/automation";
import { edgePath, NODE_HEIGHT, NODE_WIDTH } from "./geometry";

interface EdgeLayerCallbacks {
  readonly onSelect: (event: PointerEvent, edgeId: string) => void;
  readonly onRemove: (event: PointerEvent, edgeId: string) => void;
  readonly onKeyDown: (event: KeyboardEvent, edgeId: string) => void;
}

export const renderEdgeLayer = (
  nodes: readonly AutomationNode[],
  edges: readonly AutomationEdge[],
  pending: { readonly sourceNodeId: string; readonly point: Point; readonly targetNodeId: string | null } | null,
  selectedEdgeId: string | null,
  callbacks: EdgeLayerCallbacks,
): TemplateResult => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const port = (node: AutomationNode, output: boolean): Point => ({ x: node.position.x + (output ? NODE_WIDTH : 0), y: node.position.y + NODE_HEIGHT / 2 });
  return svg`<svg class="edge-layer" role="group" aria-label=${t("labels.connections")}><defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z"></path></marker></defs>
    ${edges.map((edge) => {
      const source = byId.get(edge.sourceNodeId); const target = byId.get(edge.targetNodeId);
      if (source === undefined || target === undefined) return null;
      const start = port(source, true); const end = port(target, false); const path = edgePath(start, end); const selected = edge.id === selectedEdgeId;
      const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      return svg`<g class=${selected ? "edge-group selected" : "edge-group"} data-edge-id=${edge.id} tabindex="0" role="button" aria-label=${t("text.connectionFromArg0ToArg1", { arg0: source.type, arg1: target.type })} @keydown=${(event: KeyboardEvent) => callbacks.onKeyDown(event, edge.id)}>
        <path class="edge-hit-area" d=${path} @pointerdown=${(event: PointerEvent) => callbacks.onSelect(event, edge.id)}></path>
        <path class=${selected ? "flow-edge selected" : "flow-edge"} d=${path}></path>
        ${selected ? svg`<g class="edge-remove" transform=${`translate(${midpoint.x} ${midpoint.y})`} role="button" aria-label=${t("labels.deleteConnection")} @pointerdown=${(event: PointerEvent) => callbacks.onRemove(event, edge.id)}><circle r="10"></circle><text x="0" y="1">×</text></g>` : null}
      </g>`;
    })}
    ${pending === null ? null : (() => { const source = byId.get(pending.sourceNodeId); return source === undefined ? null : svg`<path class="flow-edge pending" d=${edgePath(port(source, true), pending.point)}></path>`; })()}
  </svg>`;
};
