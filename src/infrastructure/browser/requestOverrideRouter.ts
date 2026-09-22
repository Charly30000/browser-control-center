import type { BrowserContext, Route } from "playwright-core";
import type { RequestOverrideEntry } from "../../domain/manual/manualProfile";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const globRegExp = (glob: string): RegExp => new RegExp(`^${escapeRegExp(glob).replace(/\\\*\\\*/g, ".*").replace(/\\\*/g, "[^/]*").replace(/\\\?/g, ".")}$`);

export const matchesOverride = (override: RequestOverrideEntry, url: string, method: string): boolean => {
  if (!override.enabled || (override.method !== "ANY" && override.method !== method.toUpperCase())) return false;
  if (override.matcherType === "exact") return url === override.matcher;
  if (override.matcherType === "glob") return globRegExp(override.matcher).test(url);
  try { return new RegExp(override.matcher).test(url); } catch { return false; }
};

export class RequestOverrideRouter {
  private overrides: readonly RequestOverrideEntry[] = [];

  public update(overrides: readonly RequestOverrideEntry[]): void { this.overrides = structuredClone(overrides); }

  public async attach(context: BrowserContext): Promise<void> {
    await context.route("**/*", (route) => this.handle(route));
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const override = this.overrides.find((candidate) => matchesOverride(candidate, request.url(), request.method()));
    if (override === undefined) { await route.continue(); return; }
    if (override.action === "abort") { await route.abort("blockedbyclient"); return; }
    const configuredHeaders = Object.fromEntries(override.headers.filter(({ enabled, key }) => enabled && key.trim() !== "").map(({ key, value }) => [key, value]));
    if (override.action === "fulfill") {
      await route.fulfill({ status: override.status, body: override.body, contentType: override.contentType, headers: configuredHeaders });
      return;
    }
    await route.continue({ headers: { ...request.headers(), ...configuredHeaders }, postData: override.body });
  }
}
