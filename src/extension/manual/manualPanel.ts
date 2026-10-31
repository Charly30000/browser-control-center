import { t } from "../../localization";
import * as vscode from "vscode";
import type { ArrayResourceService } from "../../application/arrays/arrayResourceService";
import { ImportExportDocumentService, decodeResourceCollection } from "../../application/importExport/importExportDocumentService";
import { ManualProfileBundleService } from "../../application/importExport/manualProfileBundleService";
import type { FormulaService } from "../../application/formulas/formulaService";
import type { BrowserActionsService } from "../../application/manual/browserActionsService";
import type { ManualProfileService, ManualProfileState } from "../../application/manual/manualProfileService";
import { createManualProfileBundle, MANUAL_PROFILE_BUNDLE_VERSION, type ManualPortableResources, type ManualProfileBundle } from "../../domain/importExport/manualProfileBundle";
import type { ManualProfile } from "../../domain/manual/manualProfile";
import { isArrayResource, arrayResourceCodec } from "../../infrastructure/persistence/arrayResourceSerializer";
import { isFormulaResource, formulaCodec } from "../../infrastructure/persistence/formulaSerializer";
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
  if (typeof value !== "object" || value === null || Array.isArray(value)) return failure(t("text.theManualBundleHasAnInvalidStructure"));
  const bundle = value as Record<string, unknown>;
  if (bundle.bundleVersion !== MANUAL_PROFILE_BUNDLE_VERSION) return failure(t("text.unsupportedManualBundleVersionExpectedArg0", { arg0: MANUAL_PROFILE_BUNDLE_VERSION }));
  const profile = deserializeProfile(JSON.stringify(bundle.profile) ?? "null");
  if (!profile.ok) return profile;
  const formulas = decodeResourceCollection(isFormulaResource, t("navigation.formulas"), formulaCodec)(bundle.formulas);
  if (!formulas.ok) return formulas;
  const arrays = decodeResourceCollection(isArrayResource, t("navigation.arrays"), arrayResourceCodec)(bundle.arrays);
  if (!arrays.ok) return arrays;
  return success({ bundleVersion: MANUAL_PROFILE_BUNDLE_VERSION, profile: profile.value, formulas: formulas.value, arrays: arrays.value });
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
      t("text.manualBrowser"),
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")]
      }
    );
    this.panel = panel;
    panel.webview.html = createWebviewHtml(panel.webview, this.extensionUri, "manual", t("text.manualBrowser"));
    const messageSubscription = panel.webview.onDidReceiveMessage((message: unknown) => {
      if (!isManualToExtensionMessage(message)) {
        void this.sendNotice("error", t("text.anInvalidMessageWasReceivedFromTheManualView"));
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
    const revealOutputOnFailure = !(
      (message.type === "browser.apply" && message.target === "generators") ||
      message.type === "browser.resetGenerators" ||
      message.type === "browser.selectElement" ||
      message.type === "browser.previewGenerator"
    );
    try {
      const browserAction = this.browserActionDescription(message);
      if (browserAction !== null) this.logger.info(t("logs.manualStart", { action: browserAction }));
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
          await this.profileService.refreshCatalog();
          await this.sendState(this.profileService.createDraft());
          break;
        case "manual.select":
          await this.sendState(await this.profileService.select(message.id));
          break;
        case "manual.save":
          await this.sendState(await this.saveFromEditor(message.profile, message.resources), message.requestId);
          await this.sendNotice("success", t("text.profileSaved"));
          break;
        case "manual.delete": {
          const confirmed = await confirmDestructiveAction({
            question: t("text.deleteProfileArg0", { arg0: message.name }),
            detail: t("text.thisDeletesTheSavedProfileOrDiscardsTheCurrentDraft")
          });
          if (confirmed) {
            await this.sendState(await this.profileService.delete(message.id));
            await this.sendNotice("success", t("text.profileDeleted"));
          } else await this.post({ type: "manual.operationCanceled" });
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
          if (parsed.value.data.profile.id !== message.currentId) throw new Error(t("text.theProfileIDCannotBeChangedInTheJSONEditor"));
          await this.post({ type: "manual.jsonApplied", bundle: parsed.value.data });
          await this.sendNotice("success", t("text.jsonValidatedAndLoadedAsUnsavedChanges"));
          break;
        }
        case "manual.import":
          await this.importProfile();
          break;
        case "browser.open": {
          const result = await this.browserActions.open(message.profile);
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? t("text.urlOpened") : result.error);
          break;
        }
        case "browser.start": {
          const result = await this.browserActions.start(message.profile);
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? t("text.browserStartedWithACleanSession") : result.error);
          break;
        }
        case "browser.restart": {
          const result = await this.browserActions.restart(message.profile);
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? t("text.browserRestartedWithACleanSession") : result.error);
          break;
        }
        case "browser.stop": {
          const result = await this.browserActions.stop(message.force);
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? t("text.browserStopped") : result.error);
          break;
        }
        case "browser.selectPage": {
          const result = await this.browserActions.selectPage(message.pageId);
          if (!result.ok) await this.sendNotice("warning", result.error);
          else this.logger.info(t("text.manualOKTabSelected"));
          break;
        }
        case "browser.closePage": {
          const result = await this.browserActions.closePage(message.pageId);
          if (!result.ok) await this.sendNotice("warning", result.error);
          else this.logger.info(t("text.manualOKTabClosed"));
          break;
        }
        case "browser.apply": {
          const result = await this.browserActions.apply(message.profile, message.target, message.rowId);
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? t("text.configurationApplied") : result.error, revealOutputOnFailure);
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
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? t("text.generatorsReset") : result.error, revealOutputOnFailure);
          break;
        }
        case "browser.selectElement": {
          const result = await this.browserActions.selectElement();
          if (result.ok) {
            await this.post({ type: "browser.elementSelected", bindingId: message.bindingId, selector: result.value });
            this.logger.info(t("text.manualOKElementSelected"));
          } else {
            await this.sendNotice("warning", result.error, revealOutputOnFailure);
          }
          break;
        }
        case "browser.previewGenerator": {
          const binding = message.profile.generatorBindings.find(({ id }) => id === message.bindingId);
          if (binding === undefined) { await this.sendNotice("warning", t("text.theGeneratorNoLongerExists"), revealOutputOnFailure); break; }
          const result = await this.browserActions.previewGenerator(binding);
          if (result.ok) await this.post({ type: "browser.generatorPreview", bindingId: binding.id, value: result.value });
          await this.sendNotice(result.ok ? "success" : "warning", result.ok ? t("text.sampleGenerated") : result.error, revealOutputOnFailure);
          break;
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t("text.anUnexpectedErrorOccurred");
      this.logger.error(`[Manual] [ERROR] ${errorMessage}`, error);
      if (revealOutputOnFailure) this.logger.show();
      if (message.type === "manual.save" && message.requestId !== undefined) {
        await this.post({ type: "manual.saveFailed", requestId: message.requestId, error: errorMessage });
      }
      await this.post({ type: "manual.notice", tone: "error", message: errorMessage });
    }
  }

  private async exportProfile(profile: ManualStatePayload["profile"], resources: ManualPortableResources | null): Promise<void> {
    const exported = await this.files.write(this.documents.serialize(await this.portableBundle(profile, resources)), {
      suggestedName: profile.name,
      suffix: ".manual-profile.json",
      filterName: t("text.manualProfile"),
      saveLabel: t("text.exportProfile")
    });
    if (!exported) return;
    await this.sendNotice("success", t("text.profileExported"));
  }

  private portableBundle(profile: ManualProfile, resources: ManualPortableResources | null): Promise<ManualProfileBundle> {
    if (resources === null) return this.portableResources.create(profile);
    return Promise.resolve(this.requireBundle(createManualProfileBundle(profile, resources)));
  }

  private async importProfile(): Promise<void> {
    const contents = await this.files.read({ filterName: t("text.manualProfile"), openLabel: t("text.importProfile") });
    if (contents === null) { await this.post({ type: "manual.operationCanceled" }); return; }
    const parsed = this.documents.deserialize(contents);
    if (!parsed.ok) {
      await this.sendNotice("error", parsed.error);
      return;
    }
    const profile = await this.portableResources.resolve(parsed.value.data);
    this.onPortableResourcesChanged();
    await this.sendState(await this.profileService.import(profile));
    await this.sendNotice("success", t("text.profileImported"));
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

  private async sendState(state: ManualProfileState, requestId?: string): Promise<void> {
    await this.post({
      ...(requestId === undefined ? { type: "manual.state" as const } : { type: "manual.saved" as const, requestId }),
      state: { ...state, browser: this.browserActions.getSnapshot(), resources: await this.loadResourceCatalogs() }
    });
  }

  private async loadResourceCatalogs() {
    const [arrays, formulas] = await Promise.all([this.arrayService.getAll(), this.formulaService.getSummaries()]);
    return { formulas, arrays };
  }

  private async sendNotice(tone: "info" | "success" | "warning" | "error", message: string, revealOutputOnFailure = true): Promise<void> {
    if (tone === "success") this.logger.info(`[Manual] [OK] ${message}`);
    else if (tone === "warning") this.logger.warn(`[Manual] [AVISO] ${message}`);
    else if (tone === "error") this.logger.error(`[Manual] [ERROR] ${message}`);
    else this.logger.info(`[Manual] ${message}`);
    if (revealOutputOnFailure && (tone === "warning" || tone === "error")) this.logger.show();
    await this.post({ type: "manual.notice", tone, message });
  }

  private browserActionDescription(message: ManualToExtensionMessage): string | null {
    switch (message.type) {
      case "browser.open": return t("text.openingTheProfileURL");
      case "browser.start": return t("text.startingACleanBrowserSession");
      case "browser.restart": return t("text.restartingTheBrowserWithACleanSession");
      case "browser.stop": return message.force ? t("text.forceStoppingTheBrowser") : t("text.stoppingTheBrowser");
      case "browser.selectPage": return t("text.changingTheActiveTab");
      case "browser.closePage": return t("text.closingATab");
      case "browser.apply": return t("text.applyingArg0", { arg0: this.actionTargetLabel(message.target) });
      case "browser.syncOverrides": return t("text.synchronizingRequestOverrides");
      case "browser.resetGenerators": return t("text.resettingTheValuesAppliedToFields");
      case "browser.selectElement": return t("text.waitingForAnElementSelectionInTheBrowser");
      case "browser.previewGenerator": return t("text.generatingASample");
      default: return null;
    }
  }

  private actionTargetLabel(target: "headers" | "cookies" | "localStorage" | "sessionStorage" | "overrides" | "generators"): string {
    switch (target) {
      case "headers": return t("labels.headers");
      case "cookies": return t("labels.cookies");
      case "localStorage": return t("labels.localStorage");
      case "sessionStorage": return t("labels.sessionStorage");
      case "overrides": return t("labels.requestOverrides");
      case "generators": return t("labels.fieldsAndGenerators");
    }
  }

  private async post(message: ExtensionToManualMessage): Promise<void> {
    await this.panel?.webview.postMessage(message);
  }
}
