import type { GlobalResource } from "./globalResource";

export const reconcileSavedResource = <T extends GlobalResource>(draft: T, submitted: T, saved: T): T => ({
  ...structuredClone(draft),
  name: draft.name === submitted.name ? saved.name : draft.name,
  createdAt: saved.createdAt,
  updatedAt: saved.updatedAt
});
