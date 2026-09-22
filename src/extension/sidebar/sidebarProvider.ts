import * as vscode from "vscode";
import { isSidebarToExtensionMessage, type ExtensionToSidebarMessage } from "../../shared/messages/sidebarMessages";
import { createWebviewHtml } from "../webview/createWebviewHtml";

export class SidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "browserControl.sidebar";

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public resolveWebviewView(view: vscode.WebviewView): void {
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")]
    };
    view.webview.html = createWebviewHtml(view.webview, this.extensionUri, "sidebar", "Browser Control");
    view.webview.onDidReceiveMessage((message: unknown) => {
      if (!isSidebarToExtensionMessage(message)) return;
      switch (message.type) {
        case "sidebar.ready": {
          const response: ExtensionToSidebarMessage = { type: "sidebar.state", browserStatus: "unconfigured" };
          void view.webview.postMessage(response);
          break;
        }
        case "sidebar.openPage":
          if (message.pageId === "automations") {
            void vscode.window.showInformationMessage("Automatizaciones estará disponible en una fase posterior.");
          } else {
            const commandByPage = {
              manual: "browserControl.openManual",
              formulas: "browserControl.openFormulas",
              arrays: "browserControl.openArrays"
            } as const;
            void vscode.commands.executeCommand(commandByPage[message.pageId]);
          }
          break;
      }
    });
  }
}
