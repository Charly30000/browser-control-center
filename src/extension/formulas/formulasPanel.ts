import * as vscode from "vscode";
import type { FormulaExecutionService } from "../../application/formulas/formulaExecutionService";
import type { FormulaService } from "../../application/formulas/formulaService";
import { ImportExportDocumentService, decodeResourceCollection } from "../../application/importExport/importExportDocumentService";
import { EXAMPLE_FORMULA_CODE, type FormulaResource } from "../../domain/formulas/formula";
import { isFormulaResource } from "../../infrastructure/persistence/formulaSerializer";
import {
  isFormulaToExtensionMessage,
  type ExtensionToFormulaMessage,
  type FormulaToExtensionMessage
} from "../../shared/messages/formulaMessages";
import { createWebviewHtml } from "../webview/createWebviewHtml";
import { JsonImportExportFileService } from "../importExport/jsonImportExportFileService";

export class FormulasPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly documents = new ImportExportDocumentService("browser-control-center/formulas", decodeResourceCollection(isFormulaResource, "fórmulas"));
  private readonly files = new JsonImportExportFileService();

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly service: FormulaService,
    private readonly execution: FormulaExecutionService,
    private readonly onResourcesChanged: () => void
  ) {}

  public open(): void {
    if (this.panel !== null) { this.panel.reveal(vscode.ViewColumn.One); return; }
    const panel = vscode.window.createWebviewPanel("browserControl.formulas", "Fórmulas", vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")]
    });
    this.panel = panel;
    panel.webview.html = createWebviewHtml(panel.webview, this.extensionUri, "formulas", "Fórmulas");
    const messageSubscription = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!isFormulaToExtensionMessage(message)) { void this.notice("error", "Mensaje de Fórmulas no válido."); return; }
      void this.handle(message);
    });
    panel.onDidDispose(() => { messageSubscription.dispose(); this.panel = null; });
  }

  public dispose(): void { this.panel?.dispose(); for (const disposable of this.disposables) disposable.dispose(); }
  public async refreshResourceCatalogs(): Promise<void> {
    if (this.panel !== null) await this.post({ type: "formula.resources", resources: this.service.getSummaries() });
  }

  private async handle(message: FormulaToExtensionMessage): Promise<void> {
    try {
      switch (message.type) {
        case "formula.ready": await this.state(await this.service.getInitialState()); break;
        case "formula.new": await this.state(this.service.createDraft()); break;
        case "formula.select": await this.state(await this.service.select(message.id)); break;
        case "formula.save":
          await this.state(await this.service.save(message.resource), message.requestId);
          this.onResourcesChanged();
          await this.notice("success", "Fórmula guardada.");
          break;
        case "formula.deleteSelected": await this.deleteSelected(message.ids); break;
        case "formula.import": await this.importResources(); break;
        case "formula.export": await this.exportResource(message.resource); break;
        case "formula.viewJson": await this.post({ type: "formula.jsonDocument", serialized: this.documents.serialize([message.resource]) }); break;
        case "formula.applyJson": {
          const parsed = this.documents.deserialize(message.serialized);
          if (!parsed.ok) throw new Error(parsed.error);
          if (parsed.value.data.length !== 1) throw new Error("El documento debe contener exactamente una fórmula.");
          const resource = parsed.value.data[0];
          if (resource === undefined) throw new Error("El documento no contiene ninguna fórmula.");
          if (resource.id !== message.currentId) throw new Error("El ID de la fórmula no se puede cambiar desde el editor JSON.");
          await this.post({ type: "formula.jsonApplied", resource });
          await this.notice("success", "JSON validado y cargado como cambios sin guardar.");
          break;
        }
        case "formula.generateExample": {
          const example = this.service.createDraft();
          example.resource.code = EXAMPLE_FORMULA_CODE;
          await this.state(example);
          await this.notice("success", "Ejemplo cargado en el editor. Puedes modificarlo y guardarlo.");
          break;
        }
        case "formula.test": {
          const result = await this.execution.execute(message.resource);
          await this.notice(result.ok ? "success" : "warning", result.ok
            ? `Resultado (${result.value.valueType}, ${result.value.durationMs.toFixed(1)} ms): ${result.value.value === undefined ? "undefined" : JSON.stringify(result.value.value)}`
            : result.error);
          break;
        }
      }
    } catch (error: unknown) {
      if (message.type === "formula.save" && message.requestId !== undefined) {
        await this.post({ type: "formula.saveFailed", requestId: message.requestId, error: error instanceof Error ? error.message : "No se pudo guardar." });
      }
      await this.notice("error", error instanceof Error ? error.message : "Error inesperado en Fórmulas.");
    }
  }

  private async deleteSelected(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) { await this.post({ type: "formula.operationCanceled" }); await this.notice("info", "Selecciona al menos una fórmula."); return; }
    const answer = await vscode.window.showWarningMessage(
      `¿Eliminar ${ids.length === 1 ? "la fórmula seleccionada" : `las ${ids.length} fórmulas seleccionadas`}?`,
      { modal: true, detail: "Las referencias desde Manual quedarán marcadas como no disponibles." },
      "Eliminar"
    );
    if (answer !== "Eliminar") { await this.post({ type: "formula.operationCanceled" }); return; }
    await this.state(await this.service.deleteSelected(ids));
    this.onResourcesChanged();
    await this.notice("success", "Fórmulas eliminadas.");
  }

  private async importResources(): Promise<void> {
    const contents = await this.files.read({ filterName: "Documento de fórmulas", openLabel: "Importar fórmulas" });
    if (contents === null) { await this.post({ type: "formula.operationCanceled" }); return; }
    const parsed = this.documents.deserialize(contents);
    if (!parsed.ok) { await this.notice("error", parsed.error); return; }
    await this.state(await this.service.importMany(parsed.value.data));
    this.onResourcesChanged();
    await this.notice("success", "Fórmulas importadas.");
  }

  private async exportResource(resource: FormulaResource): Promise<void> {
    const exported = await this.files.write(this.documents.serialize([resource]), { suggestedName: resource.name, suffix: ".formulas.json", filterName: "Documento de fórmulas", saveLabel: "Exportar fórmula" });
    if (!exported) return;
    await this.notice("success", "Fórmula exportada.");
  }

  private async state(state: Awaited<ReturnType<FormulaService["getInitialState"]>>, requestId?: string): Promise<void> {
    await this.post(requestId === undefined ? { type: "formula.state", state } : { type: "formula.saved", requestId, state });
  }
  private async notice(tone: "info" | "success" | "warning" | "error", message: string): Promise<void> { await this.post({ type: "formula.notice", tone, message }); }
  private async post(message: ExtensionToFormulaMessage): Promise<void> { await this.panel?.webview.postMessage(message); }
}
