import * as vscode from "vscode";
import type { ArrayResourceService } from "../../application/arrays/arrayResourceService";
import { ImportExportDocumentService, decodeResourceCollection } from "../../application/importExport/importExportDocumentService";
import type { ArrayResource } from "../../domain/arrays/arrayResource";
import { ArrayValueGenerator } from "../../domain/arrays/arrayValueGenerator";
import { isArrayResource } from "../../infrastructure/persistence/arrayResourceSerializer";
import { isArrayToExtensionMessage, type ArrayToExtensionMessage, type ExtensionToArrayMessage } from "../../shared/messages/arrayMessages";
import { createWebviewHtml } from "../webview/createWebviewHtml";
import { JsonImportExportFileService } from "../importExport/jsonImportExportFileService";

export class ArraysPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly documents = new ImportExportDocumentService("browser-control-center/arrays", decodeResourceCollection(isArrayResource, "arrays"));
  private readonly files = new JsonImportExportFileService();
  private readonly generator = new ArrayValueGenerator();

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly service: ArrayResourceService,
    private readonly onResourcesChanged: () => void
  ) {}

  public open(): void {
    if (this.panel !== null) { this.panel.reveal(vscode.ViewColumn.One); return; }
    const panel = vscode.window.createWebviewPanel("browserControl.arrays", "Arrays", vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")]
    });
    this.panel = panel;
    panel.webview.html = createWebviewHtml(panel.webview, this.extensionUri, "arrays", "Arrays");
    panel.onDidDispose(() => { this.panel = null; }, undefined, this.disposables);
    panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!isArrayToExtensionMessage(message)) { void this.notice("error", "Mensaje de Arrays no válido."); return; }
      void this.handle(message);
    }, undefined, this.disposables);
  }

  public dispose(): void { this.panel?.dispose(); for (const disposable of this.disposables) disposable.dispose(); }
  public async refreshState(): Promise<void> { if (this.panel !== null) await this.state(await this.service.getInitialState()); }

  private async handle(message: ArrayToExtensionMessage): Promise<void> {
    try {
      switch (message.type) {
        case "array.ready": await this.state(await this.service.getInitialState()); break;
        case "array.new": await this.state(this.service.createDraft()); break;
        case "array.select": await this.state(await this.service.select(message.id)); break;
        case "array.save":
          await this.state(await this.service.save(message.resource));
          this.onResourcesChanged();
          await this.notice("success", "Array guardado.");
          break;
        case "array.deleteSelected": await this.deleteSelected(message.ids); break;
        case "array.import": await this.importResources(); break;
        case "array.export": await this.exportResource(message.resource); break;
        case "array.viewJson": await this.post({ type: "array.jsonDocument", serialized: this.documents.serialize([message.resource]) }); break;
        case "array.applyJson": {
          const parsed = this.documents.deserialize(message.serialized);
          if (!parsed.ok) throw new Error(parsed.error);
          if (parsed.value.data.length !== 1) throw new Error("El documento debe contener exactamente un array.");
          const resource = parsed.value.data[0];
          if (resource === undefined) throw new Error("El documento no contiene ningún array.");
          if (resource.id !== message.currentId) throw new Error("El ID del array no se puede cambiar desde el editor JSON.");
          await this.post({ type: "array.jsonApplied", resource });
          await this.notice("success", "JSON validado y cargado como cambios sin guardar.");
          break;
        }
        case "array.test": {
          const value = this.generator.pick(message.resource.items);
          if (value === undefined) {
            await this.notice("warning", "Sin resultado: el array está vacío.");
            break;
          }
          const valueType = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
          await this.notice("success", `Resultado (${valueType}): ${JSON.stringify(value)}`);
          break;
        }
      }
    } catch (error: unknown) {
      await this.notice("error", error instanceof Error ? error.message : "Error inesperado en Arrays.");
    }
  }

  private async deleteSelected(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) { await this.notice("info", "Selecciona al menos un array."); return; }
    const answer = await vscode.window.showWarningMessage(
      `¿Eliminar ${ids.length === 1 ? "el array seleccionado" : `los ${ids.length} arrays seleccionados`}?`,
      { modal: true, detail: "Las referencias desde Manual quedarán marcadas como no disponibles." },
      "Eliminar"
    );
    if (answer !== "Eliminar") return;
    await this.state(await this.service.deleteSelected(ids));
    this.onResourcesChanged();
    await this.notice("success", "Arrays eliminados.");
  }

  private async importResources(): Promise<void> {
    const contents = await this.files.read({ filterName: "Documento de arrays", openLabel: "Importar arrays" });
    if (contents === null) return;
    const parsed = this.documents.deserialize(contents);
    if (!parsed.ok) { await this.notice("error", parsed.error); return; }
    await this.state(await this.service.importMany(parsed.value.data));
    this.onResourcesChanged();
    await this.notice("success", "Arrays importados.");
  }

  private async exportResource(resource: ArrayResource): Promise<void> {
    const exported = await this.files.write(this.documents.serialize([resource]), { suggestedName: resource.name, suffix: ".arrays.json", filterName: "Documento de arrays", saveLabel: "Exportar array" });
    if (!exported) return;
    await this.notice("success", "Array exportado.");
  }

  private async state(state: Awaited<ReturnType<ArrayResourceService["getInitialState"]>>): Promise<void> { await this.post({ type: "array.state", state }); }
  private async notice(tone: "info" | "success" | "warning" | "error", message: string): Promise<void> { await this.post({ type: "array.notice", tone, message }); }
  private async post(message: ExtensionToArrayMessage): Promise<void> { await this.panel?.webview.postMessage(message); }
}
