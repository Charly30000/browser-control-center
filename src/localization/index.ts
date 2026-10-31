import config from "./config.json";
import { catalogs, fallbackCatalog } from "./generated/catalogs";

export type TranslationKey = keyof typeof fallbackCatalog;
export type TranslationCatalog = Readonly<Record<TranslationKey, string>>;
export type TranslationParameters = Readonly<Record<string, unknown>>;

const registeredCatalogs: Readonly<Record<string, Partial<TranslationCatalog>>> = catalogs;
const normalizeLocale = (locale: string): string => locale.replaceAll("_", "-").toLowerCase();

/** Resolves a regional locale through its parents before using the configured default. */
export const resolveLocale = (
  requested: string,
  supported: readonly string[] = Object.keys(catalogs),
  defaultLocale = config.defaultLocale
): string => {
  let candidate = normalizeLocale(requested);
  while (candidate !== "") {
    const match = supported.find((locale) => normalizeLocale(locale) === candidate);
    if (match !== undefined) return match;
    const separator = candidate.lastIndexOf("-");
    candidate = separator < 0 ? "" : candidate.slice(0, separator);
  }
  return supported.find((locale) => normalizeLocale(locale) === normalizeLocale(defaultLocale)) ?? config.fallbackLocale;
};

/** Values are substituted once as literal text; absent messages use the fallback catalog. */
export const createTranslator = (catalog: Partial<TranslationCatalog>) =>
  (key: TranslationKey, parameters: TranslationParameters = {}): string =>
    (catalog[key] ?? fallbackCatalog[key]).replace(/\{(\w+)\}/g, (placeholder: string, name: string) =>
      Object.hasOwn(parameters, name) ? String(parameters[name]) : placeholder);

let currentLocale = resolveLocale(typeof document === "undefined" ? config.defaultLocale : document.documentElement.lang);
let translate = createTranslator(registeredCatalogs[currentLocale] ?? fallbackCatalog);

/** Called at extension startup, before importing modules containing translated constants. */
export const initializeLocale = (requested: string): void => {
  currentLocale = resolveLocale(requested);
  translate = createTranslator(registeredCatalogs[currentLocale] ?? fallbackCatalog);
};

export const getLocale = (): string => currentLocale;
export const t = (key: TranslationKey, parameters: TranslationParameters = {}): string => translate(key, parameters);
