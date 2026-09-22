import type { JsonValue } from "../manual/storageValue";
import type { GlobalResource } from "../resources/globalResource";

export const ARRAY_RESOURCE_SCHEMA_VERSION = 1 as const;

export interface ArrayResource extends GlobalResource {
  readonly schemaVersion: typeof ARRAY_RESOURCE_SCHEMA_VERSION;
  items: JsonValue[];
}

export const createArrayResource = (
  id: string,
  name: string,
  now = new Date().toISOString()
): ArrayResource => ({
  schemaVersion: ARRAY_RESOURCE_SCHEMA_VERSION,
  id,
  name,
  items: [],
  createdAt: now,
  updatedAt: now
});
