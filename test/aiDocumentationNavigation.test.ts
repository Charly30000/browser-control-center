import { describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";
import type { BrowserSelectionService } from "../src/application/browser/browserSelectionService";
import type { BrowserActionsService } from "../src/application/manual/browserActionsService";
import { AiDocumentationPanel } from "../src/extension/documentation/aiDocumentationPanel";
import { SidebarProvider } from "../src/extension/sidebar/sidebarProvider";
import { isSidebarToExtensionMessage } from "../src/shared/messages/sidebarMessages";
import { pageCatalog } from "../src/webviews/pages/pageCatalog";
import manifest from "../package.json";

const mocks = vi.hoisted(() => ({ executeCommand: vi.fn(), createWebviewPanel: vi.fn() }));
vi.mock("vscode", () => ({
  commands: { executeCommand: mocks.executeCommand },
  window: { createWebviewPanel: mocks.createWebviewPanel },
  ViewColumn: { One: 1 },
  Uri: { joinPath: (_base: unknown, ...segments: string[]) => ({ toString: () => segments.join("/") }) }
}));

describe("navegación a Documentación para IA", () => {
  it("el quinto botón tiene un mensaje admitido y un comando declarado", () => {
    expect(pageCatalog.map(({ id }) => id)).toEqual(["manual", "formulas", "arrays", "automations", "aiDocumentation"]);
    expect(isSidebarToExtensionMessage({ type: "sidebar.openPage", pageId: "aiDocumentation" })).toBe(true);
    expect(isSidebarToExtensionMessage({ type: "sidebar.openPage", pageId: "unknown" })).toBe(false);
    expect(manifest.contributes.commands.some(({ command }) => command === "browserControl.openAiDocumentation")).toBe(true);
  });

  it("el mensaje del botón abre la página correcta y reutiliza su panel", () => {
    let receive: ((message: unknown) => void) | undefined;
    let onDispose: (() => void) | undefined;
    const extensionUri = {} as vscode.Uri;
    const webview = () => ({ html: "", cspSource: "vscode-webview:", asWebviewUri: (uri: unknown) => uri });
    const panel = { webview: webview(), reveal: vi.fn(), dispose: vi.fn(), onDidDispose: vi.fn((listener: () => void) => { onDispose = listener; }) };
    mocks.createWebviewPanel.mockReturnValue(panel);
    const documentation = new AiDocumentationPanel(extensionUri);
    mocks.executeCommand.mockImplementation((command: string) => { if (command === "browserControl.openAiDocumentation") documentation.open(); });
    const subscription = { onDidChange: () => ({ dispose: () => undefined }) };
    const provider = new SidebarProvider(extensionUri, subscription as unknown as BrowserSelectionService, subscription as unknown as BrowserActionsService, () => undefined);
    const view = { webview: { ...webview(), options: {}, onDidReceiveMessage: (listener: (message: unknown) => void) => { receive = listener; } }, onDidDispose: vi.fn() };
    provider.resolveWebviewView(view as unknown as vscode.WebviewView);

    receive?.({ type: "sidebar.openPage", pageId: "aiDocumentation" });
    expect(mocks.executeCommand).toHaveBeenCalledWith("browserControl.openAiDocumentation");
    expect(mocks.createWebviewPanel).toHaveBeenCalledWith("browserControl.aiDocumentation", "AI Documentation", 1, expect.objectContaining({ enableScripts: true }));
    expect(panel.webview.html).toContain("aiDocumentation.js");
    expect(panel.webview.html).toContain("aiDocumentation.css");

    documentation.open();
    expect(panel.reveal).toHaveBeenCalledWith(1);
    onDispose?.();
    documentation.open();
    expect(mocks.createWebviewPanel).toHaveBeenCalledTimes(2);
    provider.dispose();
    documentation.dispose();
  });
});
