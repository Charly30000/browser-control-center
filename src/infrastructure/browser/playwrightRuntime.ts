import type * as PlaywrightModule from "playwright-core";

export type PlaywrightRuntime = Pick<typeof PlaywrightModule, "chromium">;

export interface PlaywrightRuntimeProvider { load(): Promise<PlaywrightRuntime>; }

export class PlaywrightRuntimeLoader implements PlaywrightRuntimeProvider {
  private runtime: Promise<PlaywrightRuntime> | null = null;

  public constructor(private readonly browserPath: string) {}

  public load(): Promise<PlaywrightRuntime> {
    process.env.PLAYWRIGHT_BROWSERS_PATH = this.browserPath;
    this.runtime ??= import("playwright-core");
    return this.runtime;
  }
}
