import { failure, success, type Result } from "../../shared/result";

export const DATA_ASSERTION_SOURCES = ["request", "response", "cookie", "localStorage", "sessionStorage"] as const;
export type DataAssertionSource = typeof DATA_ASSERTION_SOURCES[number];

export const DATA_ASSERTION_OPERATORS = ["exists", "not-exists", "equals", "not-equals", "contains", "matches", "json-equals"] as const;
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
  if (operator === "exists") return exists ? success(undefined) : failure(`No existe ${label}.`);
  if (operator === "not-exists") return exists ? failure(`Se esperaba que ${label} no existiera, pero contiene ${asText(actual)}.`) : success(undefined);
  if (!exists) return failure(`No existe ${label}; no se puede aplicar el operador ${operator}.`);

  const actualText = asText(actual);
  switch (operator) {
    case "equals": return actualText === expected ? success(undefined) : failure(`Valor esperado «${expected}», recibido «${actualText}» en ${label}.`);
    case "not-equals": return actualText !== expected ? success(undefined) : failure(`El valor de ${label} no debía ser «${expected}».`);
    case "contains": return actualText.includes(expected) ? success(undefined) : failure(`El valor de ${label} no contiene «${expected}».`);
    case "matches": {
      try { return new RegExp(expected).test(actualText) ? success(undefined) : failure(`El valor de ${label} no coincide con /${expected}/.`); }
      catch { return failure("La expresión regular esperada no es válida."); }
    }
    case "json-equals": {
      let expectedValue: unknown;
      try { expectedValue = JSON.parse(expected) as unknown; }
      catch { return failure("El valor esperado debe ser JSON válido."); }
      const actualValue = typeof actual === "string" ? parseJson(actual) : actual;
      return JSON.stringify(canonical(actualValue)) === JSON.stringify(canonical(expectedValue))
        ? success(undefined)
        : failure(`El JSON recibido en ${label} no coincide con el esperado.`);
    }
    default: return failure("Operador de validación no soportado.");
  }
};
