import * as vscode from "vscode";
import type { AutomationService } from "../../application/automations/automationService";
import { AutomationExecutionCoordinator } from "../../application/automations/automationExecutionCoordinator";
import { ImportExportDocumentService, decodeWithGuard } from "../../application/importExport/importExportDocumentService";
import type { NodeRegistry } from "../../application/automations/nodeRegistry";
import type { ProcessRunner } from "../../application/automations/processRunner";
import { validateAutomationDocument } from "../../domain/automations/automationValidation";
import { deserializeAutomation, isAutomationDocument } from "../../infrastructure/persistence/automationSerializer";
import { isAutomationToExtensionMessage, type AutomationJsonScope, type AutomationToExtensionMessage, type ExtensionToAutomationMessage } from "../../shared/messages/automationMessages";
import { createWebviewHtml } from "../webview/createWebviewHtml";
import type { FormulaService } from "../../application/formulas/formulaService";
import type { ArrayResourceService } from "../../application/arrays/arrayResourceService";
import type { BrowserActionsService } from "../../application/manual/browserActionsService";
import type { BrowserAutomationLogger } from "../logging/browserAutomationLogger";
import { confirmDestructiveAction } from "../webview/confirmDestructiveAction";
import { JsonImportExportFileService } from "../importExport/jsonImportExportFileService";

export class AutomationsPanelManager implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private readonly coordinator: AutomationExecutionCoordinator;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly documents = new ImportExportDocumentService(
    "browser-control-center/automations",
    decodeWithGuard(isAutomationDocument, "La automatización importada no tiene una estructura válida."),
    deserializeAutomation
  );
  private readonly files = new JsonImportExportFileService();

  public constructor(private readonly extensionUri: vscode.Uri, private readonly service: AutomationService, private readonly registry: NodeRegistry, runner: ProcessRunner, private readonly formulas: FormulaService, private readonly arrays: ArrayResourceService, private readonly browserActions: BrowserActionsService, private readonly logger: BrowserAutomationLogger) {
    this.coordinator = new AutomationExecutionCoordinator(runner, {
      onProcess: (snapshot) => { void this.post({ type: "automation.processState", snapshot }); },
      onGroup: (summary) => { void this.post({ type: "automation.groupState", summary }); }
    }, logger);
  }

  public open(): void {
    if (this.panel !== null) { this.panel.reveal(vscode.ViewColumn.One); return; }
    const panel = vscode.window.createWebviewPanel("browserControl.automations", "Automatizaciones", vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")] });
    this.panel = panel; panel.webview.html = createWebviewHtml(panel.webview, this.extensionUri, "automations", "Automatizaciones");
    panel.onDidDispose(() => { if (this.coordinator.isRunning()) this.coordinator.forceStop(); this.panel = null; }, undefined, this.disposables);
    panel.webview.onDidReceiveMessage((value: unknown) => { if (!isAutomationToExtensionMessage(value)) { void this.notice("error", "Mensaje de Automatizaciones no válido."); return; } void this.handle(value); }, undefined, this.disposables);
  }
  public async refreshResourceCatalogs(): Promise<void> { await this.post({ type: "automation.resources", resources: this.resourceCatalogs() }); }
  public dispose(): void { if (this.coordinator.isRunning()) this.coordinator.forceStop(); this.panel?.dispose(); for (const disposable of this.disposables) disposable.dispose(); }

  private async handle(message: AutomationToExtensionMessage): Promise<void> {
    try {
      switch (message.type) {
        case "ui.confirmDestructiveAction": {
          const confirmed = await confirmDestructiveAction(message.confirmation);
          await this.post({ type: "ui.destructiveActionConfirmed", requestId: message.requestId, confirmed });
          break;
        }
        case "automation.ready": await this.state(this.service.get()); break;
        case "automation.save": await this.state(await this.service.save(message.document)); await this.notice("success", "Automatización guardada."); break;
        case "automation.import": await this.importDocument(); break;
        case "automation.export": await this.exportDocument(message.document); break;
        case "automation.viewJson": {
          const document = this.validatedScope(message.document, message.scope);
          await this.post({ type: "automation.jsonDocument", serialized: this.documents.serialize(document), scope: message.scope });
          break;
        }
        case "automation.applyJson": {
          const parsed = this.documents.deserialize(message.serialized);
          if (!parsed.ok) throw new Error(parsed.error);
          const document = this.validatedScope(parsed.value.data, message.scope);
          await this.post({ type: "automation.jsonApplied", document, scope: message.scope });
          await this.notice("success", "JSON validado y cargado como cambios sin guardar.");
          break;
        }
        case "automation.runGroup": {
          const document = this.validated(message.document); const group = document.groups.find(({ id }) => id === message.groupId); if (group === undefined) throw new Error("El grupo ya no existe.");
          this.logger.prepareForExecution();
          await this.coordinator.runGroup(group); break;
        }
        case "automation.runProcess": {
          const document = this.validated(message.document); const group = document.groups.find(({ id }) => id === message.groupId); const process = group?.processes.find(({ id }) => id === message.processId);
          if (group === undefined || process === undefined) throw new Error("El proceso ya no existe."); this.logger.prepareForExecution(); await this.coordinator.runProcess(group, process); break;
        }
        case "automation.pause": this.coordinator.pause(); await this.notice("info", "La ejecución se pausará antes del siguiente nodo."); break;
        case "automation.resume": this.coordinator.resume(); await this.notice("info", "Ejecución reanudada."); break;
        case "automation.stop": if (message.force) this.coordinator.forceStop(); else this.coordinator.stop(); break;
        case "automation.continueUser": this.coordinator.continueUser(message.nodeId); break;
        case "automation.retryUser": this.coordinator.retryUser(message.nodeId); break;
        case "automation.selectElement": {
          const result = await this.browserActions.selectElement();
          if (!result.ok) { await this.notice("warning", result.error); break; }
          await this.post({ type: "automation.elementSelected", nodeId: message.nodeId, fieldKey: message.fieldKey, selector: result.value });
          break;
        }
        case "automation.validateNode": { const result = this.registry.validate(message.nodeType, message.config); await this.post({ type: "automation.nodeValidation", requestId: message.requestId, nodeId: message.nodeId, error: result.ok ? null : result.error }); break; }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "La acción de automatización ha fallado.";
      this.logger.error(`[Automatizaciones] [ERROR] ${message}`, error);
      await this.notice("error", message);
    }
  }

  private validated(document: Parameters<AutomationService["save"]>[0]) {
    const result = validateAutomationDocument(document, this.registry); if (!result.ok) throw new Error(result.error); return result.value;
  }
  private validatedScope(document: Parameters<AutomationService["save"]>[0], scope: AutomationJsonScope) {
    const validated = this.validated(document);
    if (validated.groups.length !== 1) throw new Error("El JSON seleccionado debe contener exactamente un grupo.");
    const group = validated.groups[0];
    if (group === undefined) throw new Error("El JSON seleccionado no contiene ningún grupo.");
    if (scope.kind === "process") {
      if (group.processes.length !== 1) throw new Error("El JSON del flujo debe contener exactamente un proceso.");
    }
    return validated;
  }
  private async importDocument(): Promise<void> {
    const contents = await this.files.read({ filterName: "Automatización", openLabel: "Importar automatización" });
    if (contents === null) return;
    const parsed = this.documents.deserialize(contents); if (!parsed.ok) throw new Error(parsed.error);
    const groupCount = parsed.value.data.groups.length;
    await this.state(await this.service.import(parsed.value.data)); await this.notice("success", `${groupCount} ${groupCount === 1 ? "grupo importado" : "grupos importados"} sin reemplazar los existentes.`);
  }
  private async exportDocument(document: Parameters<AutomationService["save"]>[0]): Promise<void> {
    const exported = await this.files.write(this.documents.serialize(this.validated(document)), {
      suggestedName: document.name,
      suffix: ".automation.json",
      filterName: "Automatización",
      saveLabel: "Exportar automatización"
    });
    if (!exported) return;
    await this.notice("success", "Automatización exportada.");
  }
  private async state(document: ReturnType<AutomationService["get"]>): Promise<void> { await this.post({ type: "automation.state", document, descriptors: this.registry.descriptors(), resources: this.resourceCatalogs() }); }
  private resourceCatalogs() { return { formulas: this.formulas.getSummaries(), arrays: this.arrays.getSummaries() }; }
  private async notice(tone: "info" | "success" | "warning" | "error", message: string): Promise<void> { await this.post({ type: "automation.notice", tone, message }); }
  private async post(message: ExtensionToAutomationMessage): Promise<void> { await this.panel?.webview.postMessage(message); }
}
