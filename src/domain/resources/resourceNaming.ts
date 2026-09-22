import type { GlobalResourceSummary } from "./globalResource";

const suffixPattern = /^(.*?)(?:-(\d+))?$/;

export const nextResourceName = (baseName: string, existingNames: readonly string[]): string => {
  const occupied = new Set(existingNames.map((name) => name.toLocaleLowerCase()));
  if (!occupied.has(baseName.toLocaleLowerCase())) return baseName;
  let suffix = 1;
  while (occupied.has(`${baseName}-${suffix}`.toLocaleLowerCase())) suffix += 1;
  return `${baseName}-${suffix}`;
};

export const uniqueImportedResourceName = (requestedName: string, existingNames: readonly string[]): string => {
  const trimmed = requestedName.trim() || "resource";
  const occupied = new Set(existingNames.map((name) => name.toLocaleLowerCase()));
  if (!occupied.has(trimmed.toLocaleLowerCase())) return trimmed;
  const base = suffixPattern.exec(trimmed)?.[1] || trimmed;
  return nextResourceName(base, existingNames);
};

export const hasDuplicateResourceName = (
  name: string,
  currentId: string,
  resources: readonly GlobalResourceSummary[]
): boolean => resources.some((resource) =>
  resource.id !== currentId && resource.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase()
);
