import type { ArrayResource } from "../arrays/arrayResource";
import type { FormulaResource } from "../formulas/formula";
import type { ManualProfile } from "../manual/manualProfile";

export const MANUAL_PROFILE_BUNDLE_VERSION = 1 as const;

export interface ManualPortableResources {
  readonly formulas: readonly FormulaResource[];
  readonly arrays: readonly ArrayResource[];
}

export interface ManualProfileBundle extends ManualPortableResources {
  readonly bundleVersion: typeof MANUAL_PROFILE_BUNDLE_VERSION;
  readonly profile: ManualProfile;
}

export const createManualProfileBundle = (
  profile: ManualProfile,
  resources: ManualPortableResources = { formulas: [], arrays: [] }
): ManualProfileBundle => ({
  bundleVersion: MANUAL_PROFILE_BUNDLE_VERSION,
  profile: structuredClone(profile),
  formulas: structuredClone(resources.formulas),
  arrays: structuredClone(resources.arrays)
});
