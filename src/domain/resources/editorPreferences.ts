export interface EditorPreferences {
  autoSaveEnabled: boolean;
}

export const isAutoSaveEnabled = (preferences: EditorPreferences | undefined): boolean => preferences?.autoSaveEnabled ?? true;

export const isOptionalEditorPreferences = (value: unknown): value is EditorPreferences | undefined =>
  value === undefined || (typeof value === "object" && value !== null && !Array.isArray(value) &&
    "autoSaveEnabled" in value && typeof value.autoSaveEnabled === "boolean");
