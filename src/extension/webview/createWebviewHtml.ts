import * as vscode from "vscode";
import { createNonce } from "./nonce";

export const createWebviewHtml = (
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  entryName: "manual" | "sidebar" | "formulas" | "arrays" | "browserManagement" | "automations",
  title: string
): string => {
  const nonce = createNonce();
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", `${entryName}.js`));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", `${entryName}.css`));
  const styleSource = entryName === "automations" ? `${webview.cspSource} 'unsafe-inline'` : webview.cspSource;
  const csp = [
    "default-src 'none'",
    `img-src ${webview.cspSource} data: https:`,
    `font-src ${webview.cspSource}`,
    `style-src ${styleSource}`,
    `script-src 'nonce-${nonce}'`
  ].join("; ");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <link rel="stylesheet" href="${styleUri.toString()}">
    <title>${title}</title>
  </head>
  <body>
    <script nonce="${nonce}" src="${scriptUri.toString()}"></script>
  </body>
</html>`;
};
