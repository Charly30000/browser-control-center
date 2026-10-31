import { t } from "../../localization";
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { Browser, BrowserContext, BrowserServer } from "playwright-core";
import type { Logger } from "../../application/logging/logger";
import type { BrowserLifecycleState, BrowserStopMode } from "../../domain/browser/browserBridge";
import type { BrowserLaunchConfiguration } from "../../domain/browser/browserProvider";
import type { ViewportConfiguration } from "../../domain/manual/manualProfile";
import type { PlaywrightRuntimeProvider } from "./playwrightRuntime";

export interface BrowserRuntimeSession {
  readonly browser: Browser;
  readonly context: BrowserContext;
}

export class BrowserLifecycleManager {
  private state: BrowserLifecycleState = "stopped";
  private server: BrowserServer | null = null;
  private session: BrowserRuntimeSession | null = null;
  private sessionPath: string | null = null;
  private operation: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<(state: BrowserLifecycleState) => void>();

  public constructor(
    private readonly runtime: PlaywrightRuntimeProvider,
    private readonly runtimeRoot: string,
    private readonly logger: Logger
  ) {}

  public getState(): BrowserLifecycleState { return this.state; }
  public getSession(): BrowserRuntimeSession | null { return this.session; }

  public onDidChange(listener: (state: BrowserLifecycleState) => void): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  public start(configuration: BrowserLaunchConfiguration, viewport: ViewportConfiguration): Promise<BrowserRuntimeSession> {
    return this.enqueue(async () => {
      if (this.session !== null && this.state === "running") return this.session;
      return this.performStart(configuration, viewport);
    });
  }

  public stop(mode: BrowserStopMode): Promise<void> {
    return this.enqueue(() => this.performStop(mode));
  }

  public restart(configuration: BrowserLaunchConfiguration, viewport: ViewportConfiguration): Promise<BrowserRuntimeSession> {
    return this.enqueue(async () => {
      await this.performStop("graceful");
      return this.performStart(configuration, viewport);
    });
  }

  private async performStart(configuration: BrowserLaunchConfiguration, viewport: ViewportConfiguration): Promise<BrowserRuntimeSession> {
    this.setState("starting");
    const sessionPath = join(this.runtimeRoot, randomUUID());
    await mkdir(join(sessionPath, "downloads"), { recursive: true });
    this.sessionPath = sessionPath;
    try {
      const playwright = await this.runtime.load();
      const browserType = playwright[configuration.engine];
      const server = await browserType.launchServer({
        ...(configuration.executablePath === null ? {} : { executablePath: configuration.executablePath }),
        ...(configuration.channel === null ? {} : { channel: configuration.channel }),
        headless: false,
        downloadsPath: join(sessionPath, "downloads")
      });
      this.server = server;
      const browser = await browserType.connect(server.wsEndpoint());
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        screen: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.deviceScaleFactor,
        hasTouch: viewport.hasTouch,
        isMobile: viewport.isMobile,
        serviceWorkers: "block"
      });
      this.session = { browser, context };
      browser.once("disconnected", () => {
        if (this.state !== "running" || this.server !== server) return;
        this.session = null;
        this.server = null;
        this.setState("crashed");
        void this.cleanSessionPath().catch((error: unknown) => this.logger.error(t("text.couldNotCleanUpTheUnexpectedlyClosedSession"), error));
        this.logger.error(t("text.arg0ClosedUnexpectedly", { arg0: configuration.displayName }));
      });
      this.setState("running");
      this.logger.info(t("text.cleanIsolatedArg0SessionStarted", { arg0: configuration.displayName }));
      return this.session;
    } catch (error: unknown) {
      if (this.server !== null) await this.server.kill().catch(() => undefined);
      this.server = null;
      this.session = null;
      await this.cleanSessionPath();
      this.setState("crashed");
      this.logger.error(t("text.couldNotStartArg0", { arg0: configuration.displayName }), error);
      throw error;
    }
  }

  private async performStop(mode: BrowserStopMode): Promise<void> {
    if (this.state === "stopped" && this.server === null) return;
    this.setState("stopping");
    const server = this.server;
    const context = this.session?.context;
    this.session = null;
    this.server = null;
    try {
      await context?.close().catch(() => undefined);
      if (server !== null) {
        if (mode === "force") await server.kill().catch((error: unknown) => this.logger.error(t("text.couldNotTerminateTheBrowserProcess"), error));
        else await this.closeServer(server);
      }
    } finally {
      await this.cleanSessionPath();
      this.setState("stopped");
      this.logger.info(mode === "force" ? t("text.browserForceStopped") : t("text.browserStopped"));
    }
  }

  private async cleanSessionPath(): Promise<void> {
    const target = this.sessionPath;
    this.sessionPath = null;
    if (target !== null) await rm(target, { recursive: true, force: true });
  }

  private async closeServer(server: BrowserServer): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        server.close(),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(t("text.timedOutWhileClosingTheBrowser"))), 3_000); })
      ]);
    } catch (error: unknown) {
      this.logger.warn(t("text.normalBrowserShutdownFailedAForcedStopWillBeAttempted"));
      await server.kill().catch((killError: unknown) => this.logger.error(t("text.couldNotForceCloseTheBrowser"), killError ?? error));
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private setState(state: BrowserLifecycleState): void {
    this.state = state;
    for (const listener of this.listeners) listener(state);
  }

  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const result = this.operation.then(action, action);
    this.operation = result.then(() => undefined, () => undefined);
    return result;
  }
}
