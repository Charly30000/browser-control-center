import * as vscode from "vscode";
import type {
  ApplicationDataDao,
  DataCodec,
  EntityDataDao,
  ProfileMetadata,
  ResourceMetadata,
  SingletonDataDao,
  StateDataDao
} from "../../application/persistence/applicationDataDao";
import type { ArrayResource } from "../../domain/arrays/arrayResource";
import type { AutomationDocument } from "../../domain/automations/automation";
import type { FormulaResource } from "../../domain/formulas/formula";
import type { ManualProfile, ProfileSummary } from "../../domain/manual/manualProfile";
import type { GlobalResourceSummary } from "../../domain/resources/globalResource";
import { arrayResourceCodec } from "./arrayResourceSerializer";
import { deserializeAutomation, serializeAutomation } from "./automationSerializer";
import { formulaCodec } from "./formulaSerializer";
import { deserializeProfile, serializeProfile } from "./profileSerializer";

const SAFE_ID = /^[a-zA-Z0-9-]+$/;
const PROFILE_METADATA_KEY = "manual.profileMetadata.v1";
const FORMULA_METADATA_KEY = "formulas.resourceMetadata.v1";
const ARRAY_METADATA_KEY = "arrays.resourceMetadata.v1";
const EMPTY_PROFILE_METADATA: ProfileMetadata = { version: 1, selectedProfileId: null, profiles: [] };
const EMPTY_RESOURCE_METADATA: ResourceMetadata = { version: 1, selectedResourceId: null, resources: [] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isProfileSummary = (value: unknown): value is ProfileSummary =>
  isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.updatedAt === "string";

const isResourceSummary = (value: unknown): value is GlobalResourceSummary =>
  isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.updatedAt === "string";

const isProfileMetadata = (value: unknown): value is ProfileMetadata =>
  isRecord(value) && value.version === 1 &&
  (value.selectedProfileId === null || typeof value.selectedProfileId === "string") &&
  Array.isArray(value.profiles) && value.profiles.every(isProfileSummary);

const isResourceMetadata = (value: unknown): value is ResourceMetadata =>
  isRecord(value) && value.version === 1 &&
  (value.selectedResourceId === null || typeof value.selectedResourceId === "string") &&
  Array.isArray(value.resources) && value.resources.every(isResourceSummary);

const isNotFound = (error: unknown): boolean =>
  error instanceof vscode.FileSystemError && error.code === "FileNotFound";

class FileEntityDataDao<T extends { readonly id: string }> implements EntityDataDao<T> {
  public constructor(
    private readonly directory: vscode.Uri,
    private readonly codec: DataCodec<T>,
    private readonly entityLabel: string
  ) {}

  public async load(id: string): Promise<T | null> {
    try {
      const serialized = await readUtf8(this.entityUri(id));
      const result = this.codec.deserialize(serialized);
      if (!result.ok) throw new Error(`No se pudo cargar ${this.entityLabel} ${id}: ${result.error}`);
      return result.value;
    } catch (error: unknown) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  public async save(value: T): Promise<void> {
    await writeUtf8Atomically(this.entityUri(value.id), this.codec.serialize(value));
  }

  public async delete(id: string): Promise<void> {
    try { await vscode.workspace.fs.delete(this.entityUri(id), { useTrash: false }); }
    catch (error: unknown) { if (!isNotFound(error)) throw error; }
  }

  private entityUri(id: string): vscode.Uri {
    if (!SAFE_ID.test(id)) throw new Error(`El identificador de ${this.entityLabel} contiene caracteres no permitidos.`);
    return vscode.Uri.joinPath(this.directory, `${id}.json`);
  }
}

class FileSingletonDataDao<T> implements SingletonDataDao<T> {
  public constructor(private readonly target: vscode.Uri, private readonly codec: DataCodec<T>) {}

  public async load(): Promise<T | null> {
    try {
      const result = this.codec.deserialize(await readUtf8(this.target));
      if (!result.ok) throw new Error(result.error);
      return result.value;
    } catch (error: unknown) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  public async save(value: T): Promise<void> {
    await writeUtf8Atomically(this.target, this.codec.serialize(value));
  }
}

class MementoStateDataDao<T> implements StateDataDao<T> {
  public constructor(
    private readonly state: vscode.Memento,
    private readonly key: string,
    private readonly guard: (value: unknown) => value is T,
    private readonly emptyValue: T
  ) {}

  public get(): T {
    const stored = this.state.get<unknown>(this.key);
    return structuredClone(this.guard(stored) ? stored : this.emptyValue);
  }

  public async set(value: T): Promise<void> {
    await this.state.update(this.key, structuredClone(value));
  }
}

const readUtf8 = async (target: vscode.Uri): Promise<string> =>
  new TextDecoder("utf-8", { fatal: true }).decode(await vscode.workspace.fs.readFile(target));

const writeUtf8Atomically = async (target: vscode.Uri, serialized: string): Promise<void> => {
  const temporary = target.with({ path: `${target.path}.tmp` });
  await vscode.workspace.fs.writeFile(temporary, new TextEncoder().encode(serialized));
  await vscode.workspace.fs.rename(temporary, target, { overwrite: true });
};

export class VsCodeApplicationDataDao implements ApplicationDataDao {
  private readonly directories: readonly vscode.Uri[];
  public readonly profiles: EntityDataDao<ManualProfile>;
  public readonly profileMetadata: StateDataDao<ProfileMetadata>;
  public readonly formulas: EntityDataDao<FormulaResource>;
  public readonly formulaMetadata: StateDataDao<ResourceMetadata>;
  public readonly arrays: EntityDataDao<ArrayResource>;
  public readonly arrayMetadata: StateDataDao<ResourceMetadata>;
  public readonly automations: SingletonDataDao<AutomationDocument>;

  public constructor(storageUri: vscode.Uri, state: vscode.Memento) {
    const profilesDirectory = vscode.Uri.joinPath(storageUri, "profiles");
    const formulasDirectory = vscode.Uri.joinPath(storageUri, "formulas");
    const arraysDirectory = vscode.Uri.joinPath(storageUri, "arrays");
    const automationsDirectory = vscode.Uri.joinPath(storageUri, "automations");
    this.directories = [profilesDirectory, formulasDirectory, arraysDirectory, automationsDirectory];
    this.profiles = new FileEntityDataDao(profilesDirectory, { serialize: serializeProfile, deserialize: deserializeProfile }, "perfil");
    this.profileMetadata = new MementoStateDataDao(state, PROFILE_METADATA_KEY, isProfileMetadata, EMPTY_PROFILE_METADATA);
    this.formulas = new FileEntityDataDao<FormulaResource>(formulasDirectory, formulaCodec, "recurso");
    this.formulaMetadata = new MementoStateDataDao(state, FORMULA_METADATA_KEY, isResourceMetadata, EMPTY_RESOURCE_METADATA);
    this.arrays = new FileEntityDataDao<ArrayResource>(arraysDirectory, arrayResourceCodec, "recurso");
    this.arrayMetadata = new MementoStateDataDao(state, ARRAY_METADATA_KEY, isResourceMetadata, EMPTY_RESOURCE_METADATA);
    this.automations = new FileSingletonDataDao(vscode.Uri.joinPath(automationsDirectory, "automation.json"), {
      serialize: serializeAutomation,
      deserialize: deserializeAutomation
    });
  }

  public async initialize(): Promise<void> {
    await Promise.all(this.directories.map((directory) => vscode.workspace.fs.createDirectory(directory)));
  }
}
