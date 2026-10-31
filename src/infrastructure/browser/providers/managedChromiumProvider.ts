import { t } from "../../../localization";
import type { BrowserProvider } from "../../../application/browser/browserProvider";
import type { BrowserLaunchConfiguration, BrowserProviderSnapshot } from "../../../domain/browser/browserProvider";
import type { BrowserBinaryManager } from "./browserBinaryManager";

export class ManagedChromiumProvider implements BrowserProvider {
  public readonly id = "managed-chromium" as const;

  public constructor(private readonly binaries: BrowserBinaryManager) {}

  public async inspect(): Promise<BrowserProviderSnapshot> {
    const snapshot = await this.binaries.inspect();
    return {
      id: this.id,
      displayName: t("text.managedChromium"),
      state: snapshot.state,
      browserVersion: snapshot.browserVersion,
      executablePath: snapshot.executablePath,
      detail: snapshot.detail,
      installable: true
    };
  }

  public async resolveLaunchConfiguration(): Promise<BrowserLaunchConfiguration> {
    return {
      providerId: this.id,
      displayName: t("text.managedChromium"),
      engine: "chromium",
      executablePath: await this.binaries.requireExecutablePath(),
      channel: null
    };
  }

  public onDidChange(listener: () => void): { dispose(): void } { return this.binaries.onDidChange(listener); }
}
