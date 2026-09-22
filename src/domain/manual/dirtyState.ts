import type { ManualProfile } from "./manualProfile";

const comparableProfile = (profile: ManualProfile): ManualProfile => ({
  ...profile,
  createdAt: "",
  updatedAt: ""
});

export const isProfileDirty = (draft: ManualProfile, saved: ManualProfile | null): boolean =>
  saved === null || JSON.stringify(comparableProfile(draft)) !== JSON.stringify(comparableProfile(saved));
