import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { silentLogger } from "../src/application/logging/logger";
import { createFormula } from "../src/domain/formulas/formula";
import { PlaywrightRuntimeLoader } from "../src/infrastructure/browser/playwrightRuntime";
import { PlaywrightFormulaExecutionService } from "../src/infrastructure/formulas/playwrightFormulaExecutionService";

const realBrowserSuite = process.env.BCC_REAL_BROWSER_TESTS === "1" ? describe : describe.skip;
const chrome = {
  resolveLaunchConfiguration: () => Promise.resolve({
    providerId: "system-chrome" as const,
    displayName: "Installed Google Chrome",
    engine: "chromium" as const,
    executablePath: null,
    channel: "chrome"
  })
};

realBrowserSuite("fórmulas con navegador real", () => {
  const runtime = new PlaywrightRuntimeLoader(join(tmpdir(), "bcc-integration-browsers"));

  it("ejecuta una fórmula async y devuelve un objeto", async () => {
    const formula = createFormula("real-async", "Async real");
    formula.code = "async function generate() { return await Promise.resolve({ ok: true, values: [1, 2] }); }";
    const result = await new PlaywrightFormulaExecutionService(chrome, runtime, silentLogger).execute(formula);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.value).toEqual({ ok: true, values: [1, 2] });
  }, 20_000);

  it("termina el proceso de una fórmula con loop infinito", async () => {
    const formula = createFormula("real-loop", "Loop real");
    formula.code = "function generate() { while (true) {} }";
    const result = await new PlaywrightFormulaExecutionService(chrome, runtime, silentLogger, 200).execute(formula);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("timeout");
  }, 20_000);

  it("reports the English missing-function error inside the isolated page", async () => {
    const formula = createFormula("missing-generate", "Missing function");
    formula.code = "const value = 1;";
    const result = await new PlaywrightFormulaExecutionService(chrome, runtime, silentLogger).execute(formula);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("The formula must declare function generate().");
  }, 20_000);
});
