import * as vscode from "vscode";
import { createApplicationServices } from "./compositionRoot";
import { SidebarProvider } from "./sidebar/sidebarProvider";

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const services = createApplicationServices(context);
  await Promise.all([services.profileService.initialize(), services.formulaService.initialize(), services.arrayService.initialize()]);
  const sidebar = new SidebarProvider(context.extensionUri, services.browserBinaries, services.browserActions, () => services.browserManagement.open());
  context.subscriptions.push(
    services.manualPanel,
    services.formulasPanel,
    services.arraysPanel,
    services.browserManagement,
    services.logger,
    sidebar,
    { dispose: () => { void services.browserActions.stop(true); } },
    vscode.commands.registerCommand("browserControl.openManual", () => services.manualPanel.open()),
    vscode.commands.registerCommand("browserControl.openFormulas", () => services.formulasPanel.open()),
    vscode.commands.registerCommand("browserControl.openArrays", () => services.arraysPanel.open()),
    vscode.commands.registerCommand("browserControl.manageBrowser", () => services.browserManagement.open()),
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewId, sidebar)
  );
};

export const deactivate = (): void => undefined;
