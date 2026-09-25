import type { BrowserLaunchConfiguration, BrowserProviderId, BrowserProviderSnapshot } from "../../domain/browser/browserProvider";

export interface BrowserProvider {
  readonly id: BrowserProviderId;
  inspect(force?: boolean): Promise<BrowserProviderSnapshot>;
  resolveLaunchConfiguration(): Promise<BrowserLaunchConfiguration>;
  onDidChange?(listener: () => void): { dispose(): void };
}

export interface BrowserLaunchConfigurationProvider {
  resolveLaunchConfiguration(): Promise<BrowserLaunchConfiguration>;
}
