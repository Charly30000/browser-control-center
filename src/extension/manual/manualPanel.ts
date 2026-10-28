import * as vscode from "vscode";
import type { ArrayResourceService } from "../../application/arrays/arrayResourceService";
import { ImportExportDocumentService } from "../../application/importExport/importExportDocumentService";
import { ManualProfileBundleService } from "../../application/importExport/manualProfileBundleService";
import type { FormulaService } from "../../application/formulas/formulaService";
import type { BrowserActionsService } from "../../application/manual/browserActionsService";
import type { ManualProfileService, ManualProfileState } from "../../application/manual/manualProfileService";
import { createManualProfileBundle, MANUAL_PROFILE_BUNDLE_VERSION, type ManualPortableResources, type ManualProfileBundle } from "../../domain/importExport/manualProfileBundle";
import type { ManualProfile } from "../../domain/manual/manualProfile";
import { isArrayResource } from "../../infrastructure/persistence/arrayResourceSerializer";
import { isFormulaResource } from "../../infrastructure/persistence/formulaSerializer";
import { deserializeProfile, isManualProfile } from "../../infrastructure/persistence/profileSerializer";
import { failure, success, type Result } from "../../shared/result";
import {
  isManualToExtensionMessage,
  type ExtensionToManualMessage,
  type ManualStatePayload,
  type ManualToExtensionMessage
} from "../../shared/messages/manualMessages";
import { createWebviewHtml } from "../webview/createWebviewHtml";
import { confirmDestructiveAction } from "../webview/confirmDestructiveAction";
import { JsonImportExportFileService } from "../importExport/jsonImportExportFileService";
import type { BrowserAutomationLogger } from "../logging/browserAutomationLogger";

const decodeManualBundle = (value: unknown): Result<ManualProfileBundle> => {
  if (isManualProfile(value)) return success(createManualProfileBundle(value));
  if (typeof value !== "object" || value === null || Array.isArray(value)) return failure("El paquete Manual no tiene una estructura válida.");
  const bundle = value as Record<string, unknown>;
  if (bundle.bundleVersion !== MANUAL_PROFILE_BUNDLE_VERSION) return failure(`Versión de paquete Manual no compatible. Se esperaba ${MANUAL_PROFILE_BUNDLE_VERSION}.`);
  if (!isManualProfile(bundle.profile)) return failure("El perfil del paquete Manual no es válido.");
  if (!Array.isArray(bundle.formulas) || !bundle.formulas.every(isFormulaResource)) return failure("Las fórmulas del paquete Manual no son válidas.");
  if (!Array.isArray(bundle.arrays) || !bundle.arrays.every(isArrayResource)) return failure("Los arrays del paquete Manual no son válidos.");
  if (new Set(bundle.formulas.map(({ id }) => id)).size !== bundle.formulas.length) return failure("El paquete Manual contiene IDs de fórmulas duplicados.");
  if (new Set(bundle.arrays.map(({ id }) => id)).size !== bundle.arrays.length) return failure("El paquete Manual contiene IDs de arrays duplicados.");
  return success({ bundleVersion: MANUAL_PROFILE_BUNDLE_VERSION, profile: bundle.profile, formulas: bundle.formulas, arrays: bundle.arrays });
};

const decodeLegacyManualBundle = (serialized: string): Result<ManualProfileBundle> => {
  const profile = deserializeProfile(serialized);
  return profile.ok ? success(createManualProfileBundle(profile.value)) : profile;
};

export class ManualPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly documents = new ImportExportDocumentService<ManualProfileBundle>(
    "browser-control-center/manual-profile",
    decodeManualBundle,
    decodeLegacyManualBundle
  );
  private readonly files = new JsonImportExportFileService();
  private readonly portableResources: ManualProfileBundleService;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly profileService: ManualProfileService,
    private readonly browserActions: BrowserActionsService,
    private readonly formulaService: FormulaService,
    private readonly arrayService: ArrayResourceService,
    private readonly onPortableResourcesChanged: () => void,
    private readonly logger: BrowserAutomationLogger
  ) {
    this.portableResources = new ManualProfileBundleService(formulaService, arrayService);
    this.disposables.push(this.browserActions.onDidChange((browser) => { void this.post({ type: "browser.state", browser }); }));
  }

  public open(): void {
    if (this.panel !== null) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "browserControl.manual",
      "Manual Browser",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")]
      }
    );
    this.panel = panel;
    panel.webview.html = createWebviewHtml(panel.webview, this.extensionUri, "manual", "Manual Browser");
    const messageSubscription = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!isManualToExtensionMessage(message)) {
        void this.sendNotice("error", "Se recibió un mensaje no válido desde la vista Manual.");
        return;
      }
      void this.handleMessage(message);
    });
    panel.onDidDispose(() => { messageSubscription.dispose(); this.panel = null; });
  }

  public dispose(): void {
    this.panel?.dispose();
    for (const disposable of this.disposables) disposable.dispose();
  }

  public async refreshResourceCatalogs(): Promise<void> {
    if (this.panel === null) return;
    await this.post({ type: "manual.resources", resources: await this.loadResourceCatalogs() });
  }

  private async handleMessage(message: ManualToExtensionMessage): Promise<void> {
    try {
      const browserAction = this.browserActionDescription(message);
      if (browserAction !== null) this.logger.info(`[Manual] [INICIO] ${browserAction}`);
      switch (message.type) {
        case "ui.confirmDestructiveAction": {
          const confirmed = await confirmDestructiveAction(message.confirmation);
          await this.post({ type: "ui.destructiveActionConfirmed", requestId: message.requestId, confirmed });
          break;
        }
        case "manual.ready":
          await this.sendState(await this.profileService.getInitialState());
          break;
        case "manual.new":
          await this.sendState(this.profileService.createDraft());
          break;
        case "manual.select":
          await this.sendState(await this.profileService.select(message.id));
          break;
        case "manual.save":
          await this.sendState(await this.saveFromEditor(message.profile, message.resources));
          await this.sendNotice("success", "Perfil guardado.");
          break;
        case "manual.delete": {
          const confirmed = await confirmDestructiveAction({
            question: `¿Quieres eliminar el perfil «${message.name}»?`,
            detail: "Esta acción elimina el perfil guardado o descarta el borrador actual."
          });
          if (confirmed) {
            await this.sendState(await this.profileService.delete(message.id));
            await this.sendNotice("success", "Perfil eliminado.");
          }
          break;
        }
        case "manual.export":
          await this.exportProfile(message.profile, message.resources);
          break;
        case "manual.viewJson":
          await this.post({ type: "manual.jsonDocument", serialized: this.documents.serialize(await this.portableBundle(message.profile, message.resources)) });
          break;
        case "manual.applyJson": {
          const parsed = this.documents.deserialize(message.serialized);
          if (!parsed.ok) throw new Error(parsed.error);
          if (parsed.value.data.profile.id !== message.currentId) throw new Error("El ID del perfil no se puede cambiar desde el editor JSON.");
          await this.post({ type: "manual.jsonApplied", bundle: parsed.value.data });
          await this.sendNotice("success", "JSON validado y cargado como cambios sin guardar.");
          break;
        }
        case "manual.import":
          await this.importProfile();
          break;
        case "browser.open": {
          const result = await this.browserActions.open(message.profile);
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? "URL abierta." : result.error);
          break;
        }
        case "browser.start": {
          const result = await this.browserActions.start(message.profile);
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? "Navegador iniciado con una sesión limpia." : result.error);
          break;
        }
        case "browser.restart": {
          const result = await this.browserActions.restart(message.profile);
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? "Navegador reiniciado con una sesión limpia." : result.error);
          break;
        }
        case "browser.stop": {
          const result = await this.browserActions.stop(message.force);
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? "Navegador detenido." : result.error);
          break;
        }
        case "browser.selectPage": {
          const result = await this.browserActions.selectPage(message.pageId);
          if (!result.ok) await this.sendNotice("warning", result.error);
          else this.logger.info("[Manual] [OK] Pestaña seleccionada.");
          break;
        }
        case "browser.closePage": {
          const result = await this.browserActions.closePage(message.pageId);
          if (!result.ok) await this.sendNotice("warning", result.error);
          else this.logger.info("[Manual] [OK] Pestaña cerrada.");
          break;
        }
        case "browser.apply": {
          const result = await this.browserActions.apply(message.profile, message.target, message.rowId);
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? "Configuración aplicada." : result.error);
          break;
        }
        case "browser.syncOverrides": {
          const result = await this.browserActions.syncOverrides(message.profile);
          if (!result.ok) await this.sendNotice("warning", result.error);
          else this.logger.info("[Manual] [OK] Overrides sincronizados.");
          break;
        }
        case "browser.resetGenerators": {
          const result = await this.browserActions.resetGenerators();
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? "Generadores reseteados." : result.error);
          break;
        }
        case "browser.selectElement": {
          const result = await this.browserActions.selectElement();
          if (result.ok) {
            await this.post({ type: "browser.elementSelected", bindingId: message.bindingId, selector: result.value });
            this.logger.info("[Manual] [OK] Elemento seleccionado.");
          } else {
            await this.sendNotice("warning", result.error);
          }
          break;
        }
        case "browser.previewGenerator": {
          const binding = message.profile.generatorBindings.find(({ id }) => id === message.bindingId);
          if (binding === undefined) { await this.sendNotice("warning", "El generador ya no existe."); break; }
          const result = await this.browserActions.previewGenerator(binding);
          if (result.ok) await this.post({ type: "browser.generatorPreview", bindingId: binding.id, value: result.value });
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? "Muestra generada." : result.error);
          break;
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Se ha producido un error inesperado.";
      this.logger.error(`[Manual] [ERROR] ${message}`, error);
      this.logger.show();
      await this.post({ type: "manual.notice", tone: "error", message });
    }
  }

  private async exportProfile(profile: ManualStatePayload["profile"], resources: ManualPortableResources | null): Promise<void> {
    const exported = await this.files.write(this.documents.serialize(await this.portableBundle(profile, resources)), {
      suggestedName: profile.name,
      suffix: ".manual-profile.json",
      filterName: "Perfil Manual",
      saveLabel: "Exportar perfil"
    });
    if (!exported) return;
    await this.sendNotice("success", "Perfil exportado.");
  }

  private portableBundle(profile: ManualProfile, resources: ManualPortableResources | null): Promise<ManualProfileBundle> {
    if (resources === null) return this.portableResources.create(profile);
    return Promise.resolve(this.requireBundle(createManualProfileBundle(profile, resources)));
  }

  private async importProfile(): Promise<void> {
    const contents = await this.files.read({ filterName: "Perfil Manual", openLabel: "Importar perfil" });
    if (contents === null) return;
    const parsed = this.documents.deserialize(contents);
    if (!parsed.ok) {
      await this.sendNotice("error", parsed.error);
      return;
    }
    const profile = await this.portableResources.resolve(parsed.value.data);
    this.onPortableResourcesChanged();
    await this.sendState(await this.profileService.import(profile));
    await this.sendNotice("success", "Perfil importado.");
  }

  private async saveFromEditor(profile: ManualProfile, resources: ManualPortableResources | null): Promise<ManualProfileState> {
    const resolvedProfile = resources === null
      ? profile
      : await this.portableResources.resolve(this.requireBundle(createManualProfileBundle(profile, resources)));
    if (resources !== null) this.onPortableResourcesChanged();
    return this.profileService.save(resolvedProfile);
  }

  private requireBundle(bundle: ManualProfileBundle): ManualProfileBundle {
    const validation = decodeManualBundle(bundle);
    if (!validation.ok) throw new Error(validation.error);
    return validation.value;
  }

  private async sendState(state: ManualProfileState): Promise<void> {
    await this.post({
      type: "manual.state",
      state: { ...state, browser: this.browserActions.getSnapshot(), resources: await this.loadResourceCatalogs() }
    });
  }

  private async loadResourceCatalogs() {
    const [arrays] = await Promise.all([this.arrayService.getAll()]);
    return { formulas: this.formulaService.getSummaries(), arrays };
  }

  private async sendNotice(tone: "info" | "success" | "warning" | "error", message: string): Promise<void> {
    if (tone === "success") this.logger.info(`[Manual] [OK] ${message}`);
    else if (tone === "warning") { this.logger.warn(`[Manual] [AVISO] ${message}`); this.logger.show(); }
    else if (tone === "error") { this.logger.error(`[Manual] [ERROR] ${message}`); this.logger.show(); }
    else this.logger.info(`[Manual] ${message}`);
    await this.post({ type: "manual.notice", tone, message });
  }

  private browserActionDescription(message: ManualToExtensionMessage): string | null {
    switch (message.type) {
      case "browser.open": return "Abriendo la URL del perfil.";
      case "browser.start": return "Iniciando una sesión limpia del navegador.";
      case "browser.restart": return "Reiniciando el navegador con una sesión limpia.";
      case "browser.stop": return message.force ? "Deteniendo el navegador a la fuerza." : "Deteniendo el navegador.";
      case "browser.selectPage": return "Cambiando la pestaña activa.";
      case "browser.closePage": return "Cerrando una pestaña.";
      case "browser.apply": return `Aplicando ${this.actionTargetLabel(message.target)}.`;
      case "browser.syncOverrides": return "Sincronizando request overrides.";
      case "browser.resetGenerators": return "Reseteando los valores aplicados a campos.";
      case "browser.selectElement": return "Esperando la selección de un elemento en el navegador.";
      case "browser.previewGenerator": return "Generando una muestra.";
      default: return null;
    }
  }

  private actionTargetLabel(target: "headers" | "cookies" | "localStorage" | "sessionStorage" | "overrides" | "generators"): string {
    switch (target) {
      case "headers": return "headers";
      case "cookies": return "cookies";
      case "localStorage": return "localStorage";
      case "sessionStorage": return "sessionStorage";
      case "overrides": return "request overrides";
      case "generators": return "campos y generadores";
    }
  }

  private async post(message: ExtensionToManualMessage): Promise<void> {
    await this.panel?.webview.postMessage(message);
  }
}
