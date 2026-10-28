import { describe, expect, it } from "vitest";
import { createContentSecurityPolicy } from "../src/extension/webview/contentSecurityPolicy";

describe("CSP de webviews", () => {
  it("bloquea recursos remotos y exige nonce para scripts", () => {
    const policy = createContentSecurityPolicy("vscode-webview:", "nonce-test", false);
    expect(policy).toContain("default-src 'none'");
    expect(policy).toContain("script-src 'nonce-nonce-test'");
    expect(policy).not.toContain("https:");
    expect(policy).not.toContain("style-src vscode-webview: 'unsafe-inline'");
  });

  it("limita la excepción inline a los estilos del canvas", () => {
    expect(createContentSecurityPolicy("vscode-webview:", "nonce-test", true)).toContain("style-src vscode-webview: 'unsafe-inline'");
  });
});
