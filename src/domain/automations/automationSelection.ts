import type { AutomationDocument, AutomationProcess } from "./automation";

export type AutomationSelectionScope =
  | { readonly kind: "group"; readonly groupId: string }
  | { readonly kind: "process"; readonly groupId: string; readonly processId: string };

export const selectAutomationDocument = (
  document: AutomationDocument,
  scope: AutomationSelectionScope
): AutomationDocument => {
  const group = document.groups.find(({ id }) => id === scope.groupId);
  if (group === undefined) throw new Error("El grupo seleccionado ya no existe.");
  if (scope.kind === "group") return { ...structuredClone(document), name: group.name, groups: [structuredClone(group)] };
  const process = group.processes.find(({ id }) => id === scope.processId);
  if (process === undefined) throw new Error("El flujo seleccionado ya no existe.");
  return {
    ...structuredClone(document),
    name: process.name,
    groups: [{ ...structuredClone(group), processes: [structuredClone(process)] }]
  };
};

export const applyAutomationDocumentSelection = (
  current: AutomationDocument,
  selected: AutomationDocument,
  scope: AutomationSelectionScope,
  createId: () => string
): AutomationDocument => {
  const selectedGroup = selected.groups[0];
  if (selectedGroup === undefined) throw new Error("El JSON no contiene ningún grupo.");
  const result = structuredClone(current);
  const groupIndex = result.groups.findIndex(({ id }) => id === scope.groupId);
  if (groupIndex < 0) throw new Error("El grupo seleccionado ya no existe.");
  if (scope.kind === "group") {
    const otherGroups = result.groups.filter(({ id }) => id !== scope.groupId);
    const occupiedIds = new Set<string>([result.id]);
    for (const group of otherGroups) addGroupIds(group, occupiedIds);
    occupiedIds.add(scope.groupId);
    const groupNames = otherGroups.map(({ name }) => name);
    const processNames = otherGroups.flatMap(({ processes }) => processes.map(({ name }) => name));
    const processes = selectedGroup.processes.map((process) => normalizeProcess(process, null, occupiedIds, processNames, createId));
    result.groups[groupIndex] = {
      ...structuredClone(result.groups[groupIndex]!),
      id: scope.groupId,
      name: availableName(selectedGroup.name, groupNames),
      ...(selectedGroup.expanded === undefined ? {} : { expanded: selectedGroup.expanded }),
      processes
    };
    return result;
  }
  const selectedProcess = selectedGroup.processes[0];
  if (selectedProcess === undefined) throw new Error("El JSON no contiene ningún flujo.");
  const targetGroup = result.groups[groupIndex];
  if (targetGroup === undefined) throw new Error("El grupo seleccionado ya no existe.");
  const processIndex = targetGroup.processes.findIndex(({ id }) => id === scope.processId);
  if (processIndex < 0) throw new Error("El flujo seleccionado ya no existe.");
  const occupiedIds = new Set<string>([result.id]);
  const otherProcessNames: string[] = [];
  for (const group of result.groups) {
    occupiedIds.add(group.id);
    for (const process of group.processes) {
      if (process.id === scope.processId) continue;
      addProcessIds(process, occupiedIds);
      otherProcessNames.push(process.name);
    }
  }
  targetGroup.processes[processIndex] = normalizeProcess(selectedProcess, scope.processId, occupiedIds, otherProcessNames, createId);
  return result;
};

const normalizeProcess = (
  source: AutomationProcess,
  forcedId: string | null,
  occupiedIds: Set<string>,
  occupiedNames: string[],
  createId: () => string
): AutomationProcess => {
  const id = forcedId ?? availableId(source.id, occupiedIds, createId);
  occupiedIds.add(id);
  const name = availableName(source.name, occupiedNames);
  occupiedNames.push(name);
  const nodeIds = new Map<string, string>();
  const nodes = source.nodes.map((node) => {
    const nodeId = availableId(node.id, occupiedIds, createId);
    occupiedIds.add(nodeId);
    nodeIds.set(node.id, nodeId);
    return { ...structuredClone(node), id: nodeId };
  });
  const edges = source.edges.map((edge) => {
    const edgeId = availableId(edge.id, occupiedIds, createId);
    occupiedIds.add(edgeId);
    return {
      ...structuredClone(edge),
      id: edgeId,
      sourceNodeId: nodeIds.get(edge.sourceNodeId) ?? edge.sourceNodeId,
      targetNodeId: nodeIds.get(edge.targetNodeId) ?? edge.targetNodeId
    };
  });
  return { ...structuredClone(source), id, name, nodes, edges };
};

const addProcessIds = (process: AutomationProcess, ids: Set<string>): void => {
  ids.add(process.id);
  for (const node of process.nodes) ids.add(node.id);
  for (const edge of process.edges) ids.add(edge.id);
};

const addGroupIds = (group: AutomationDocument["groups"][number], ids: Set<string>): void => {
  ids.add(group.id);
  for (const process of group.processes) addProcessIds(process, ids);
};

const availableId = (requested: string, occupied: ReadonlySet<string>, createId: () => string): string => {
  if (!occupied.has(requested)) return requested;
  let candidate = createId();
  while (occupied.has(candidate)) candidate = createId();
  return candidate;
};

const availableName = (requested: string, occupied: readonly string[]): string => {
  const base = requested.trim() || "importado";
  const normalized = new Set(occupied.map((name) => name.trim().toLocaleLowerCase()));
  if (!normalized.has(base.toLocaleLowerCase())) return base;
  let suffix = 1;
  while (normalized.has(`${base}-${suffix}`.toLocaleLowerCase())) suffix += 1;
  return `${base}-${suffix}`;
};
