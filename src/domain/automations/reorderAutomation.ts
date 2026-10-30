import type { AutomationDocument } from "./automation";
import type { EntryDropPosition } from "../manual/reorderEntries";

/** Mueve el objeto completo solo tras comprobar que origen y destino existen. */
export const moveAutomationProcess = (document: AutomationDocument, processId: string, targetGroupId: string, targetProcessId: string | null = null, position: EntryDropPosition = "after"): boolean => {
  const source = document.groups.find(({ processes }) => processes.some(({ id }) => id === processId));
  const target = document.groups.find(({ id }) => id === targetGroupId);
  if (source === undefined || target === undefined || processId === targetProcessId) return false;
  const sourceIndex = source.processes.findIndex(({ id }) => id === processId);
  const targetIndex = targetProcessId === null ? target.processes.length : target.processes.findIndex(({ id }) => id === targetProcessId);
  if (targetIndex < 0) return false;
  let destination = targetIndex + (targetProcessId !== null && position === "after" ? 1 : 0);
  if (source === target && sourceIndex < destination) destination -= 1;
  if (source === target && sourceIndex === destination) return false;
  const [process] = source.processes.splice(sourceIndex, 1);
  if (process === undefined) return false;
  target.processes.splice(destination, 0, process);
  return true;
};
