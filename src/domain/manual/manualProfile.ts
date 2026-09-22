export const MANUAL_PROFILE_SCHEMA_VERSION = 1 as const;

export type StorageValueType = "string" | "number" | "boolean" | "json" | "null";
export type MatcherType = "exact" | "glob" | "regex";
export type HttpMethod = "ANY" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
export type OverrideAction = "fulfill" | "abort" | "continue-modified";
export type SameSite = "Strict" | "Lax" | "None";
export type GeneratorType =
  | "firstName"
  | "lastName"
  | "email"
  | "phone"
  | "number"
  | "dni"
  | "nie"
  | "cif"
  | "formula"
  | "array";
export type TargetPropertyKind = "value" | "textContent" | "innerText" | "checked" | "attribute" | "property";

export interface QueryParamEntry {
  readonly id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface HeaderEntry {
  readonly id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface CookieEntry {
  readonly id: string;
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: string | null;
  secure: boolean;
  httpOnly: boolean;
  sameSite: SameSite;
  enabled: boolean;
}

export interface StorageEntry {
  readonly id: string;
  key: string;
  value: string;
  valueType: StorageValueType;
  enabled: boolean;
}

export interface RequestOverrideEntry {
  readonly id: string;
  matcherType: MatcherType;
  matcher: string;
  method: HttpMethod;
  action: OverrideAction;
  status: number;
  headers: HeaderEntry[];
  body: string;
  contentType: string;
  enabled: boolean;
}

export interface GeneratorBinding {
  readonly id: string;
  generatorType: GeneratorType;
  selector: string;
  propertyKind: TargetPropertyKind;
  propertyName: string;
  min: string;
  max: string;
  resourceId: string | null;
  enabled: boolean;
}

export interface ViewportPreset {
  width: number;
  height: number;
}

export interface ManualProfile {
  readonly schemaVersion: typeof MANUAL_PROFILE_SCHEMA_VERSION;
  readonly id: string;
  name: string;
  url: string;
  queryParams: QueryParamEntry[];
  headers: HeaderEntry[];
  cookies: CookieEntry[];
  localStorage: StorageEntry[];
  sessionStorage: StorageEntry[];
  requestOverrides: RequestOverrideEntry[];
  generatorBindings: GeneratorBinding[];
  viewport: ViewportPreset | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileSummary {
  readonly id: string;
  readonly name: string;
  readonly updatedAt: string;
}

export const createEmptyManualProfile = (
  id: string,
  name: string,
  now = new Date().toISOString()
): ManualProfile => ({
  schemaVersion: MANUAL_PROFILE_SCHEMA_VERSION,
  id,
  name,
  url: "https://example.com",
  queryParams: [],
  headers: [],
  cookies: [],
  localStorage: [],
  sessionStorage: [],
  requestOverrides: [],
  generatorBindings: [],
  viewport: null,
  createdAt: now,
  updatedAt: now
});

export const createQueryParam = (id: string): QueryParamEntry => ({ id, key: "", value: "", enabled: true });
export const createHeader = (id: string): HeaderEntry => ({ id, key: "", value: "", enabled: true });
export const createCookie = (id: string): CookieEntry => ({
  id,
  name: "",
  value: "",
  domain: "",
  path: "/",
  expires: null,
  secure: false,
  httpOnly: false,
  sameSite: "Lax",
  enabled: true
});
export const createStorageEntry = (id: string): StorageEntry => ({
  id,
  key: "",
  value: "",
  valueType: "string",
  enabled: true
});
export const createRequestOverride = (id: string): RequestOverrideEntry => ({
  id,
  matcherType: "exact",
  matcher: "",
  method: "ANY",
  action: "fulfill",
  status: 200,
  headers: [],
  body: "",
  contentType: "application/json",
  enabled: true
});
export const createGeneratorBinding = (id: string): GeneratorBinding => ({
  id,
  generatorType: "firstName",
  selector: "",
  propertyKind: "value",
  propertyName: "",
  min: "0",
  max: "100",
  resourceId: null,
  enabled: true
});
