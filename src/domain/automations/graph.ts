import { t } from "../../localization";
import type { AutomationEdge, AutomationNode } from "./automation";
import { failure, success, type Result } from "../../shared/result";

export const topologicalOrder = (nodes: readonly AutomationNode[], edges: readonly AutomationEdge[]): Result<readonly AutomationNode[]> => {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, [] as string[]]));
  for (const edge of edges) {
    if (!byId.has(edge.sourceNodeId) || !byId.has(edge.targetNodeId)) return failure(t("text.aConnectionReferencesANodeThatDoesNotExist"));
    incoming.set(edge.targetNodeId, (incoming.get(edge.targetNodeId) ?? 0) + 1);
    outgoing.get(edge.sourceNodeId)?.push(edge.targetNodeId);
  }
  const compare = (left: AutomationNode, right: AutomationNode): number => left.position.y - right.position.y || left.position.x - right.position.x || left.id.localeCompare(right.id);
  const ready = nodes.filter((node) => incoming.get(node.id) === 0).sort(compare);
  const ordered: AutomationNode[] = [];
  while (ready.length > 0) {
    const node = ready.shift();
    if (node === undefined) break;
    ordered.push(node);
    for (const targetId of outgoing.get(node.id) ?? []) {
      const next = (incoming.get(targetId) ?? 1) - 1;
      incoming.set(targetId, next);
      const target = byId.get(targetId);
      if (next === 0 && target !== undefined) { ready.push(target); ready.sort(compare); }
    }
  }
  return ordered.length === nodes.length ? success(ordered) : failure(t("text.theProcessContainsACycle"));
};

export const predecessorIds = (nodeId: string, edges: readonly AutomationEdge[]): readonly string[] =>
  edges.filter((edge) => edge.targetNodeId === nodeId).map((edge) => edge.sourceNodeId);
