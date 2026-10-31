import { t } from "../../../localization";
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
        displayName: t("text.installedGoogleChrome"),
        state: "ready",
        browserVersion,
        executablePath: null,
        detail: t("text.googleChromeIsInstalledAndPlaywrightCanLaunchItUsingTheStableChannel"),
        installable: false
      };
    } catch (error: unknown) {
      this.cached = {
        id: this.id,
        displayName: t("text.installedGoogleChrome"),
        state: "missing",
        browserVersion: null,
        executablePath: null,
        detail: error instanceof Error
          ? t("text.couldNotStartGoogleChromeArg0", { arg0: error.message })
          : t("text.noCompatibleGoogleChromeInstallationWasFound"),
        installable: false
      };
    }
    return this.cached;
  }

  public async resolveLaunchConfiguration(): Promise<BrowserLaunchConfiguration> {
    const snapshot = await this.inspect();
    if (snapshot.state !== "ready") throw new Error(t("text.googleChromeIsNotInstalledOrPlaywrightCannotLaunchIt"));
    return { providerId: this.id, displayName: snapshot.displayName, engine: "chromium", executablePath: null, channel: "chrome" };
  }
}
