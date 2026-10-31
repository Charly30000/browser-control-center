import { t } from "../../localization";
const SAFE_IMPORTED_ID = /^[a-zA-Z0-9-]+$/;
const suffixPattern = /^(.*?)(?:-(\d+))?$/;

export interface ImportedIdentity {
  readonly id: string;
  readonly name: string;
  readonly changed: boolean;
}

const normalized = (value: string): string => value.trim().toLocaleLowerCase();

const uniqueId = (occupied: ReadonlySet<string>, createId: () => string): string => {
  let candidate = createId();
  while (occupied.has(candidate) || !SAFE_IMPORTED_ID.test(candidate)) candidate = createId();
  return candidate;
};

export const resolveImportedId = (requestedId: string, occupiedIds: ReadonlySet<string>, createId: () => string): string =>
  occupiedIds.has(requestedId) || !SAFE_IMPORTED_ID.test(requestedId)
    ? uniqueId(occupiedIds, createId)
    : requestedId;

const uniqueName = (requestedName: string, occupiedNames: readonly string[], forceSuffix: boolean): string => {
  const trimmed = requestedName.trim() || t("labels.imported");
  const occupied = new Set(occupiedNames.map(normalized));
  if (!forceSuffix && !occupied.has(normalized(trimmed))) return trimmed;
  const base = suffixPattern.exec(trimmed)?.[1]?.trim() || trimmed;
  let suffix = 1;
  while (occupied.has(normalized(`${base}-${suffix}`))) suffix += 1;
  return `${base}-${suffix}`;
};

export const resolveImportedIdentity = (
  requested: { readonly id: string; readonly name: string },
  occupiedIds: ReadonlySet<string>,
  occupiedNames: readonly string[],
  createId: () => string
): ImportedIdentity => {
  const resolvedId = resolveImportedId(requested.id, occupiedIds, createId);
  const idCollision = resolvedId !== requested.id;
  const nameCollision = occupiedNames.some((name) => normalized(name) === normalized(requested.name));
  const changed = idCollision || nameCollision;
  return {
    id: changed ? (idCollision ? resolvedId : uniqueId(occupiedIds, createId)) : requested.id,
    name: uniqueName(requested.name, occupiedNames, changed),
    changed
  };
};
