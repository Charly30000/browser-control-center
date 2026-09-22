import type * as vscode from "vscode";
import type { GlobalResourceSummary } from "../../domain/resources/globalResource";

export interface ResourceMetadata {
  readonly version: 1;
  readonly selectedResourceId: string | null;
  readonly resources: readonly GlobalResourceSummary[];
}

const EMPTY_METADATA: ResourceMetadata = { version: 1, selectedResourceId: null, resources: [] };

const isSummary = (value: unknown): value is GlobalResourceSummary => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.name === "string" && typeof record.updatedAt === "string";
};

const isMetadata = (value: unknown): value is ResourceMetadata => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.version === 1 &&
    (record.selectedResourceId === null || typeof record.selectedResourceId === "string") &&
    Array.isArray(record.resources) && record.resources.every(isSummary);
};

export class ResourceMetadataStore {
  public constructor(
    private readonly state: vscode.Memento,
    private readonly key: string
  ) {}

  public get(): ResourceMetadata {
    const stored = this.state.get<unknown>(this.key);
    return isMetadata(stored) ? stored : EMPTY_METADATA;
  }

  public async set(metadata: ResourceMetadata): Promise<void> {
    await this.state.update(this.key, metadata);
  }
}
