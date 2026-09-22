import type { BrowserContext } from "playwright-core";
import type { CookieEntry, HeaderEntry, StorageEntry } from "../../domain/manual/manualProfile";
import { parseStorageValue } from "../../domain/manual/storageValue";

export const toHeaderRecord = (headers: readonly HeaderEntry[]): Record<string, string> =>
  Object.fromEntries(headers.filter(({ enabled, key }) => enabled && key.trim() !== "").map(({ key, value }) => [key.trim(), value]));

export const toCookieParams = (cookies: readonly CookieEntry[], fallbackUrl: string): Parameters<BrowserContext["addCookies"]>[0] =>
  cookies.filter(({ enabled, name }) => enabled && name.trim() !== "").map((cookie) => {
    const expires = cookie.expires === null ? undefined : Math.floor(new Date(cookie.expires).getTime() / 1000);
    if (expires !== undefined && !Number.isFinite(expires)) throw new Error(`La fecha de expiración de la cookie «${cookie.name}» no es válida.`);
    const common = { name: cookie.name, value: cookie.value, secure: cookie.secure, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite, ...(expires === undefined ? {} : { expires }) };
    return cookie.domain.trim() === "" ? { ...common, url: fallbackUrl } : { ...common, domain: cookie.domain.trim(), path: cookie.path || "/" };
  });

export const toStorageValues = (entries: readonly StorageEntry[]): readonly { readonly key: string; readonly value: string }[] =>
  entries.filter(({ enabled, key }) => enabled && key.trim() !== "").map((entry) => {
    const parsed = parseStorageValue(entry.valueType, entry.value);
    if (!parsed.ok) throw new Error(`Storage «${entry.key}»: ${parsed.error}`);
    return { key: entry.key, value: typeof parsed.value === "string" ? parsed.value : JSON.stringify(parsed.value) };
  });
