import type { AutomationDocument, AutomationEdge, AutomationGroup, AutomationNode, AutomationProcess } from "../../domain/automations/automation";
import { resolveImportedId, resolveImportedIdentity } from "./importIdentityResolver";

const documentIds = (document: AutomationDocument): Set<string> => {
  const ids = new Set<string>([document.id]);
  for (const group of document.groups) {
    ids.add(group.id);
    for (const process of group.processes) {
      ids.add(process.id);
      for (const node of process.nodes) ids.add(node.id);
      for (const edge of process.edges) ids.add(edge.id);
    }
  }
  return ids;
};

export class AutomationImportService {
  public merge(
    current: AutomationDocument,
    imported: AutomationDocument,
    createId: () => string,
    now = new Date().toISOString()
  ): AutomationDocument {
    if (imported.groups.length === 0) throw new Error("El documento importado no contiene grupos.");
    const occupiedIds = documentIds(current);
    const groupNames = current.groups.map(({ name }) => name);
    const processNames = current.groups.flatMap(({ processes }) => processes.map(({ name }) => name));
    const importedGroups: AutomationGroup[] = [];

    for (const sourceGroup of imported.groups) {
      const groupIdentity = resolveImportedIdentity(sourceGroup, occupiedIds, groupNames, createId);
      occupiedIds.add(groupIdentity.id);
      groupNames.push(groupIdentity.name);
      const processes = sourceGroup.processes.map((process) => this.importProcess(process, occupiedIds, processNames, createId));
      importedGroups.push({ id: groupIdentity.id, name: groupIdentity.name, processes });
    }

    return {
      ...structuredClone(current),
      groups: [...structuredClone(current.groups), ...importedGroups],
      updatedAt: now
    };
  }

  private importProcess(
    source: AutomationProcess,
    occupiedIds: Set<string>,
    occupiedNames: string[],
    createId: () => string
  ): AutomationProcess {
    const identity = resolveImportedIdentity(source, occupiedIds, occupiedNames, createId);
    occupiedIds.add(identity.id);
    occupiedNames.push(identity.name);
    const nodeIds = new Map<string, string>();
    const nodes: AutomationNode[] = source.nodes.map((node) => {
      const id = resolveImportedId(node.id, occupiedIds, createId);
      occupiedIds.add(id);
      nodeIds.set(node.id, id);
      return { ...structuredClone(node), id };
    });
    const edges: AutomationEdge[] = source.edges.map((edge) => {
      const id = resolveImportedId(edge.id, occupiedIds, createId);
      occupiedIds.add(id);
      return {
        ...structuredClone(edge),
        id,
        sourceNodeId: nodeIds.get(edge.sourceNodeId) ?? edge.sourceNodeId,
        targetNodeId: nodeIds.get(edge.targetNodeId) ?? edge.targetNodeId
      };
    });
    return { ...structuredClone(source), id: identity.id, name: identity.name, nodes, edges };
  }
}
