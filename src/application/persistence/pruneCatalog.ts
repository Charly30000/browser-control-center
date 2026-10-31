interface CatalogEntry { readonly id: string; readonly name: string; readonly updatedAt: string; }

/** Re-read metadata after I/O so unrelated saves added meanwhile are preserved. */
export const pruneCatalog = async <T extends CatalogEntry>(
  snapshot: readonly T[],
  exists: (id: string) => Promise<boolean>,
  currentEntries: () => readonly T[]
): Promise<readonly T[]> => {
  const missing = new Map<string, T>();
  await Promise.all(snapshot.map(async (entry) => { if (!await exists(entry.id)) missing.set(entry.id, entry); }));
  return currentEntries().filter((entry) => {
    const previous = missing.get(entry.id);
    return previous === undefined || previous.name !== entry.name || previous.updatedAt !== entry.updatedAt;
  });
};
