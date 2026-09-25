import * as vscode from "vscode";
import type { ArrayResourceService } from "../../application/arrays/arrayResourceService";
import { ImportExportDocumentService, decodeWithGuard } from "../../application/importExport/importExportDocumentService";
import type { FormulaService } from "../../application/formulas/formulaService";
import type { BrowserActionsService } from "../../application/manual/browserActionsService";
import type { ManualProfileService, ManualProfileState } from "../../application/manual/manualProfileService";
import { deserializeProfile, isManualProfile } from "../../infrastructure/persistence/profileSerializer";
import {
  isManualToExtensionMessage,
  type ExtensionToManualMessage,
  type ManualStatePayload,
  type ManualToExtensionMessage
} from "../../shared/messages/manualMessages";
import { createWebviewHtml } from "../webview/createWebviewHtml";
import { confirmDestructiveAction } from "../webview/confirmDestructiveAction";
import { JsonImportExportFileService } from "../importExport/jsonImportExportFileService";

export class ManualPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly documents = new ImportExportDocumentService(
    "browser-control-center/manual-profile",
    decodeWithGuard(isManualProfile, "El perfil importado no tiene una estructura válida."),
    deserializeProfile
  );
  private readonly files = new JsonImportExportFileService();

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly profileService: ManualProfileService,
    private readonly browserActions: BrowserActionsService,
    private readonly formulaService: FormulaService,
    private readonly arrayService: ArrayResourceService
  ) {
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
    panel.onDidDispose(() => { this.panel = null; }, undefined, this.disposables);
    panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!isManualToExtensionMessage(message)) {
        void this.sendNotice("error", "Se recibió un mensaje no válido desde la vista Manual.");
        return;
      }
      void this.handleMessage(message);
    }, undefined, this.disposables);
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
          await this.sendState(await this.profileService.save(message.profile));
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
          await this.exportProfile(message.profile);
          break;
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
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? "Chromium iniciado con una sesión limpia." : result.error);
          break;
        }
        case "browser.restart": {
          const result = await this.browserActions.restart(message.profile);
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? "Chromium reiniciado con una sesión limpia." : result.error);
          break;
        }
        case "browser.stop": {
          const result = await this.browserActions.stop(message.force);
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? "Chromium detenido." : result.error);
          break;
        }
        case "browser.selectPage": {
          const result = await this.browserActions.selectPage(message.pageId);
          if (!result.ok) await this.sendNotice("warning", result.error);
          break;
        }
        case "browser.closePage": {
          const result = await this.browserActions.closePage(message.pageId);
          if (!result.ok) await this.sendNotice("warning", result.error);
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
      await this.sendNotice("error", error instanceof Error ? error.message : "Se ha producido un error inesperado.");
    }
  }

  private async exportProfile(profile: ManualStatePayload["profile"]): Promise<void> {
    const exported = await this.files.write(this.documents.serialize(profile), {
      suggestedName: profile.name,
      suffix: ".manual-profile.json",
      filterName: "Perfil Manual",
      saveLabel: "Exportar perfil"
    });
    if (!exported) return;
    await this.sendNotice("success", "Perfil exportado.");
  }

  private async importProfile(): Promise<void> {
    const contents = await this.files.read({ filterName: "Perfil Manual", openLabel: "Importar perfil" });
    if (contents === null) return;
    const parsed = this.documents.deserialize(contents);
    if (!parsed.ok) {
      await this.sendNotice("error", parsed.error);
      return;
    }
    await this.sendState(await this.profileService.import(parsed.value.data));
    await this.sendNotice("success", "Perfil importado.");
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
    await this.post({ type: "manual.notice", tone, message });
  }

  private async post(message: ExtensionToManualMessage): Promise<void> {
    await this.panel?.webview.postMessage(message);
  }
}
