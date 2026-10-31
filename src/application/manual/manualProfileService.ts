import { t } from "../../localization";
import { randomUUID } from "node:crypto";
import { createEmptyManualProfile, type ManualProfile, type ProfileSummary } from "../../domain/manual/manualProfile";
import { nextUntitledName } from "../../domain/manual/profileNaming";
import { resolveImportedIdentity } from "../importExport/importIdentityResolver";
import { pruneCatalog } from "../persistence/pruneCatalog";
import type { EntityDataDao, ProfileMetadata, StateDataDao } from "../persistence/applicationDataDao";

export interface ManualProfileState {
  readonly profile: ManualProfile;
  readonly savedProfile: ManualProfile | null;
  readonly profiles: readonly ProfileSummary[];
}

export class ManualProfileService {
  public constructor(
    private readonly profileDao: EntityDataDao<ManualProfile>,
    private readonly metadataDao: StateDataDao<ProfileMetadata>
  ) {}

  public async getInitialState(): Promise<ManualProfileState> {
    const metadata = await this.refreshCatalog();
    const preferredIds = [metadata.selectedProfileId, ...metadata.profiles.map(({ id }) => id)]
      .filter((id): id is string => id !== null);

    for (const id of new Set(preferredIds)) {
      const profile = await this.profileDao.load(id);
      if (profile !== null) {
        return { profile, savedProfile: structuredClone(profile), profiles: metadata.profiles };
      }
    }
    return this.createDraft();
  }

  public async refreshCatalog(): Promise<ProfileMetadata> {
    const profiles = await pruneCatalog(this.metadataDao.get().profiles, (id) => this.profileDao.exists(id), () => this.metadataDao.get().profiles);
    const current = this.metadataDao.get();
    const selectedProfileId = profiles.some(({ id }) => id === current.selectedProfileId) ? current.selectedProfileId : profiles[0]?.id ?? null;
    const updated = { ...current, profiles, selectedProfileId };
    if (JSON.stringify(updated) !== JSON.stringify(current)) await this.metadataDao.set(updated);
    return updated;
  }

  public createDraft(): ManualProfileState {
    const metadata = this.metadataDao.get();
    const name = nextUntitledName(metadata.profiles.map(({ name: existingName }) => existingName));
    const profile = createEmptyManualProfile(randomUUID(), name);
    return { profile, savedProfile: null, profiles: metadata.profiles };
  }

  public async select(id: string): Promise<ManualProfileState> {
    const metadata = await this.refreshCatalog();
    const profile = await this.profileDao.load(id);
    if (profile === null) {
      throw new Error(t("text.theSelectedProfileNoLongerExists"));
    }
    await this.metadataDao.set({ ...metadata, selectedProfileId: id });
    return { profile, savedProfile: structuredClone(profile), profiles: metadata.profiles };
  }

  public async save(draft: ManualProfile): Promise<ManualProfileState> {
    const metadata = await this.refreshCatalog();
    const now = new Date().toISOString();
    const name = draft.name.trim() || "untitled";
    const normalizedName = name.toLocaleLowerCase();
    if (metadata.profiles.some(({ id, name: existingName }) => id !== draft.id && existingName.trim().toLocaleLowerCase() === normalizedName)) {
      throw new Error(t("text.aProfileNamedArg0AlreadyExists", { arg0: name }));
    }
    const profile: ManualProfile = { ...structuredClone(draft), name, updatedAt: now };
    await this.profileDao.save(profile);

    const summary: ProfileSummary = { id: profile.id, name: profile.name, updatedAt: profile.updatedAt };
    const profiles = [...metadata.profiles.filter(({ id }) => id !== profile.id), summary]
      .sort((left, right) => left.name.localeCompare(right.name));
    await this.metadataDao.set({ version: 1, selectedProfileId: profile.id, profiles });
    return { profile, savedProfile: structuredClone(profile), profiles };
  }

  public async delete(id: string): Promise<ManualProfileState> {
    await this.profileDao.delete(id);
    const metadata = await this.refreshCatalog();
    const profiles = metadata.profiles.filter((profile) => profile.id !== id);
    const updatedMetadata: ProfileMetadata = { version: 1, selectedProfileId: profiles[0]?.id ?? null, profiles };
    await this.metadataDao.set(updatedMetadata);
    if (updatedMetadata.selectedProfileId !== null) {
      return this.select(updatedMetadata.selectedProfileId);
    }
    return this.createDraft();
  }

  public async import(profileToImport: ManualProfile): Promise<ManualProfileState> {
    const metadata = await this.refreshCatalog();
    if (metadata.profiles.some(({ id }) => id === profileToImport.id)) {
      const existing = await this.profileDao.load(profileToImport.id);
      if (existing !== null && JSON.stringify(existing) === JSON.stringify(profileToImport)) return this.select(existing.id);
    }
    const identity = resolveImportedIdentity(
      profileToImport,
      new Set(metadata.profiles.map(({ id }) => id)),
      metadata.profiles.map(({ name }) => name),
      randomUUID
    );
    const now = new Date().toISOString();
    const imported: ManualProfile = {
      ...structuredClone(profileToImport),
      id: identity.id,
      name: identity.name,
      createdAt: now,
      updatedAt: now
    };
    return this.save(imported);
  }
}
