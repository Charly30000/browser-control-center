import * as vscode from "vscode";
import { createApplicationServices } from "./compositionRoot";
import { SidebarProvider } from "./sidebar/sidebarProvider";

let shutdown: (() => Promise<void>) | null = null;

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const services = createApplicationServices(context);
  shutdown = async () => {
    await services.browserActions.stop(true).catch(() => undefined);
  };
  await services.dataDao.initialize();
  await services.automationService.initialize();
  const sidebar = new SidebarProvider(context.extensionUri, services.browserSelection, services.browserActions, () => services.browserManagement.open());
  context.subscriptions.push(
    services.manualPanel,
    services.formulasPanel,
    services.arraysPanel,
    services.browserManagement,
    services.automationsPanel,
    services.aiDocumentationPanel,
    services.logger,
    sidebar,
    { dispose: () => { void services.browserActions.stop(true); } },
    vscode.commands.registerCommand("browserControl.openManual", () => services.manualPanel.open()),
    vscode.commands.registerCommand("browserControl.openFormulas", () => services.formulasPanel.open()),
    vscode.commands.registerCommand("browserControl.openArrays", () => services.arraysPanel.open()),
    vscode.commands.registerCommand("browserControl.openAutomations", () => services.automationsPanel.open()),
    vscode.commands.registerCommand("browserControl.openAiDocumentation", () => services.aiDocumentationPanel.open()),
    vscode.commands.registerCommand("browserControl.manageBrowser", () => services.browserManagement.open()),
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewId, sidebar)
  );
};

export const deactivate = async (): Promise<void> => {
  const action = shutdown;
  shutdown = null;
  await action?.();
};
