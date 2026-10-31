import { describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";
import type { ArrayResourceService } from "../src/application/arrays/arrayResourceService";
import type { FormulaService } from "../src/application/formulas/formulaService";
import type { BrowserActionsService } from "../src/application/manual/browserActionsService";
import type { ManualProfileService } from "../src/application/manual/manualProfileService";
import { createEmptyManualProfile, createGeneratorBinding, type ManualProfile } from "../src/domain/manual/manualProfile";
import type { BrowserAutomationLogger } from "../src/extension/logging/browserAutomationLogger";
import { ManualPanelManager } from "../src/extension/manual/manualPanel";
import type { ManualToExtensionMessage, ExtensionToManualMessage } from "../src/shared/messages/manualMessages";
import { failure } from "../src/shared/result";
import historical from "./fixtures/persistence/historical.json";
import { createImportExportDocument } from "../src/domain/importExport/importExportDocument";
import { MANUAL_PROFILE_SCHEMA_VERSION } from "../src/domain/manual/manualProfile";

const mocks = vi.hoisted(() => ({ createWebviewPanel: vi.fn() }));
vi.mock("vscode", () => ({
  window: { createWebviewPanel: mocks.createWebviewPanel },
  ViewColumn: { One: 1 },
  Uri: { joinPath: (_base: unknown, ...segments: string[]) => ({ toString: () => segments.join("/") }) }
}));

const profile = createEmptyManualProfile("profile", "Prueba");
profile.generatorBindings.push(createGeneratorBinding("binding"));
const generatorActions: ManualToExtensionMessage[] = [
  { type: "browser.apply", target: "generators", rowId: "binding", profile },
  { type: "browser.apply", target: "generators", rowId: null, profile },
  { type: "browser.resetGenerators" },
  { type: "browser.selectElement", bindingId: "binding" },
  { type: "browser.previewGenerator", bindingId: "binding", profile },
  { type: "browser.previewGenerator", bindingId: "deleted", profile }
];

const createHarness = (unexpectedError = false) => {
  let receive: (message: unknown) => void = () => undefined;
  const postMessage = vi.fn().mockResolvedValue(true);
  const panel = {
    webview: {
      html: "", cspSource: "vscode-webview:", asWebviewUri: (uri: unknown) => uri, postMessage,
      onDidReceiveMessage: (listener: (message: unknown) => void) => { receive = listener; return { dispose: vi.fn() }; }
    },
    onDidDispose: vi.fn(), dispose: vi.fn()
  };
  mocks.createWebviewPanel.mockReturnValue(panel);
  const action = vi.fn().mockImplementation(() => {
    if (unexpectedError) return Promise.reject(new Error("Fallo inesperado"));
    return Promise.resolve(failure("Campo no encontrado"));
  });
  const browser = { onDidChange: () => ({ dispose: vi.fn() }), getSnapshot: () => ({ lifecycle: "stopped", pages: [], activePageId: null }), apply: action, resetGenerators: action, selectElement: action, previewGenerator: action };
  const save = vi.fn((draft: ManualProfile) => Promise.resolve({ profile: draft, savedProfile: draft, profiles: [] }));
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), show: vi.fn() };
  const manager = new ManualPanelManager(
    {} as vscode.Uri, { save } as unknown as ManualProfileService, browser as unknown as BrowserActionsService,
    { getSummaries: () => [] } as unknown as FormulaService, { getAll: () => Promise.resolve([]) } as unknown as ArrayResourceService, () => undefined, logger as unknown as BrowserAutomationLogger
  );
  manager.open();
  return { receive: (message: ManualToExtensionMessage) => receive(message), postMessage, logger, manager, save };
};

describe("avisos de Inputs / Generadores en Manual", () => {
  it.each(generatorActions)("mantiene el aviso y el registro sin abrir Salida: %j", async (message) => {
    const harness = createHarness();
    harness.receive(message);

    await vi.waitFor(() => expect(harness.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "manual.notice", tone: "warning" })));
    expect(harness.logger.warn).toHaveBeenCalledOnce();
    expect(harness.logger.show).not.toHaveBeenCalled();
    harness.manager.dispose();
  });

  it.each(generatorActions.slice(0, -1))("mantiene también los errores inesperados sin abrir Salida: %j", async (message) => {
    const harness = createHarness(true);
    harness.receive(message);

    await vi.waitFor(() => expect(harness.postMessage).toHaveBeenCalledWith({ type: "manual.notice", tone: "error", message: "Fallo inesperado" }));
    expect(harness.logger.error).toHaveBeenCalledWith(expect.stringContaining("Fallo inesperado"), expect.any(Error));
    expect(harness.logger.show).not.toHaveBeenCalled();
    harness.manager.dispose();
  });

  it("conserva la apertura de Salida para fallos de otras secciones", async () => {
    const harness = createHarness();
    harness.receive({ type: "browser.apply", target: "headers", rowId: null, profile });

    await vi.waitFor(() => expect(harness.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "manual.notice", tone: "warning" })));
    expect(harness.logger.show).toHaveBeenCalledOnce();
    harness.manager.dispose();
  });
});

describe("confirmación del guardado de Manual", () => {
  it("migra el perfil antiguo incluido en un paquete JSON antes de mostrarlo", async () => {
    const harness = createHarness();
    const document = createImportExportDocument("browser-control-center/manual-profile", { bundleVersion: 1, profile: historical.manual, formulas: [historical.formulas], arrays: [historical.arrays] });
    harness.receive({ type: "manual.applyJson", currentId: historical.manual.id, serialized: JSON.stringify(document) });
    await vi.waitFor(() => expect(harness.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "manual.jsonApplied" })));
    const applied = harness.postMessage.mock.calls.map((call) => call[0] as ExtensionToManualMessage).find((message) => message.type === "manual.jsonApplied");
    if (applied?.type !== "manual.jsonApplied") throw new Error("No migrated bundle was posted.");
    expect(applied.bundle.profile).toMatchObject({ id: historical.manual.id, schemaVersion: MANUAL_PROFILE_SCHEMA_VERSION, headers: historical.manual.headers });
    expect(harness.save).not.toHaveBeenCalled();
    harness.manager.dispose();
  });

  it("devuelve la solicitud guardada sin sustituirla por un cambio de perfil", async () => {
    const harness = createHarness();
    harness.receive({ type: "manual.save", requestId: "save-1", profile, resources: null });
    await vi.waitFor(() => expect(harness.postMessage).toHaveBeenCalledWith({
      type: "manual.saved", requestId: "save-1",
      state: { profile, savedProfile: profile, profiles: [], browser: { lifecycle: "stopped", pages: [], activePageId: null }, resources: { formulas: [], arrays: [] } }
    }));
    expect(harness.save).toHaveBeenCalledWith(profile);
    expect(harness.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: "manual.state" }));
    harness.manager.dispose();
  });

  it("identifica el guardado fallido para conservar el borrador y permitir reintentar", async () => {
    const harness = createHarness();
    harness.save.mockRejectedValueOnce(new Error("No se pudo guardar"));
    harness.receive({ type: "manual.save", requestId: "save-2", profile, resources: null });
    await vi.waitFor(() => expect(harness.postMessage).toHaveBeenCalledWith({ type: "manual.saveFailed", requestId: "save-2", error: "No se pudo guardar" }));
    harness.manager.dispose();
  });
});
