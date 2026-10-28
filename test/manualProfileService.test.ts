import { describe, expect, it } from "vitest";
import { ManualProfileService } from "../src/application/manual/manualProfileService";
import type { EntityDataDao, ProfileMetadata, StateDataDao } from "../src/application/persistence/applicationDataDao";
import { createEmptyManualProfile, type ManualProfile } from "../src/domain/manual/manualProfile";

const services = () => {
  const profiles = new Map<string, ManualProfile>();
  let metadata: ProfileMetadata = { version: 1, selectedProfileId: null, profiles: [] };
  const profileDao: EntityDataDao<ManualProfile> = {
    load: (id) => Promise.resolve(structuredClone(profiles.get(id) ?? null)),
    save: (profile) => { profiles.set(profile.id, structuredClone(profile)); return Promise.resolve(); },
    delete: (id) => { profiles.delete(id); return Promise.resolve(); }
  };
  const metadataDao: StateDataDao<ProfileMetadata> = {
    get: () => structuredClone(metadata),
    set: (value) => { metadata = structuredClone(value); return Promise.resolve(); }
  };
  return new ManualProfileService(profileDao, metadataDao);
};

describe("guardado e importación de perfiles Manual", () => {
  it("impide que un JSON editado guarde el nombre de otro perfil", async () => {
    const service = services();
    await service.save(createEmptyManualProfile("profile-1", "QA"));

    await expect(service.save(createEmptyManualProfile("profile-2", " qa "))).rejects.toThrow("Ya existe un perfil");
  });

  it("genera una identidad independiente si el mismo ID tiene contenido diferente", async () => {
    const service = services();
    await service.save(createEmptyManualProfile("profile-1", "QA"));

    const source = createEmptyManualProfile("profile-1", "QA");
    source.url = "https://otro.example";
    const imported = await service.import(source);

    expect(imported.profile.id).not.toBe("profile-1");
    expect(imported.profile.name).toBe("QA-1");
  });

  it("reutiliza el perfil si coinciden el ID y todo el contenido", async () => {
    const service = services();
    const saved = await service.save(createEmptyManualProfile("profile-1", "QA"));

    const imported = await service.import(structuredClone(saved.profile));

    expect(imported.profile).toEqual(saved.profile);
    expect(imported.profiles).toHaveLength(1);
  });
});
