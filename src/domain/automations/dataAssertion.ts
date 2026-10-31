import { t } from "../../localization";
import { failure, success, type Result } from "../../shared/result";

export const DATA_ASSERTION_SOURCES = ["request", "response", "cookie", "localStorage", "sessionStorage"] as const;
export type DataAssertionSource = typeof DATA_ASSERTION_SOURCES[number];

export const DATA_ASSERTION_OPERATORS = ["exists", "not-exists", "equals", "not-equals", "contains", "not-contains", "matches", "not-matches", "json-equals", "json-not-equals"] as const;
export type DataAssertionOperator = typeof DATA_ASSERTION_OPERATORS[number];

export const DATA_ASSERTION_PATHS: Readonly<Record<DataAssertionSource, readonly string[]>> = {
  request: ["url", "method", "headers.content-type", "headers.authorization", "body"],
  response: ["url", "status", "headers.content-type", "body"],
  cookie: ["value", "domain", "path", "expires", "httpOnly", "secure", "sameSite"],
  localStorage: [""],
  sessionStorage: [""]
};

export const defaultDataAssertionPath = (source: DataAssertionSource): string => DATA_ASSERTION_PATHS[source][0] ?? "";

export const resolveDataAssertionPath = (source: DataAssertionSource, pathPreset: unknown, customPath: unknown): string => {
  if (typeof pathPreset !== "string") return typeof customPath === "string" ? customPath : defaultDataAssertionPath(source);
  return pathPreset === "custom" ? (typeof customPath === "string" ? customPath : "") : pathPreset;
};

const parseJson = (value: string): unknown => {
  try { return JSON.parse(value) as unknown; }
  catch { return value; }
};

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, canonical(entry)]));
};

const asText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" || typeof value === "symbol") return String(value);
  try { return JSON.stringify(value) ?? Object.prototype.toString.call(value); }
  catch { return Object.prototype.toString.call(value); }
};

export const readDataPath = (value: unknown, path: string): unknown => {
  if (path.trim() === "") return value;
  let current = value;
  for (const segment of path.split(".").filter(Boolean)) {
    if (typeof current === "string") current = parseJson(current);
    if (typeof current !== "object" || current === null || !Object.prototype.hasOwnProperty.call(current, segment)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

export const validateDataValue = (actual: unknown, operator: DataAssertionOperator, expected: string, label: string): Result<void> => {
  const exists = actual !== undefined && actual !== null;
  if (operator === "exists") return exists ? success(undefined) : failure(t("text.arg0DoesNotExist", { arg0: label }));
  if (operator === "not-exists") return exists ? failure(t("text.expectedArg0NotToExistButItContainsArg1", { arg0: label, arg1: asText(actual) })) : success(undefined);
  if (!exists) return failure(t("text.arg0DoesNotExistCannotApplyOperatorArg1", { arg0: label, arg1: operator }));

  const actualText = asText(actual);
  switch (operator) {
    case "equals": return actualText === expected ? success(undefined) : failure(t("text.expectedValueArg0ReceivedArg1AtArg2", { arg0: expected, arg1: actualText, arg2: label }));
    case "not-equals": return actualText !== expected ? success(undefined) : failure(t("text.theValueAtArg0MustNotBeArg1", { arg0: label, arg1: expected }));
    case "contains": return actualText.includes(expected) ? success(undefined) : failure(t("text.theValueAtArg0DoesNotContainArg1", { arg0: label, arg1: expected }));
    case "not-contains": return !actualText.includes(expected) ? success(undefined) : failure(t("validation.unexpectedContains", { label, expected }));
    case "matches":
    case "not-matches": {
      try { return new RegExp(expected).test(actualText) === (operator === "matches") ? success(undefined) : failure(t("validation.regexMismatch", { label, expected, operator })); }
      catch { return failure(t("text.theExpectedRegularExpressionIsInvalid")); }
    }
    case "json-equals":
    case "json-not-equals": {
      let expectedValue: unknown;
      try { expectedValue = JSON.parse(expected) as unknown; }
      catch { return failure(t("text.theExpectedValueMustBeValidJSON")); }
      const actualValue = typeof actual === "string" ? parseJson(actual) : actual;
      return (JSON.stringify(canonical(actualValue)) === JSON.stringify(canonical(expectedValue))) === (operator === "json-equals")
        ? success(undefined)
        : failure(t("validation.jsonMismatch", { label, operator }));
    }
    default: return failure(t("text.unsupportedValidationOperator"));
  }
};
