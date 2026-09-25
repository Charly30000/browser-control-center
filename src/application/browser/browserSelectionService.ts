import type { BrowserPreferences, BrowserProviderId, BrowserProviderSnapshot } from "../../domain/browser/browserProvider";
import type { StateDataDao } from "../persistence/applicationDataDao";
import type { BrowserLaunchConfigurationProvider, BrowserProvider } from "./browserProvider";

export class BrowserSelectionService implements BrowserLaunchConfigurationProvider {
  private readonly providers: ReadonlyMap<BrowserProviderId, BrowserProvider>;
  private readonly listeners = new Set<() => void>();

  public constructor(
    providers: readonly BrowserProvider[],
    private readonly preferencesDao: StateDataDao<BrowserPreferences>
  ) {
    this.providers = new Map(providers.map((provider) => [provider.id, provider]));
    for (const provider of providers) provider.onDidChange?.(() => this.emit());
  }

  public getSelectedProviderId(): BrowserProviderId {
    return this.preferencesDao.get().selectedProviderId;
  }

  public async select(providerId: BrowserProviderId): Promise<void> {
    if (!this.providers.has(providerId)) throw new Error(`El navegador «${providerId}» no está registrado.`);
    await this.preferencesDao.set({ version: 1, selectedProviderId: providerId });
    this.emit();
  }

  public async inspectProviders(force = false): Promise<readonly BrowserProviderSnapshot[]> {
    return Promise.all([...this.providers.values()].map((provider) => provider.inspect(force)));
  }

  public async resolveLaunchConfiguration() {
    return this.requireSelected().resolveLaunchConfiguration();
  }

  public onDidChange(listener: () => void): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  private requireSelected(): BrowserProvider {
    const id = this.getSelectedProviderId();
    const provider = this.providers.get(id);
    if (provider === undefined) throw new Error(`El navegador seleccionado «${id}» no está disponible.`);
    return provider;
  }

  private emit(): void { for (const listener of this.listeners) listener(); }
}
