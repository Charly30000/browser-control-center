import { describe, expect, it, vi } from "vitest";
import { BrowserActionsService } from "../src/application/manual/browserActionsService";
import type { GeneratorValueResolver } from "../src/application/manual/generatorValueResolver";
import type { BrowserBridge, ResolvedInputBinding } from "../src/domain/browser/browserBridge";
import { createEmptyManualProfile, createGeneratorBinding, type GeneratorBinding } from "../src/domain/manual/manualProfile";
import type { JsonValue } from "../src/domain/manual/storageValue";
import { failure, success, type Result } from "../src/shared/result";

const setup = (resolve: (binding: GeneratorBinding) => Promise<Result<JsonValue | undefined>> = (binding) => Promise.resolve(success(binding.literalValue ?? ""))) => {
  const bridge = {
    applyInputBindings: vi.fn((_bindings: readonly ResolvedInputBinding[]) => Promise.resolve()),
    start: vi.fn(() => Promise.resolve({ lifecycle: "running", pages: [], activePageId: null })),
    restart: vi.fn(() => Promise.resolve({ lifecycle: "running", pages: [], activePageId: null })),
    open: vi.fn(() => Promise.resolve())
  };
  const generators = { resolve: vi.fn(resolve) };
  return { bridge, generators, service: new BrowserActionsService(bridge as unknown as BrowserBridge, generators as unknown as GeneratorValueResolver) };
};

const binding = (id: string): GeneratorBinding => ({ ...createGeneratorBinding(id), selector: `#${id}`, literalValue: id });

describe("acciones explícitas de los campos Manual", () => {
  it("continúa tras un generador fallido y un selector no encontrado y conserva el perfil", async () => {
    const { bridge, generators, service } = setup((row) => Promise.resolve(row.id === "broken-generator" ? failure("Recurso no disponible") : success(row.literalValue ?? "")));
    bridge.applyInputBindings.mockImplementation((rows) => rows[0]?.selector === "#missing" ? Promise.reject(new Error("Elemento no encontrado")) : Promise.resolve());
    const profile = createEmptyManualProfile("saved-profile", "Saved");
    profile.generatorBindings = [binding("broken-generator"), binding("missing"), { ...binding("disabled"), enabled: false }, binding("last")];
    const original = structuredClone(profile);

    const result = await service.apply(profile, "generators", null);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Applied 1 of 3 fields; 2 failed");
    expect(bridge.applyInputBindings.mock.calls.map(([rows]) => rows[0]?.selector)).toEqual(["#missing", "#last"]);
    expect(generators.resolve.mock.calls.map(([row]) => row.id)).toEqual(["broken-generator", "missing", "last"]);
    expect(profile).toEqual(original);
  });

  it("rechaza undefined y excepciones del generador sin impedir los demás campos", async () => {
    const { bridge, service } = setup((row) => {
      if (row.id === "throws") throw new Error("Fallo del generador");
      return Promise.resolve(success(row.id === "empty" ? undefined : false));
    });
    const profile = createEmptyManualProfile("profile", "Profile");
    profile.generatorBindings = [binding("throws"), binding("empty"), binding("valid")];
    const result = await service.apply(profile, "generators", null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Applied 1 of 3");
    expect(bridge.applyInputBindings).toHaveBeenCalledWith([expect.objectContaining({ selector: "#valid", value: false })]);
  });

  it("Aplicar solo procesa la fila indicada", async () => {
    const { bridge, service } = setup();
    const profile = createEmptyManualProfile("profile", "Profile");
    profile.generatorBindings = [binding("first"), binding("second")];
    expect((await service.apply(profile, "generators", "second")).ok).toBe(true);
    expect(bridge.applyInputBindings).toHaveBeenCalledOnce();
    expect(bridge.applyInputBindings).toHaveBeenCalledWith([expect.objectContaining({ selector: "#second" })]);
  });

  it("iniciar, navegar, reiniciar y generar una muestra no escriben campos", async () => {
    const { bridge, service } = setup();
    const profile = createEmptyManualProfile("profile", "Profile");
    profile.generatorBindings = [binding("first")];
    await service.start(profile);
    await service.open(profile);
    await service.restart(profile);
    await service.previewGenerator(profile.generatorBindings[0]!);
    expect(bridge.applyInputBindings).not.toHaveBeenCalled();
  });
});
