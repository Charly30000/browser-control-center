import { t } from "../../localization";
import {
  MANUAL_PROFILE_SCHEMA_VERSION,
  type CookieEntry,
  type GeneratorBinding,
  type HeaderEntry,
  type ManualProfile,
  type QueryParamEntry,
  type RequestOverrideEntry,
  type StorageEntry,
  type ViewportConfiguration
} from "../../domain/manual/manualProfile";
import { failure, success, type Result } from "../../shared/result";
import { isOptionalEditorPreferences } from "../../domain/resources/editorPreferences";
import { migrateSchema } from "../../application/persistence/schemaMigration";
import { persistedSchemas } from "./migrations/registry";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isStringOrNull = (value: unknown): value is string | null => value === null || isString(value);
const isOneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T =>
  isString(value) && allowed.includes(value as T);

const isQueryParam = (value: unknown): value is QueryParamEntry =>
  isRecord(value) && isString(value.id) && isString(value.key) && isString(value.value) && isBoolean(value.enabled);

const isHeader = (value: unknown): value is HeaderEntry => isQueryParam(value);

const isCookie = (value: unknown): value is CookieEntry =>
  isRecord(value) &&
  (value.expanded === undefined || isBoolean(value.expanded)) &&
  isString(value.id) &&
  isString(value.name) &&
  isString(value.value) &&
  isString(value.domain) &&
  isString(value.path) &&
  isStringOrNull(value.expires) &&
  isBoolean(value.secure) &&
  isBoolean(value.httpOnly) &&
  isOneOf(value.sameSite, ["Strict", "Lax", "None"] as const) &&
  isBoolean(value.enabled);

const isStorageEntry = (value: unknown): value is StorageEntry =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.key) &&
  isString(value.value) &&
  isOneOf(value.valueType, ["string", "number", "boolean", "json", "null"] as const) &&
  isBoolean(value.enabled);

const isRequestOverride = (value: unknown): value is RequestOverrideEntry =>
  isRecord(value) &&
  (value.expanded === undefined || isBoolean(value.expanded)) &&
  isString(value.id) &&
  isOneOf(value.matcherType, ["exact", "glob", "regex"] as const) &&
  isString(value.matcher) &&
  isOneOf(value.method, ["ANY", "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const) &&
  isOneOf(value.action, ["fulfill", "abort", "continue-modified"] as const) &&
  typeof value.status === "number" && Number.isFinite(value.status) &&
  Array.isArray(value.headers) && value.headers.every(isHeader) &&
  isString(value.body) &&
  isString(value.contentType) &&
  isBoolean(value.enabled);

const isGeneratorBinding = (value: unknown): value is GeneratorBinding =>
  isRecord(value) &&
  (value.expanded === undefined || isBoolean(value.expanded)) &&
  isString(value.id) &&
  isOneOf(value.generatorType, ["string", "firstName", "lastName", "email", "phone", "number", "dni", "nie", "cif", "formula", "array"] as const) &&
  isString(value.selector) &&
  isOneOf(value.propertyKind, ["value", "textContent", "innerText", "checked", "attribute", "property"] as const) &&
  isString(value.propertyName) &&
  isString(value.min) &&
  isString(value.max) &&
  isStringOrNull(value.resourceId) &&
  (value.literalValue === undefined || isString(value.literalValue)) &&
  isOneOf(value.inputMode, ["instant", "sequential"] as const) &&
  typeof value.delayMs === "number" && Number.isFinite(value.delayMs) && value.delayMs >= 0 &&
  isBoolean(value.enabled);

const isViewport = (value: unknown): value is ViewportConfiguration =>
  isRecord(value) &&
  isOneOf(value.preset, ["desktop", "laptop", "tabletPortrait", "tabletLandscape", "mobilePortrait", "mobileLandscape", "custom"] as const) &&
  typeof value.width === "number" && Number.isInteger(value.width) && value.width > 0 &&
  typeof value.height === "number" && Number.isInteger(value.height) && value.height > 0 &&
  typeof value.deviceScaleFactor === "number" && Number.isFinite(value.deviceScaleFactor) && value.deviceScaleFactor > 0 &&
  isBoolean(value.hasTouch) && isBoolean(value.isMobile);

export const isManualProfile = (value: unknown): value is ManualProfile =>
  isRecord(value) &&
  value.schemaVersion === MANUAL_PROFILE_SCHEMA_VERSION &&
  isString(value.id) && value.id.length > 0 &&
  isString(value.name) &&
  isString(value.url) &&
  Array.isArray(value.queryParams) && value.queryParams.every(isQueryParam) &&
  Array.isArray(value.headers) && value.headers.every(isHeader) &&
  Array.isArray(value.cookies) && value.cookies.every(isCookie) &&
  Array.isArray(value.localStorage) && value.localStorage.every(isStorageEntry) &&
  Array.isArray(value.sessionStorage) && value.sessionStorage.every(isStorageEntry) &&
  Array.isArray(value.requestOverrides) && value.requestOverrides.every(isRequestOverride) &&
  Array.isArray(value.generatorBindings) && value.generatorBindings.every(isGeneratorBinding) &&
  isViewport(value.viewport) &&
  isOptionalEditorPreferences(value.preferences) &&
  isString(value.createdAt) &&
  isString(value.updatedAt);

export const serializeProfile = (profile: ManualProfile): string => JSON.stringify(profile, null, 2);

export const deserializeProfile = (serialized: string): Result<ManualProfile> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return failure(t("text.theFileDoesNotContainValidJSON"));
  }
  if (!isRecord(parsed)) {
    return failure(t("text.theProfileMustBeAJSONObject"));
  }
  const migrated = migrateSchema(parsed, persistedSchemas.manual);
  if (!migrated.ok) return migrated;
  parsed = migrated.value;
  if (!isRecord(parsed)) return failure(t("text.theProfileMustBeAJSONObject"));
  if (parsed.schemaVersion !== MANUAL_PROFILE_SCHEMA_VERSION) {
    return failure(t("text.unsupportedProfileVersionExpectedArg0", { arg0: MANUAL_PROFILE_SCHEMA_VERSION }));
  }
  return isManualProfile(parsed)
    ? success(parsed)
    : failure(t("text.theContentDoesNotHaveTheStructureOfAValidManualProfile"));
};
