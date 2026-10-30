import type { ManualProfile } from "./manualProfile";
import { reconcileSavedResource } from "../resources/reconcileSavedResource";

/** Incorpora la normalización del guardado conservando las ediciones posteriores al envío. */
export const reconcileSavedProfile = (draft: ManualProfile, submitted: ManualProfile, saved: ManualProfile, resolveResources: boolean): ManualProfile => {
  const result = reconcileSavedResource(draft, submitted, saved);
  if (resolveResources) {
    const resourceIds = new Map<string, string | null>();
    for (const binding of submitted.generatorBindings) {
      const resolved = saved.generatorBindings.find(({ id }) => id === binding.id);
      if (resolved !== undefined && binding.resourceId !== null) resourceIds.set(`${binding.generatorType}:${binding.resourceId}`, resolved.resourceId);
    }
    for (const binding of result.generatorBindings) {
      const key = `${binding.generatorType}:${binding.resourceId}`;
      if (resourceIds.has(key)) binding.resourceId = resourceIds.get(key) ?? null;
    }
  }
  return result;
};
