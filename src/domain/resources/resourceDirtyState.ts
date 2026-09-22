import type { GlobalResource } from "./globalResource";

export const isResourceDirty = <T extends GlobalResource>(draft: T, saved: T | null): boolean => {
  if (saved === null) return true;
  return JSON.stringify({ ...draft, createdAt: "", updatedAt: "" }) !==
    JSON.stringify({ ...saved, createdAt: "", updatedAt: "" });
};
