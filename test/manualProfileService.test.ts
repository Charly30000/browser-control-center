import { describe, expect, it } from "vitest";
import { ManualProfileService } from "../src/application/manual/manualProfileService";
import type { EntityDataDao, ProfileMetadata, StateDataDao } from "../src/application/persistence/applicationDataDao";
import { createEmptyManualProfile, createCookie, createGeneratorBinding, createHeader, createRequestOverride, createStorageEntry, type ManualProfile } from "../src/domain/manual/manualProfile";

const createHarness = () => {
  const profiles = new Map<string, ManualProfile>();
  let metadata: ProfileMetadata = { version: 1, selectedProfileId: null, profiles: [] };
  const profileDao: EntityDataDao<ManualProfile> = {
    exists: (id) => Promise.resolve(profiles.has(id)),
    load: (id) => Promise.resolve(structuredClone(profiles.get(id) ?? null)),
    save: (profile) => { profiles.set(profile.id, structuredClone(profile)); return Promise.resolve(); },
    delete: (id) => { profiles.delete(id); return Promise.resolve(); }
  };
  const metadataDao: StateDataDao<ProfileMetadata> = {
    get: () => structuredClone(metadata),
    set: (value) => { metadata = structuredClone(value); return Promise.resolve(); }
  };
  return { service: new ManualProfileService(profileDao, metadataDao), profiles, metadataDao };
};
const services = () => createHarness().service;

describe("guardado e importación de perfiles Manual", () => {
  it("elimina referencias a archivos inexistentes y selecciona un perfil que sí existe", async () => {
    const { service, profiles, metadataDao } = createHarness();
    await service.save(createEmptyManualProfile("existing", "Existente"));
    await service.save(createEmptyManualProfile("deleted", "Borrado"));
    profiles.delete("deleted");
    const state = await service.getInitialState();
    expect(state.profiles.map(({ id }) => id)).toEqual(["existing"]);
    expect(state.profile.id).toBe("existing");
    expect(metadataDao.get().selectedProfileId).toBe("existing");
    profiles.clear();
    const empty = await service.getInitialState();
    expect(empty.profiles).toEqual([]);
    expect(empty.savedProfile).toBeNull();
    expect(metadataDao.get().selectedProfileId).toBeNull();
  });

  it("restaura el perfil seleccionado completo al volver a cargar, aunque exista otro vacío", async () => {
    const service = services();
    const previous = createEmptyManualProfile("previous-profile", "Perfil anterior");
    previous.headers = [{ ...createHeader("header"), key: "X-Test", value: "existing" }];
    previous.cookies = [{ ...createCookie("cookie"), name: "test-cookie", domain: "example.test", expanded: false }];
    previous.localStorage = [{ ...createStorageEntry("local"), key: "data", value: "existing" }];
    previous.requestOverrides = [{ ...createRequestOverride("override"), matcher: "https://example.test/api" }];
    previous.generatorBindings = [{ ...createGeneratorBinding("input"), selector: "#name", literalValue: "Guardado", expanded: false }];
    previous.preferences = { autoSaveEnabled: false };
    const saved = await service.save(previous);
    await service.save(createEmptyManualProfile("empty-profile", "Vacío"));
    await service.select(previous.id);

    const reloaded = await service.getInitialState();
    expect(reloaded.profile).toEqual(saved.profile);
    expect(reloaded.savedProfile).toEqual(saved.profile);
    expect(reloaded.profiles).toHaveLength(2);
    reloaded.profile.generatorBindings.splice(0);
    expect((await service.getInitialState()).profile).toEqual(saved.profile);
  });

  it("impide que un JSON editado guarde el nombre de otro perfil", async () => {
    const service = services();
    await service.save(createEmptyManualProfile("profile-1", "QA"));

    await expect(service.save(createEmptyManualProfile("profile-2", " qa "))).rejects.toThrow("already exists");
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
