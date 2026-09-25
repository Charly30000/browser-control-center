import * as vscode from "vscode";
import type { BrowserActionsService } from "../../application/manual/browserActionsService";
import type { BrowserBinaryManager } from "../../infrastructure/browser/browserBinaryManager";
import { isSidebarToExtensionMessage, type ExtensionToSidebarMessage } from "../../shared/messages/sidebarMessages";
import { createWebviewHtml } from "../webview/createWebviewHtml";

export class SidebarProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewId = "browserControl.sidebar";
  private view: vscode.WebviewView | null = null;
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(private readonly extensionUri: vscode.Uri, private readonly binaries: BrowserBinaryManager, private readonly browser: BrowserActionsService, private readonly openBrowserManagement: () => void) {
    this.disposables.push(this.binaries.onDidChange(() => { void this.sendState(); }), this.browser.onDidChange(() => { void this.sendState(); }));
  }

  public resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")] };
    view.webview.html = createWebviewHtml(view.webview, this.extensionUri, "sidebar", "Browser Control");
    view.onDidDispose(() => { this.view = null; });
    view.webview.onDidReceiveMessage((message: unknown) => {
      if (!isSidebarToExtensionMessage(message)) return;
      if (message.type === "sidebar.ready") { void this.sendState(); return; }
      if (message.type === "sidebar.manageBrowser") { this.openBrowserManagement(); return; }
      if (message.pageId !== "browserManagement") {
        const commandByPage = { manual: "browserControl.openManual", formulas: "browserControl.openFormulas", arrays: "browserControl.openArrays", automations: "browserControl.openAutomations" } as const;
        void vscode.commands.executeCommand(commandByPage[message.pageId]);
      }
    });
  }

  public dispose(): void { for (const disposable of this.disposables) disposable.dispose(); }
  private async sendState(): Promise<void> {
    const response: ExtensionToSidebarMessage = { type: "sidebar.state", installation: (await this.binaries.inspect()).state, lifecycle: this.browser.getSnapshot().lifecycle };
    await this.view?.webview.postMessage(response);
  }
}
