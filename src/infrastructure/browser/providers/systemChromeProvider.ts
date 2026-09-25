import type { BrowserProvider } from "../../../application/browser/browserProvider";
import type { BrowserLaunchConfiguration, BrowserProviderSnapshot } from "../../../domain/browser/browserProvider";
import type { PlaywrightRuntimeProvider } from "../playwrightRuntime";

export class SystemChromeProvider implements BrowserProvider {
  public readonly id = "system-chrome" as const;
  private cached: BrowserProviderSnapshot | null = null;

  public constructor(private readonly runtime: PlaywrightRuntimeProvider) {}

  public async inspect(force = false): Promise<BrowserProviderSnapshot> {
    if (!force && this.cached !== null) return this.cached;
    try {
      const { chromium } = await this.runtime.load();
      const browser = await chromium.launch({ channel: "chrome", headless: true });
      const browserVersion = browser.version();
      await browser.close();
      this.cached = {
        id: this.id,
        displayName: "Google Chrome instalado",
        state: "ready",
        browserVersion,
        executablePath: null,
        detail: "Google Chrome está instalado y Playwright puede iniciarlo mediante el canal estable.",
        installable: false
      };
    } catch (error: unknown) {
      this.cached = {
        id: this.id,
        displayName: "Google Chrome instalado",
        state: "missing",
        browserVersion: null,
        executablePath: null,
        detail: error instanceof Error
          ? `No se pudo iniciar Google Chrome: ${error.message}`
          : "No se encontró una instalación compatible de Google Chrome.",
        installable: false
      };
    }
    return this.cached;
  }

  public async resolveLaunchConfiguration(): Promise<BrowserLaunchConfiguration> {
    const snapshot = await this.inspect();
    if (snapshot.state !== "ready") throw new Error("Google Chrome no está instalado o Playwright no puede iniciarlo.");
    return { providerId: this.id, displayName: snapshot.displayName, engine: "chromium", executablePath: null, channel: "chrome" };
  }
}
