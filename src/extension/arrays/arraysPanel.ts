import { t } from "../../localization";
import * as vscode from "vscode";
import type { ArrayResourceService } from "../../application/arrays/arrayResourceService";
import { ImportExportDocumentService, decodeResourceCollection } from "../../application/importExport/importExportDocumentService";
import type { ArrayResource } from "../../domain/arrays/arrayResource";
import { ArrayValueGenerator } from "../../domain/arrays/arrayValueGenerator";
import { isArrayResource, arrayResourceCodec } from "../../infrastructure/persistence/arrayResourceSerializer";
import { isArrayToExtensionMessage, type ArrayToExtensionMessage, type ExtensionToArrayMessage } from "../../shared/messages/arrayMessages";
import { createWebviewHtml } from "../webview/createWebviewHtml";
import { JsonImportExportFileService } from "../importExport/jsonImportExportFileService";

export class ArraysPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly documents = new ImportExportDocumentService("browser-control-center/arrays", decodeResourceCollection(isArrayResource, "arrays", arrayResourceCodec));
  private readonly files = new JsonImportExportFileService();
  private readonly generator = new ArrayValueGenerator();

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly service: ArrayResourceService,
    private readonly onResourcesChanged: () => void
  ) {}

  public open(): void {
    if (this.panel !== null) { this.panel.reveal(vscode.ViewColumn.One); return; }
    const panel = vscode.window.createWebviewPanel("browserControl.arrays", t("navigation.arrays"), vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")]
    });
    this.panel = panel;
    panel.webview.html = createWebviewHtml(panel.webview, this.extensionUri, "arrays", t("navigation.arrays"));
    const messageSubscription = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!isArrayToExtensionMessage(message)) { void this.notice("error", t("text.invalidArraysMessage")); return; }
      void this.handle(message);
    });
    panel.onDidDispose(() => { messageSubscription.dispose(); this.panel = null; });
  }

  public dispose(): void { this.panel?.dispose(); for (const disposable of this.disposables) disposable.dispose(); }
  public async refreshResourceCatalogs(): Promise<void> {
    if (this.panel !== null) await this.post({ type: "array.resources", resources: await this.service.getSummaries() });
  }

  private async handle(message: ArrayToExtensionMessage): Promise<void> {
    try {
      switch (message.type) {
        case "array.ready": await this.state(await this.service.getInitialState()); break;
        case "array.new": await this.service.refreshCatalog(); await this.state(this.service.createDraft()); break;
        case "array.select": await this.state(await this.service.select(message.id)); break;
        case "array.save":
          await this.state(await this.service.save(message.resource), message.requestId);
          this.onResourcesChanged();
          await this.notice("success", t("text.arraySaved"));
          break;
        case "array.deleteSelected": await this.deleteSelected(message.ids); break;
        case "array.import": await this.importResources(); break;
        case "array.export": await this.exportResource(message.resource); break;
        case "array.viewJson": await this.post({ type: "array.jsonDocument", serialized: this.documents.serialize([message.resource]) }); break;
        case "array.applyJson": {
          const parsed = this.documents.deserialize(message.serialized);
          if (!parsed.ok) throw new Error(parsed.error);
          if (parsed.value.data.length !== 1) throw new Error(t("text.theDocumentMustContainExactlyOneArray"));
          const resource = parsed.value.data[0];
          if (resource === undefined) throw new Error(t("text.theDocumentDoesNotContainAnyArrays"));
          if (resource.id !== message.currentId) throw new Error(t("text.theArrayIDCannotBeChangedInTheJSONEditor"));
          await this.post({ type: "array.jsonApplied", resource });
          await this.notice("success", t("text.jsonValidatedAndLoadedAsUnsavedChanges"));
          break;
        }
        case "array.test": {
          const value = this.generator.pick(message.resource.items);
          if (value === undefined) {
            await this.notice("warning", t("text.noResultTheArrayIsEmpty"));
            break;
          }
          const valueType = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
          await this.notice("success", t("text.resultArg0Arg1", { arg0: valueType, arg1: JSON.stringify(value) }));
          break;
        }
      }
    } catch (error: unknown) {
      if (message.type === "array.save" && message.requestId !== undefined) {
        await this.post({ type: "array.saveFailed", requestId: message.requestId, error: error instanceof Error ? error.message : t("text.couldNotSave") });
      }
      await this.notice("error", error instanceof Error ? error.message : t("text.unexpectedErrorInArrays"));
    }
  }

  private async deleteSelected(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) { await this.post({ type: "array.operationCanceled" }); await this.notice("info", t("text.selectAtLeastOneArray")); return; }
    const answer = await vscode.window.showWarningMessage(
      t("text.deleteArg0", { arg0: ids.length === 1 ? t("text.theSelectedArray") : t("text.theArg0SelectedArrays", { arg0: ids.length }) }),
      { modal: true, detail: t("text.referencesFromManualWillBeMarkedAsUnavailable") },
      t("actions.delete")
    );
    if (answer !== t("actions.delete")) { await this.post({ type: "array.operationCanceled" }); return; }
    await this.state(await this.service.deleteSelected(ids));
    this.onResourcesChanged();
    await this.notice("success", t("text.arraysDeleted"));
  }

  private async importResources(): Promise<void> {
    const contents = await this.files.read({ filterName: t("text.arraysDocument"), openLabel: t("text.importArrays") });
    if (contents === null) { await this.post({ type: "array.operationCanceled" }); return; }
    const parsed = this.documents.deserialize(contents);
    if (!parsed.ok) { await this.notice("error", parsed.error); return; }
    await this.state(await this.service.importMany(parsed.value.data));
    this.onResourcesChanged();
    await this.notice("success", t("text.arraysImported"));
  }

  private async exportResource(resource: ArrayResource): Promise<void> {
    const exported = await this.files.write(this.documents.serialize([resource]), { suggestedName: resource.name, suffix: ".arrays.json", filterName: t("text.arraysDocument"), saveLabel: t("text.exportArray") });
    if (!exported) return;
    await this.notice("success", t("text.arrayExported"));
  }

  private async state(state: Awaited<ReturnType<ArrayResourceService["getInitialState"]>>, requestId?: string): Promise<void> {
    await this.post(requestId === undefined ? { type: "array.state", state } : { type: "array.saved", requestId, state });
  }
  private async notice(tone: "info" | "success" | "warning" | "error", message: string): Promise<void> { await this.post({ type: "array.notice", tone, message }); }
  private async post(message: ExtensionToArrayMessage): Promise<void> { await this.panel?.webview.postMessage(message); }
}
