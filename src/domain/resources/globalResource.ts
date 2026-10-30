import type { EditorPreferences } from "./editorPreferences";

export interface GlobalResource {
  readonly id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  preferences?: EditorPreferences;
}

export interface GlobalResourceSummary {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
}

export interface ResourceEditorState<T extends GlobalResource> {
  readonly resource: T;
  readonly savedResource: T | null;
  readonly resources: readonly GlobalResourceSummary[];
}
