import type * as vscode from "vscode";
import type { ProfileSummary } from "../../domain/manual/manualProfile";

const METADATA_KEY = "manual.profileMetadata.v1";

export interface ProfileMetadata {
  readonly version: 1;
  readonly selectedProfileId: string | null;
  readonly profiles: readonly ProfileSummary[];
}

const EMPTY_METADATA: ProfileMetadata = { version: 1, selectedProfileId: null, profiles: [] };

const isProfileSummary = (value: unknown): value is ProfileSummary => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.name === "string" && typeof record.updatedAt === "string";
};

const isMetadata = (value: unknown): value is ProfileMetadata => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.version === 1 &&
    (record.selectedProfileId === null || typeof record.selectedProfileId === "string") &&
    Array.isArray(record.profiles) && record.profiles.every(isProfileSummary);
};

export class ProfileMetadataStore {
  public constructor(private readonly state: vscode.Memento) {}

  public get(): ProfileMetadata {
    const stored = this.state.get<unknown>(METADATA_KEY);
    return isMetadata(stored) ? stored : EMPTY_METADATA;
  }

  public async set(metadata: ProfileMetadata): Promise<void> {
    await this.state.update(METADATA_KEY, metadata);
  }
}
