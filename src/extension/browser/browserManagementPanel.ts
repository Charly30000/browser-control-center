import * as vscode from "vscode";
import type { BrowserSelectionService } from "../../application/browser/browserSelectionService";
import type { BrowserActionsService } from "../../application/manual/browserActionsService";
import type { BrowserInstallProgress, BrowserBinaryManager } from "../../infrastructure/browser/providers/browserBinaryManager";
import { isBrowserManagementMessage, type BrowserManagementToExtensionMessage, type ExtensionToBrowserManagementMessage } from "../../shared/messages/browserManagementMessages";
import { createWebviewHtml } from "../webview/createWebviewHtml";

export class BrowserManagementPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | null = null;
  private busy = false;
  private progress = "";
  private readonly disposables: vscode.Disposable[] = [];

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly binaries: BrowserBinaryManager,
    private readonly selection: BrowserSelectionService,
    private readonly browser: BrowserActionsService
  ) {
    this.disposables.push(
      this.binaries.onDidChange(() => { void this.sendState(); }),
      this.selection.onDidChange(() => { void this.sendState(); }),
      this.browser.onDidChange(() => { void this.sendState(); })
    );
  }

  public open(): void {
    if (this.panel !== null) { this.panel.reveal(vscode.ViewColumn.One); return; }
    const panel = vscode.window.createWebviewPanel("browserControl.browserManagement", "Gestionar navegador", vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")]
    });
    this.panel = panel;
    panel.webview.html = createWebviewHtml(panel.webview, this.extensionUri, "browserManagement", "Gestionar navegador");
    panel.onDidDispose(() => { this.panel = null; });
    panel.webview.onDidReceiveMessage((value: unknown) => {
      if (!isBrowserManagementMessage(value)) return;
      void this.handle(value);
    });
  }

  public dispose(): void { this.panel?.dispose(); for (const disposable of this.disposables) disposable.dispose(); }

  private async handle(message: BrowserManagementToExtensionMessage): Promise<void> {
    if (message.type === "browserManagement.ready") { await this.sendState(); return; }
    if (this.busy) return;
    try {
      this.busy = true;
      await this.sendState();
      if (message.type === "browserManagement.selectProvider") {
        if (this.browser.getSnapshot().lifecycle !== "stopped") {
          const stopped = await this.browser.stop(false);
          if (!stopped.ok) throw new Error(stopped.error);
        }
        await this.selection.select(message.providerId);
        const selected = (await this.selection.inspectProviders()).find(({ id }) => id === message.providerId);
        await this.notice(selected?.state === "ready" ? "success" : "warning", `${selected?.displayName ?? "Navegador"} seleccionado. ${selected?.detail ?? ""}`.trim());
      } else if (message.type === "browserManagement.verify") {
        const selectedId = this.selection.getSelectedProviderId();
        const result = (await this.selection.inspectProviders(true)).find(({ id }) => id === selectedId);
        if (result === undefined) throw new Error("No se encontró el navegador seleccionado.");
        await this.notice(result.state === "ready" ? "success" : "error", result.detail);
      } else if (message.type === "browserManagement.install") {
        await this.install("Instalando Chromium");
        await this.notice("success", "Chromium se ha instalado y verificado correctamente.");
      } else if (message.type === "browserManagement.reinstall") {
        const stopped = await this.browser.stop(true);
        if (!stopped.ok) throw new Error(stopped.error);
        await this.binaries.remove();
        await this.install("Reinstalando Chromium");
        await this.notice("success", "Chromium se ha reinstalado y verificado correctamente.");
      } else {
        const answer = await vscode.window.showWarningMessage("¿Eliminar la instalación administrada de Chromium?", { modal: true, detail: "Los perfiles, fórmulas, arrays y la instalación personal de Chrome no se eliminarán." }, "Eliminar Chromium");
        if (answer === "Eliminar Chromium") {
          const stopped = await this.browser.stop(true);
          if (!stopped.ok) throw new Error(stopped.error);
          await this.binaries.remove();
          await this.notice("success", "La instalación administrada de Chromium se ha eliminado.");
        }
      }
    } catch (error: unknown) {
      await this.notice("error", error instanceof Error ? error.message : "La operación ha fallado.");
    } finally {
      this.busy = false;
      this.progress = "";
      await this.sendState();
    }
  }

  private async install(title: string): Promise<void> {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title, cancellable: false }, async (progress) => {
      let previous = 0;
      await this.binaries.install((update: BrowserInstallProgress) => {
        this.progress = update.message;
        if (update.percentage === undefined) progress.report({ message: update.message });
        else {
          progress.report({ message: update.message, increment: Math.max(0, update.percentage - previous) });
          previous = update.percentage;
        }
        void this.sendState();
      });
    });
  }

  private async sendState(): Promise<void> {
    if (this.panel === null) return;
    const message: ExtensionToBrowserManagementMessage = {
      type: "browserManagement.state",
      providers: await this.selection.inspectProviders(),
      selectedProviderId: this.selection.getSelectedProviderId(),
      managedInstallation: await this.binaries.inspect(),
      lifecycle: this.browser.getSnapshot().lifecycle,
      busy: this.busy,
      progress: this.progress
    };
    await this.panel.webview.postMessage(message);
  }

  private async notice(tone: "info" | "success" | "warning" | "error", message: string): Promise<void> {
    await this.panel?.webview.postMessage({ type: "browserManagement.notice", tone, message } satisfies ExtensionToBrowserManagementMessage);
  }
}
