export type EntryDropPosition = "before" | "after";

/** Reordena un borrador sin crear, eliminar ni cambiar las identidades de sus filas. */
export const moveEntry = (entries: { readonly id: string }[], sourceId: string, targetId: string, position: EntryDropPosition): void => {
  const sourceIndex = entries.findIndex(({ id }) => id === sourceId);
  const targetIndex = entries.findIndex(({ id }) => id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  const destination = targetIndex + (position === "after" ? 1 : 0) - (sourceIndex < targetIndex ? 1 : 0);
  if (destination === sourceIndex) return;
  const [entry] = entries.splice(sourceIndex, 1);
  if (entry !== undefined) entries.splice(destination, 0, entry);
};
