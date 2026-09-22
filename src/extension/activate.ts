import * as vscode from "vscode";
import { createApplicationServices } from "./compositionRoot";
import { SidebarProvider } from "./sidebar/sidebarProvider";

export const activate = async (context: vscode.ExtensionContext): Promise<void> => {
  const services = createApplicationServices(context);
  await Promise.all([
    services.profileService.initialize(),
    services.formulaService.initialize(),
    services.arrayService.initialize()
  ]);

  context.subscriptions.push(
    services.manualPanel,
    services.formulasPanel,
    services.arraysPanel,
    vscode.commands.registerCommand("browserControl.openManual", () => services.manualPanel.open()),
    vscode.commands.registerCommand("browserControl.openFormulas", () => services.formulasPanel.open()),
    vscode.commands.registerCommand("browserControl.openArrays", () => services.arraysPanel.open()),
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewId, new SidebarProvider(context.extensionUri))
  );
};

export const deactivate = (): void => undefined;
