import { t } from "../../localization";
import * as vscode from "vscode";
import type { BrowserSelectionService } from "../../application/browser/browserSelectionService";
import type { BrowserActionsService } from "../../application/manual/browserActionsService";
import { isSidebarToExtensionMessage, type ExtensionToSidebarMessage } from "../../shared/messages/sidebarMessages";
import { createWebviewHtml } from "../webview/createWebviewHtml";

export class SidebarProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewId = "browserControl.sidebar";
  private view: vscode.WebviewView | null = null;
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(private readonly extensionUri: vscode.Uri, private readonly selection: BrowserSelectionService, private readonly browser: BrowserActionsService, private readonly openBrowserManagement: () => void) {
    this.disposables.push(this.selection.onDidChange(() => { void this.sendState(); }), this.browser.onDidChange(() => { void this.sendState(); }));
  }

  public resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")] };
    view.webview.html = createWebviewHtml(view.webview, this.extensionUri, "sidebar", t("text.browserControl"));
    view.onDidDispose(() => { this.view = null; });
    view.webview.onDidReceiveMessage((message: unknown) => {
      if (!isSidebarToExtensionMessage(message)) return;
      if (message.type === "sidebar.ready") { void this.sendState(); return; }
      if (message.type === "sidebar.manageBrowser") { this.openBrowserManagement(); return; }
      if (message.pageId !== "browserManagement") {
        const commandByPage = { manual: "browserControl.openManual", formulas: "browserControl.openFormulas", arrays: "browserControl.openArrays", automations: "browserControl.openAutomations", aiDocumentation: "browserControl.openAiDocumentation" } as const;
        void vscode.commands.executeCommand(commandByPage[message.pageId]);
      }
    });
  }

  public dispose(): void { for (const disposable of this.disposables) disposable.dispose(); }
  private async sendState(): Promise<void> {
    const providerId = this.selection.getSelectedProviderId();
    const selected = (await this.selection.inspectProviders()).find(({ id }) => id === providerId);
    const response: ExtensionToSidebarMessage = {
      type: "sidebar.state",
      providerId,
      providerName: selected?.displayName ?? t("text.browser"),
      providerState: selected?.state ?? "missing",
      lifecycle: this.browser.getSnapshot().lifecycle
    };
    await this.view?.webview.postMessage(response);
  }
}
