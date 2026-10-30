import { join } from "node:path";
import * as vscode from "vscode";
import { ArrayResourceService } from "../application/arrays/arrayResourceService";
import { BrowserSelectionService } from "../application/browser/browserSelectionService";
import { FormulaService } from "../application/formulas/formulaService";
import { BrowserActionsService } from "../application/manual/browserActionsService";
import { GeneratorValueResolver } from "../application/manual/generatorValueResolver";
import { ManualProfileService } from "../application/manual/manualProfileService";
import { AutomationService } from "../application/automations/automationService";
import { createDefaultNodeRegistry } from "../application/automations/nodeDefinitions";
import { ProcessRunner } from "../application/automations/processRunner";
import type { ApplicationDataDao } from "../application/persistence/applicationDataDao";
import { BrowserLifecycleManager } from "../infrastructure/browser/browserLifecycleManager";
import { PlaywrightBrowserBridge } from "../infrastructure/browser/playwrightBrowserBridge";
import { PlaywrightRuntimeLoader } from "../infrastructure/browser/playwrightRuntime";
import { BrowserBinaryManager } from "../infrastructure/browser/providers/browserBinaryManager";
import { ManagedChromiumProvider } from "../infrastructure/browser/providers/managedChromiumProvider";
import { SystemChromeProvider } from "../infrastructure/browser/providers/systemChromeProvider";
import { PlaywrightFormulaExecutionService } from "../infrastructure/formulas/playwrightFormulaExecutionService";
import { PlaywrightAutomationSessionFactory } from "../infrastructure/automations/playwrightAutomationSession";
import { VsCodeApplicationDataDao } from "../infrastructure/persistence/vsCodeApplicationDataDao";
import { ArraysPanelManager } from "./arrays/arraysPanel";
import { BrowserManagementPanel } from "./browser/browserManagementPanel";
import { FormulasPanelManager } from "./formulas/formulasPanel";
import { BrowserAutomationLogger } from "./logging/browserAutomationLogger";
import { ManualPanelManager } from "./manual/manualPanel";
import { AutomationsPanelManager } from "./automations/automationsPanel";
import { AiDocumentationPanel } from "./documentation/aiDocumentationPanel";

export interface ApplicationServices {
  readonly dataDao: ApplicationDataDao;
  readonly profileService: ManualProfileService;
  readonly formulaService: FormulaService;
  readonly arrayService: ArrayResourceService;
  readonly automationService: AutomationService;
  readonly browserActions: BrowserActionsService;
  readonly browserBinaries: BrowserBinaryManager;
  readonly browserSelection: BrowserSelectionService;
  readonly manualPanel: ManualPanelManager;
  readonly formulasPanel: FormulasPanelManager;
  readonly arraysPanel: ArraysPanelManager;
  readonly browserManagement: BrowserManagementPanel;
  readonly automationsPanel: AutomationsPanelManager;
  readonly aiDocumentationPanel: AiDocumentationPanel;
  readonly logger: BrowserAutomationLogger;
}

export const createApplicationServices = (context: vscode.ExtensionContext): ApplicationServices => {
  const dataDao = new VsCodeApplicationDataDao(context.globalStorageUri, context.globalState);
  const profileService = new ManualProfileService(dataDao.profiles, dataDao.profileMetadata);
  const formulaService = new FormulaService(dataDao.formulas, dataDao.formulaMetadata);
  const arrayService = new ArrayResourceService(dataDao.arrays, dataDao.arrayMetadata);
  const logger = new BrowserAutomationLogger(vscode.window.createOutputChannel("Browser Automation", "log"));
  const browserRoot = join(context.globalStorageUri.fsPath, "browser");
  const runtime = new PlaywrightRuntimeLoader(join(browserRoot, "binaries"));
  const browserBinaries = new BrowserBinaryManager(browserRoot, runtime, logger);
  const browserSelection = new BrowserSelectionService(
    [new ManagedChromiumProvider(browserBinaries), new SystemChromeProvider(runtime)],
    dataDao.browserPreferences
  );
  const lifecycle = new BrowserLifecycleManager(runtime, browserBinaries.runtimePath, logger);
  const bridge = new PlaywrightBrowserBridge(browserSelection, lifecycle, logger);
  const formulaExecution = new PlaywrightFormulaExecutionService(browserSelection, runtime, logger);
  const generatorResolver = new GeneratorValueResolver(formulaService, arrayService, formulaExecution);
  const browserActions = new BrowserActionsService(bridge, generatorResolver);
  const nodeRegistry = createDefaultNodeRegistry();
  const automationService = new AutomationService(dataDao.automations, nodeRegistry);
  const automationSessions = new PlaywrightAutomationSessionFactory(browserSelection, runtime, browserBinaries.runtimePath, logger);
  const processRunner = new ProcessRunner(automationSessions, nodeRegistry, generatorResolver, logger);
  const panels: { manual: ManualPanelManager | null } = { manual: null };
  const automationsPanel = new AutomationsPanelManager(context.extensionUri, automationService, nodeRegistry, processRunner, formulaService, arrayService, browserActions, logger);
  const refreshResourceCatalogs = (): void => { void panels.manual?.refreshResourceCatalogs(); void automationsPanel.refreshResourceCatalogs(); };
  const formulasPanel = new FormulasPanelManager(context.extensionUri, formulaService, formulaExecution, refreshResourceCatalogs);
  const arraysPanel = new ArraysPanelManager(context.extensionUri, arrayService, refreshResourceCatalogs);
  const manualPanel = new ManualPanelManager(context.extensionUri, profileService, browserActions, formulaService, arrayService, () => {
    void formulasPanel.refreshResourceCatalogs();
    void arraysPanel.refreshResourceCatalogs();
    void automationsPanel.refreshResourceCatalogs();
  }, logger);
  panels.manual = manualPanel;
  const browserManagement = new BrowserManagementPanel(context.extensionUri, browserBinaries, browserSelection, browserActions);
  const aiDocumentationPanel = new AiDocumentationPanel(context.extensionUri);
  return { dataDao, profileService, formulaService, arrayService, automationService, browserActions, browserBinaries, browserSelection, manualPanel, formulasPanel, arraysPanel, browserManagement, automationsPanel, aiDocumentationPanel, logger };
};
