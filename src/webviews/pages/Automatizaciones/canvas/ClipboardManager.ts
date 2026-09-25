import type { AutomationEdge, AutomationNode, Point } from "../../../../domain/automations/automation";

interface ClipboardPayload { readonly nodes: readonly AutomationNode[]; readonly edges: readonly AutomationEdge[]; }
export interface PasteResult { readonly nodes: readonly AutomationNode[]; readonly edges: readonly AutomationEdge[]; readonly selectedIds: readonly string[]; }

export class ClipboardManager {
  private payload: ClipboardPayload | null = null;
  private pasteCount = 0;
  public copy(nodes: readonly AutomationNode[], edges: readonly AutomationEdge[], selectedIds: ReadonlySet<string>): void {
    const copiedNodes = nodes.filter(({ id }) => selectedIds.has(id));
    this.payload = { nodes: structuredClone(copiedNodes), edges: structuredClone(edges.filter((edge) => selectedIds.has(edge.sourceNodeId) && selectedIds.has(edge.targetNodeId))) };
    this.pasteCount = 0;
  }
  public paste(offset: Point = { x: 32, y: 32 }): PasteResult | null {
    if (this.payload === null || this.payload.nodes.length === 0) return null;
    this.pasteCount += 1; const map = new Map<string, string>();
    const nodes = this.payload.nodes.map((node) => { const id = crypto.randomUUID(); map.set(node.id, id); return { ...structuredClone(node), id, position: { x: node.position.x + offset.x * this.pasteCount, y: node.position.y + offset.y * this.pasteCount } }; });
    const edges = this.payload.edges.map((edge) => ({ ...structuredClone(edge), id: crypto.randomUUID(), sourceNodeId: map.get(edge.sourceNodeId) ?? edge.sourceNodeId, targetNodeId: map.get(edge.targetNodeId) ?? edge.targetNodeId }));
    return { nodes, edges, selectedIds: nodes.map(({ id }) => id) };
  }
}
