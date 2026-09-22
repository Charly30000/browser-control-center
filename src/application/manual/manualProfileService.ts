import { randomUUID } from "node:crypto";
import { createEmptyManualProfile, type ManualProfile, type ProfileSummary } from "../../domain/manual/manualProfile";
import { makeUniqueProfileName, nextUntitledName } from "../../domain/manual/profileNaming";
import type { ProfileRepository } from "../../infrastructure/persistence/profileRepository";
import type { ProfileMetadata, ProfileMetadataStore } from "../../infrastructure/persistence/profileMetadataStore";

export interface ManualProfileState {
  readonly profile: ManualProfile;
  readonly savedProfile: ManualProfile | null;
  readonly profiles: readonly ProfileSummary[];
}

export class ManualProfileService {
  public constructor(
    private readonly repository: ProfileRepository,
    private readonly metadataStore: ProfileMetadataStore
  ) {}

  public async initialize(): Promise<void> {
    await this.repository.initialize();
  }

  public async getInitialState(): Promise<ManualProfileState> {
    const metadata = this.metadataStore.get();
    const preferredIds = [metadata.selectedProfileId, ...metadata.profiles.map(({ id }) => id)]
      .filter((id): id is string => id !== null);

    for (const id of new Set(preferredIds)) {
      const profile = await this.repository.load(id);
      if (profile !== null) {
        return { profile, savedProfile: structuredClone(profile), profiles: metadata.profiles };
      }
    }
    return this.createDraft();
  }

  public createDraft(): ManualProfileState {
    const metadata = this.metadataStore.get();
    const name = nextUntitledName(metadata.profiles.map(({ name: existingName }) => existingName));
    const profile = createEmptyManualProfile(randomUUID(), name);
    return { profile, savedProfile: null, profiles: metadata.profiles };
  }

  public async select(id: string): Promise<ManualProfileState> {
    const metadata = this.metadataStore.get();
    const profile = await this.repository.load(id);
    if (profile === null) {
      throw new Error("El perfil seleccionado ya no existe.");
    }
    await this.metadataStore.set({ ...metadata, selectedProfileId: id });
    return { profile, savedProfile: structuredClone(profile), profiles: metadata.profiles };
  }

  public async save(draft: ManualProfile): Promise<ManualProfileState> {
    const metadata = this.metadataStore.get();
    const now = new Date().toISOString();
    const profile: ManualProfile = { ...structuredClone(draft), name: draft.name.trim() || "untitled", updatedAt: now };
    await this.repository.save(profile);

    const summary: ProfileSummary = { id: profile.id, name: profile.name, updatedAt: profile.updatedAt };
    const profiles = [...metadata.profiles.filter(({ id }) => id !== profile.id), summary]
      .sort((left, right) => left.name.localeCompare(right.name));
    await this.metadataStore.set({ version: 1, selectedProfileId: profile.id, profiles });
    return { profile, savedProfile: structuredClone(profile), profiles };
  }

  public async delete(id: string): Promise<ManualProfileState> {
    await this.repository.delete(id);
    const metadata = this.metadataStore.get();
    const profiles = metadata.profiles.filter((profile) => profile.id !== id);
    const updatedMetadata: ProfileMetadata = { version: 1, selectedProfileId: profiles[0]?.id ?? null, profiles };
    await this.metadataStore.set(updatedMetadata);
    if (updatedMetadata.selectedProfileId !== null) {
      return this.select(updatedMetadata.selectedProfileId);
    }
    return this.createDraft();
  }

  public async import(profileToImport: ManualProfile): Promise<ManualProfileState> {
    const metadata = this.metadataStore.get();
    const name = makeUniqueProfileName(profileToImport.name, metadata.profiles.map(({ name }) => name));
    const now = new Date().toISOString();
    const imported: ManualProfile = {
      ...structuredClone(profileToImport),
      id: randomUUID(),
      name,
      createdAt: now,
      updatedAt: now
    };
    return this.save(imported);
  }
}
