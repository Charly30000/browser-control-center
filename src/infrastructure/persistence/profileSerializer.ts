import {
  MANUAL_PROFILE_SCHEMA_VERSION,
  type CookieEntry,
  type GeneratorBinding,
  type HeaderEntry,
  type ManualProfile,
  type QueryParamEntry,
  type RequestOverrideEntry,
  type StorageEntry,
  type ViewportConfiguration,
  defaultViewport
} from "../../domain/manual/manualProfile";
import { failure, success, type Result } from "../../shared/result";

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
  isString(value.id) &&
  isOneOf(value.generatorType, ["firstName", "lastName", "email", "phone", "number", "dni", "nie", "cif", "formula", "array"] as const) &&
  isString(value.selector) &&
  isOneOf(value.propertyKind, ["value", "textContent", "innerText", "checked", "attribute", "property"] as const) &&
  isString(value.propertyName) &&
  isString(value.min) &&
  isString(value.max) &&
  isStringOrNull(value.resourceId) &&
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

const migrateVersionOne = (value: UnknownRecord): unknown => {
  if (value.schemaVersion !== 1 || !Array.isArray(value.generatorBindings)) return value;
  const legacyViewport = isRecord(value.viewport) &&
    typeof value.viewport.width === "number" && typeof value.viewport.height === "number"
    ? { ...defaultViewport(), preset: "custom" as const, width: value.viewport.width, height: value.viewport.height }
    : defaultViewport();
  return {
    ...value,
    schemaVersion: MANUAL_PROFILE_SCHEMA_VERSION,
    viewport: legacyViewport,
    generatorBindings: value.generatorBindings.map((binding): unknown => isRecord(binding)
      ? { ...binding, inputMode: "instant", delayMs: 0 }
      : null)
  };
};

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
  isString(value.createdAt) &&
  isString(value.updatedAt);

export const serializeProfile = (profile: ManualProfile): string => JSON.stringify(profile, null, 2);

export const deserializeProfile = (serialized: string): Result<ManualProfile> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return failure("El archivo no contiene JSON válido.");
  }
  if (!isRecord(parsed)) {
    return failure("El perfil debe ser un objeto JSON.");
  }
  parsed = migrateVersionOne(parsed);
  if (!isRecord(parsed)) return failure("El perfil debe ser un objeto JSON.");
  if (parsed.schemaVersion !== MANUAL_PROFILE_SCHEMA_VERSION) {
    return failure(`Versión de perfil no compatible. Se esperaba ${MANUAL_PROFILE_SCHEMA_VERSION}.`);
  }
  return isManualProfile(parsed)
    ? success(parsed)
    : failure("El contenido no tiene la estructura de un perfil Manual válido.");
};
