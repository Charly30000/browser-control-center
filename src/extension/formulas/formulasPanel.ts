import * as vscode from "vscode";
import type { FormulaExecutionService } from "../../application/formulas/formulaExecutionService";
import type { FormulaService } from "../../application/formulas/formulaService";
import { ResourceDocumentService } from "../../application/resources/resourceDocumentService";
import { EXAMPLE_FORMULA_CODE, type FormulaResource } from "../../domain/formulas/formula";
import { isFormulaResource } from "../../infrastructure/persistence/formulaSerializer";
import {
  isFormulaToExtensionMessage,
  type ExtensionToFormulaMessage,
  type FormulaToExtensionMessage
} from "../../shared/messages/formulaMessages";
import { createWebviewHtml } from "../webview/createWebviewHtml";

export class FormulasPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly documents = new ResourceDocumentService("browser-control-center/formulas", isFormulaResource);

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
    panel.onDidDispose(() => { this.panel = null; }, undefined, this.disposables);
    panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!isFormulaToExtensionMessage(message)) { void this.notice("error", "Mensaje de Fórmulas no válido."); return; }
      void this.handle(message);
    }, undefined, this.disposables);
  }

  public dispose(): void { this.panel?.dispose(); for (const disposable of this.disposables) disposable.dispose(); }

  private async handle(message: FormulaToExtensionMessage): Promise<void> {
    try {
      switch (message.type) {
        case "formula.ready": await this.state(await this.service.getInitialState()); break;
        case "formula.new": await this.state(this.service.createDraft()); break;
        case "formula.select": await this.state(await this.service.select(message.id)); break;
        case "formula.save":
          await this.state(await this.service.save(message.resource));
          this.onResourcesChanged();
          await this.notice("success", "Fórmula guardada.");
          break;
        case "formula.deleteSelected": await this.deleteSelected(message.ids); break;
        case "formula.import": await this.importResources(); break;
        case "formula.export": await this.exportResource(message.resource); break;
        case "formula.generateExample": {
          const example = this.service.createDraft();
          example.resource.code = EXAMPLE_FORMULA_CODE;
          await this.state(example);
          await this.notice("success", "Ejemplo cargado en el editor. Puedes modificarlo y guardarlo.");
          break;
        }
        case "formula.test": {
          const result = await this.execution.execute(message.resource);
          await this.notice(result.ok ? "success" : "info", result.ok ? `Resultado (${result.value.valueType}): ${JSON.stringify(result.value.value)}` : result.error);
          break;
        }
      }
    } catch (error: unknown) {
      await this.notice("error", error instanceof Error ? error.message : "Error inesperado en Fórmulas.");
    }
  }

  private async deleteSelected(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) { await this.notice("info", "Selecciona al menos una fórmula."); return; }
    const answer = await vscode.window.showWarningMessage(
      `¿Eliminar ${ids.length === 1 ? "la fórmula seleccionada" : `las ${ids.length} fórmulas seleccionadas`}?`,
      { modal: true, detail: "Las referencias desde Manual quedarán marcadas como no disponibles." },
      "Eliminar"
    );
    if (answer !== "Eliminar") return;
    await this.state(await this.service.deleteSelected(ids));
    this.onResourcesChanged();
    await this.notice("success", "Fórmulas eliminadas.");
  }

  private async importResources(): Promise<void> {
    const files = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { "Documento de fórmulas": ["json"] }, openLabel: "Importar fórmulas" });
    const file = files?.[0];
    if (file === undefined) return;
    const parsed = this.documents.deserialize(new TextDecoder().decode(await vscode.workspace.fs.readFile(file)));
    if (!parsed.ok) { await this.notice("error", parsed.error); return; }
    await this.state(await this.service.importMany(parsed.value.data));
    this.onResourcesChanged();
    await this.notice("success", "Fórmulas importadas.");
  }

  private async exportResource(resource: FormulaResource): Promise<void> {
    const target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(`${resource.name}.formulas.json`), filters: { "Documento de fórmulas": ["json"] }, saveLabel: "Exportar fórmula" });
    if (target === undefined) return;
    await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(this.documents.serialize([resource])));
    await this.notice("success", "Fórmula exportada.");
  }

  private async state(state: Awaited<ReturnType<FormulaService["getInitialState"]>>): Promise<void> { await this.post({ type: "formula.state", state }); }
  private async notice(tone: "info" | "success" | "warning" | "error", message: string): Promise<void> { await this.post({ type: "formula.notice", tone, message }); }
  private async post(message: ExtensionToFormulaMessage): Promise<void> { await this.panel?.webview.postMessage(message); }
}
