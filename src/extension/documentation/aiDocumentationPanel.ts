import * as vscode from "vscode";
import { createWebviewHtml } from "../webview/createWebviewHtml";

export class AiDocumentationPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;

  public constructor(private readonly extensionUri: vscode.Uri) {}

  public open(): void {
    if (this.panel !== null) { this.panel.reveal(vscode.ViewColumn.One); return; }
    const panel = vscode.window.createWebviewPanel("browserControl.aiDocumentation", "Documentación para IA", vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")]
    });
    this.panel = panel;
    panel.webview.html = createWebviewHtml(panel.webview, this.extensionUri, "aiDocumentation", "Documentación para IA");
    panel.onDidDispose(() => { if (this.panel === panel) this.panel = null; });
  }

  public dispose(): void { this.panel?.dispose(); this.panel = null; }
}
