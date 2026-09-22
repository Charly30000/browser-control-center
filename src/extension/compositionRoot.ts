import type * as vscode from "vscode";
import { ArrayResourceService } from "../application/arrays/arrayResourceService";
import { FormulaService } from "../application/formulas/formulaService";
import { BrowserActionsService } from "../application/manual/browserActionsService";
import { ManualProfileService } from "../application/manual/manualProfileService";
import { StubBrowserBridge } from "../infrastructure/browser/stubBrowserBridge";
import { UnavailableFormulaExecutionService } from "../infrastructure/formulas/unavailableFormulaExecutionService";
import { arrayResourceCodec } from "../infrastructure/persistence/arrayResourceSerializer";
import { FileProfileRepository } from "../infrastructure/persistence/fileProfileRepository";
import { FileResourceRepository } from "../infrastructure/persistence/fileResourceRepository";
import { formulaCodec } from "../infrastructure/persistence/formulaSerializer";
import { ProfileMetadataStore } from "../infrastructure/persistence/profileMetadataStore";
import { ResourceMetadataStore } from "../infrastructure/persistence/resourceMetadataStore";
import type { ArrayResource } from "../domain/arrays/arrayResource";
import type { FormulaResource } from "../domain/formulas/formula";
import { ArraysPanelManager } from "./arrays/arraysPanel";
import { FormulasPanelManager } from "./formulas/formulasPanel";
import { ManualPanelManager } from "./manual/manualPanel";

export interface ApplicationServices {
  readonly profileService: ManualProfileService;
  readonly formulaService: FormulaService;
  readonly arrayService: ArrayResourceService;
  readonly manualPanel: ManualPanelManager;
  readonly formulasPanel: FormulasPanelManager;
  readonly arraysPanel: ArraysPanelManager;
}

export const createApplicationServices = (context: vscode.ExtensionContext): ApplicationServices => {
  const repository = new FileProfileRepository(context.globalStorageUri);
  const metadataStore = new ProfileMetadataStore(context.globalState);
  const profileService = new ManualProfileService(repository, metadataStore);
  const formulaService = new FormulaService(
    new FileResourceRepository<FormulaResource>(context.globalStorageUri, "formulas", formulaCodec),
    new ResourceMetadataStore(context.globalState, "formulas.resourceMetadata.v1")
  );
  const arrayService = new ArrayResourceService(
    new FileResourceRepository<ArrayResource>(context.globalStorageUri, "arrays", arrayResourceCodec),
    new ResourceMetadataStore(context.globalState, "arrays.resourceMetadata.v1")
  );
  const browserActions = new BrowserActionsService(new StubBrowserBridge());
  const manualPanel = new ManualPanelManager(context.extensionUri, profileService, browserActions, formulaService, arrayService);
  const formulasPanel = new FormulasPanelManager(
    context.extensionUri,
    formulaService,
    new UnavailableFormulaExecutionService(),
    () => { void manualPanel.refreshResourceCatalogs(); }
  );
  const arraysPanel = new ArraysPanelManager(
    context.extensionUri,
    arrayService,
    () => { void manualPanel.refreshResourceCatalogs(); }
  );
  return { profileService, formulaService, arrayService, manualPanel, formulasPanel, arraysPanel };
};
