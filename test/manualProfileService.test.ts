import { describe, expect, it } from "vitest";
import { ManualProfileService } from "../src/application/manual/manualProfileService";
import type { EntityDataDao, ProfileMetadata, StateDataDao } from "../src/application/persistence/applicationDataDao";
import { createEmptyManualProfile, type ManualProfile } from "../src/domain/manual/manualProfile";

const services = () => {
  const profiles = new Map<string, ManualProfile>();
  let metadata: ProfileMetadata = { version: 1, selectedProfileId: null, profiles: [] };
  const profileDao: EntityDataDao<ManualProfile> = {
    load: async (id) => structuredClone(profiles.get(id) ?? null),
    save: async (profile) => { profiles.set(profile.id, structuredClone(profile)); },
    delete: async (id) => { profiles.delete(id); }
  };
  const metadataDao: StateDataDao<ProfileMetadata> = {
    get: () => structuredClone(metadata),
    set: async (value) => { metadata = structuredClone(value); }
  };
  return new ManualProfileService(profileDao, metadataDao);
};

describe("guardado e importación de perfiles Manual", () => {
  it("impide que un JSON editado guarde el nombre de otro perfil", async () => {
    const service = services();
    await service.save(createEmptyManualProfile("profile-1", "QA"));

    await expect(service.save(createEmptyManualProfile("profile-2", " qa "))).rejects.toThrow("Ya existe un perfil");
  });

  it("mantiene la regla de importación y genera una identidad independiente", async () => {
    const service = services();
    await service.save(createEmptyManualProfile("profile-1", "QA"));

    const imported = await service.import(createEmptyManualProfile("profile-1", "QA"));

    expect(imported.profile.id).not.toBe("profile-1");
    expect(imported.profile.name).toBe("QA-1");
  });
});
