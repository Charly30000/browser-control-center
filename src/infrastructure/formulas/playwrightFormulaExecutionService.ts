import { performance } from "node:perf_hooks";
import type { Browser, BrowserContext, BrowserServer } from "playwright-core";
import type { FormulaExecutionResult, FormulaExecutionService } from "../../application/formulas/formulaExecutionService";
import type { BrowserLaunchConfigurationProvider } from "../../application/browser/browserProvider";
import type { Logger } from "../../application/logging/logger";
import type { FormulaResource } from "../../domain/formulas/formula";
import { isJsonValue } from "../../domain/manual/storageValue";
import type { PlaywrightRuntimeProvider } from "../browser/playwrightRuntime";
import { failure, success, type Result } from "../../shared/result";

export class PlaywrightFormulaExecutionService implements FormulaExecutionService {
  public constructor(
    private readonly browserSelection: BrowserLaunchConfigurationProvider,
    private readonly runtime: PlaywrightRuntimeProvider,
    private readonly logger: Logger,
    private readonly timeoutMs = 2_000
  ) {}

  public async execute(formula: FormulaResource): Promise<Result<FormulaExecutionResult>> {
    const startedAt = performance.now();
    let server: BrowserServer | null = null;
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let timer: NodeJS.Timeout | undefined;
    try {
      const configuration = await this.browserSelection.resolveLaunchConfiguration();
      const playwright = await this.runtime.load();
      const browserType = playwright[configuration.engine];
      const activeServer = await browserType.launchServer({
        ...(configuration.executablePath === null ? {} : { executablePath: configuration.executablePath }),
        ...(configuration.channel === null ? {} : { channel: configuration.channel }),
        headless: true
      });
      server = activeServer;
      const activeBrowser = await browserType.connect(activeServer.wsEndpoint());
      browser = activeBrowser;
      context = await activeBrowser.newContext({ serviceWorkers: "block" });
      await context.setOffline(true);
      await context.route("**/*", (route) => route.abort("blockedbyclient"));
      await context.routeWebSocket(/.*/, () => undefined);
      const page = await context.newPage();
      await page.addScriptTag({ content: formula.code });

      const execution = page.evaluate(async () => {
        const candidate = (globalThis as typeof globalThis & { generate?: unknown }).generate;
        if (typeof candidate !== "function") throw new Error("La fórmula debe declarar function generate().");
        return await (candidate as () => unknown)();
      });
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          void server?.kill();
          reject(new Error(`La fórmula superó el timeout de ${this.timeoutMs} ms.`));
        }, this.timeoutMs);
      });
      const value: unknown = await Promise.race([execution, timeout]);
      if (value !== undefined && !isJsonValue(value)) return failure("La fórmula debe devolver un valor JSON o undefined.");
      return success({ value, valueType: value === null ? "null" : Array.isArray(value) ? "array" : typeof value, durationMs: performance.now() - startedAt });
    } catch (error: unknown) {
      this.logger.warn(error instanceof Error ? error.message : "La ejecución de la fórmula ha fallado.");
      return failure(error instanceof Error ? error.message : "La ejecución de la fórmula ha fallado.");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      await context?.close().catch(() => undefined);
      await browser?.close().catch(() => undefined);
      await server?.kill().catch(() => undefined);
    }
  }
}
