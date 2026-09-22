import { join } from "node:path";
import * as vscode from "vscode";
import { ArrayResourceService } from "../application/arrays/arrayResourceService";
import { FormulaService } from "../application/formulas/formulaService";
import { BrowserActionsService } from "../application/manual/browserActionsService";
import { GeneratorValueResolver } from "../application/manual/generatorValueResolver";
import { ManualProfileService } from "../application/manual/manualProfileService";
import type { ArrayResource } from "../domain/arrays/arrayResource";
import type { FormulaResource } from "../domain/formulas/formula";
import { BrowserBinaryManager } from "../infrastructure/browser/browserBinaryManager";
import { BrowserLifecycleManager } from "../infrastructure/browser/browserLifecycleManager";
import { PlaywrightBrowserBridge } from "../infrastructure/browser/playwrightBrowserBridge";
import { PlaywrightRuntimeLoader } from "../infrastructure/browser/playwrightRuntime";
import { ChromiumFormulaExecutionService } from "../infrastructure/formulas/chromiumFormulaExecutionService";
import { arrayResourceCodec } from "../infrastructure/persistence/arrayResourceSerializer";
import { FileProfileRepository } from "../infrastructure/persistence/fileProfileRepository";
import { FileResourceRepository } from "../infrastructure/persistence/fileResourceRepository";
import { formulaCodec } from "../infrastructure/persistence/formulaSerializer";
import { ProfileMetadataStore } from "../infrastructure/persistence/profileMetadataStore";
import { ResourceMetadataStore } from "../infrastructure/persistence/resourceMetadataStore";
import { ArraysPanelManager } from "./arrays/arraysPanel";
import { BrowserManagementPanel } from "./browser/browserManagementPanel";
import { FormulasPanelManager } from "./formulas/formulasPanel";
import { BrowserAutomationLogger } from "./logging/browserAutomationLogger";
import { ManualPanelManager } from "./manual/manualPanel";

export interface ApplicationServices {
  readonly profileService: ManualProfileService;
  readonly formulaService: FormulaService;
  readonly arrayService: ArrayResourceService;
  readonly browserActions: BrowserActionsService;
  readonly browserBinaries: BrowserBinaryManager;
  readonly manualPanel: ManualPanelManager;
  readonly formulasPanel: FormulasPanelManager;
  readonly arraysPanel: ArraysPanelManager;
  readonly browserManagement: BrowserManagementPanel;
  readonly logger: BrowserAutomationLogger;
}

export const createApplicationServices = (context: vscode.ExtensionContext): ApplicationServices => {
  const profileService = new ManualProfileService(new FileProfileRepository(context.globalStorageUri), new ProfileMetadataStore(context.globalState));
  const formulaService = new FormulaService(new FileResourceRepository<FormulaResource>(context.globalStorageUri, "formulas", formulaCodec), new ResourceMetadataStore(context.globalState, "formulas.resourceMetadata.v1"));
  const arrayService = new ArrayResourceService(new FileResourceRepository<ArrayResource>(context.globalStorageUri, "arrays", arrayResourceCodec), new ResourceMetadataStore(context.globalState, "arrays.resourceMetadata.v1"));
  const logger = new BrowserAutomationLogger(vscode.window.createOutputChannel("Browser Automation", { log: true }));
  const browserRoot = join(context.globalStorageUri.fsPath, "browser");
  const runtime = new PlaywrightRuntimeLoader(join(browserRoot, "binaries"));
  const browserBinaries = new BrowserBinaryManager(browserRoot, runtime, logger);
  const lifecycle = new BrowserLifecycleManager(runtime, browserBinaries.runtimePath, logger);
  const bridge = new PlaywrightBrowserBridge(browserBinaries, lifecycle, logger);
  const formulaExecution = new ChromiumFormulaExecutionService(browserBinaries, runtime, logger);
  const generatorResolver = new GeneratorValueResolver(formulaService, arrayService, formulaExecution);
  const browserActions = new BrowserActionsService(bridge, generatorResolver);
  const manualPanel = new ManualPanelManager(context.extensionUri, profileService, browserActions, formulaService, arrayService);
  const formulasPanel = new FormulasPanelManager(context.extensionUri, formulaService, formulaExecution, () => { void manualPanel.refreshResourceCatalogs(); });
  const arraysPanel = new ArraysPanelManager(context.extensionUri, arrayService, () => { void manualPanel.refreshResourceCatalogs(); });
  const browserManagement = new BrowserManagementPanel(context.extensionUri, browserBinaries, browserActions);
  return { profileService, formulaService, arrayService, browserActions, browserBinaries, manualPanel, formulasPanel, arraysPanel, browserManagement, logger };
};
