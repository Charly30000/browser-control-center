import { t } from "../../localization";
import * as vscode from "vscode";
import type { AutomationService } from "../../application/automations/automationService";
import { AutomationExecutionCoordinator } from "../../application/automations/automationExecutionCoordinator";
import { ImportExportDocumentService, decodeWithCodec } from "../../application/importExport/importExportDocumentService";
import type { NodeRegistry } from "../../application/automations/nodeRegistry";
import type { ProcessRunner } from "../../application/automations/processRunner";
import { validateAutomationDocument } from "../../domain/automations/automationValidation";
import { deserializeAutomation, serializeAutomation } from "../../infrastructure/persistence/automationSerializer";
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
    decodeWithCodec({ serialize: serializeAutomation, deserialize: deserializeAutomation }),
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
    const panel = vscode.window.createWebviewPanel("browserControl.automations", t("navigation.automations"), vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")] });
    this.panel = panel; panel.webview.html = createWebviewHtml(panel.webview, this.extensionUri, "automations", t("navigation.automations"));
    const messageSubscription = panel.webview.onDidReceiveMessage((value: unknown) => { if (!isAutomationToExtensionMessage(value)) { void this.notice("error", t("text.invalidAutomationsMessage")); return; } void this.handle(value); });
    panel.onDidDispose(() => { messageSubscription.dispose(); if (this.coordinator.isRunning()) this.coordinator.forceStop(); this.panel = null; });
  }
  public async refreshResourceCatalogs(): Promise<void> { await this.post({ type: "automation.resources", resources: await this.resourceCatalogs() }); }
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
        case "automation.save": {
          const document = await this.service.save(message.document);
          if (message.requestId === undefined) await this.state(document);
          else await this.post({ type: "automation.saved", requestId: message.requestId, document });
          await this.notice("success", t("text.automationSaved"));
          break;
        }
        case "automation.import": await this.importDocument(); break;
        case "automation.export": await this.exportDocument(message.document); break;
        case "automation.viewJson": {
          const document = this.validatedScope(message.document, message.scope, false);
          await this.post({ type: "automation.jsonDocument", serialized: this.documents.serialize(document), scope: message.scope });
          break;
        }
        case "automation.applyJson": {
          const parsed = this.documents.deserialize(message.serialized);
          if (!parsed.ok) throw new Error(parsed.error);
          const document = this.validatedScope(parsed.value.data, message.scope);
          await this.post({ type: "automation.jsonApplied", document, scope: message.scope });
          await this.notice("success", t("text.jsonValidatedAndLoadedAsUnsavedChanges"));
          break;
        }
        case "automation.runGroup": {
          this.logger.prepareForExecution();
          this.logger.info(t("text.automationsSTARTPreparingGroupExecution"));
          const document = this.validated(message.document); const group = document.groups.find(({ id }) => id === message.groupId); if (group === undefined) throw new Error(t("text.theGroupNoLongerExists"));
          await this.coordinator.runGroup(group); break;
        }
        case "automation.runProcess": {
          this.logger.prepareForExecution();
          this.logger.info(t("text.automationsSTARTPreparingProcessExecution"));
          const document = this.validated(message.document); const group = document.groups.find(({ id }) => id === message.groupId); const process = group?.processes.find(({ id }) => id === message.processId);
          if (group === undefined || process === undefined) throw new Error(t("text.theProcessNoLongerExists")); await this.coordinator.runProcess(group, process); break;
        }
        case "automation.pause": this.coordinator.pause(); await this.notice("info", t("text.executionWillPauseBeforeTheNextNode")); break;
        case "automation.resume": this.coordinator.resume(); await this.notice("info", t("text.executionResumed")); break;
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
      const errorMessage = error instanceof Error ? error.message : t("text.theAutomationActionFailed");
      this.logger.error(`[Automatizaciones] [ERROR] ${errorMessage}`, error);
      if (message.type === "automation.save" && message.requestId !== undefined) {
        await this.post({ type: "automation.saveFailed", requestId: message.requestId, error: errorMessage });
      }
      await this.notice("error", errorMessage);
    }
  }

  private validated(document: Parameters<AutomationService["save"]>[0]) {
    const result = validateAutomationDocument(document, this.registry); if (!result.ok) throw new Error(result.error); return result.value;
  }
  private validatedDraft(document: Parameters<AutomationService["save"]>[0]) {
    const result = validateAutomationDocument(document, this.registry, { validateNodeConfigs: false }); if (!result.ok) throw new Error(result.error); return result.value;
  }
  private validatedScope(document: Parameters<AutomationService["save"]>[0], scope: AutomationJsonScope, validateNodeConfigs = true) {
    const validated = validateNodeConfigs ? this.validated(document) : this.validatedDraft(document);
    if (validated.groups.length !== 1) throw new Error(t("text.theSelectedJSONMustContainExactlyOneGroup"));
    const group = validated.groups[0];
    if (group === undefined) throw new Error(t("text.theSelectedJSONDoesNotContainAnyGroups"));
    if (scope.kind === "process") {
      if (group.processes.length !== 1) throw new Error(t("text.theFlowJSONMustContainExactlyOneProcess"));
    }
    return validated;
  }
  private async importDocument(): Promise<void> {
    const contents = await this.files.read({ filterName: t("text.automation"), openLabel: t("text.importAutomation") });
    if (contents === null) { await this.post({ type: "automation.operationCanceled" }); return; }
    const parsed = this.documents.deserialize(contents); if (!parsed.ok) throw new Error(parsed.error);
    const groupCount = parsed.value.data.groups.length;
    await this.state(await this.service.import(parsed.value.data)); await this.notice("success", t("text.arg0Arg1WithoutReplacingExistingOnes", { arg0: groupCount, arg1: groupCount === 1 ? t("text.importedGroup") : t("labels.importedGroups") }));
  }
  private async exportDocument(document: Parameters<AutomationService["save"]>[0]): Promise<void> {
    const exported = await this.files.write(this.documents.serialize(this.validatedDraft(document)), {
      suggestedName: document.name,
      suffix: ".automation.json",
      filterName: t("text.automation"),
      saveLabel: t("text.exportAutomation")
    });
    if (!exported) return;
    await this.notice("success", t("text.automationExported"));
  }
  private async state(document: ReturnType<AutomationService["get"]>): Promise<void> { await this.post({ type: "automation.state", document, descriptors: this.registry.descriptors(), resources: await this.resourceCatalogs() }); }
  private async resourceCatalogs() { const [formulas, arrays] = await Promise.all([this.formulas.getSummaries(), this.arrays.getSummaries()]); return { formulas, arrays }; }
  private async notice(tone: "info" | "success" | "warning" | "error", message: string): Promise<void> { await this.post({ type: "automation.notice", tone, message }); }
  private async post(message: ExtensionToAutomationMessage): Promise<void> { await this.panel?.webview.postMessage(message); }
}
