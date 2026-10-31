import type { ArrayResource } from "../../domain/arrays/arrayResource";
import type { AutomationDocument } from "../../domain/automations/automation";
import type { BrowserPreferences } from "../../domain/browser/browserProvider";
import type { FormulaResource } from "../../domain/formulas/formula";
import type { ManualProfile, ProfileSummary } from "../../domain/manual/manualProfile";
import type { GlobalResource, GlobalResourceSummary } from "../../domain/resources/globalResource";
import type { Result } from "../../shared/result";

export interface DataCodec<T> {
  serialize(value: T): string;
  deserialize(serialized: string): Result<T>;
}

export interface EntityDataDao<T> {
  exists(id: string): Promise<boolean>;
  load(id: string): Promise<T | null>;
  save(value: T): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface SingletonDataDao<T> {
  load(): Promise<T | null>;
  save(value: T): Promise<void>;
}

export interface StateDataDao<T> {
  get(): T;
  set(value: T): Promise<void>;
}

export interface ProfileMetadata {
  readonly version: 1;
  readonly selectedProfileId: string | null;
  readonly profiles: readonly ProfileSummary[];
}

export interface ResourceMetadata {
  readonly version: 1;
  readonly selectedResourceId: string | null;
  readonly resources: readonly GlobalResourceSummary[];
}

export interface ApplicationDataDao {
  readonly profiles: EntityDataDao<ManualProfile>;
  readonly profileMetadata: StateDataDao<ProfileMetadata>;
  readonly formulas: EntityDataDao<FormulaResource>;
  readonly formulaMetadata: StateDataDao<ResourceMetadata>;
  readonly arrays: EntityDataDao<ArrayResource>;
  readonly arrayMetadata: StateDataDao<ResourceMetadata>;
  readonly automations: SingletonDataDao<AutomationDocument>;
  readonly browserPreferences: StateDataDao<BrowserPreferences>;
  initialize(): Promise<void>;
}

export type ResourceDataDao<T extends GlobalResource> = EntityDataDao<T>;
