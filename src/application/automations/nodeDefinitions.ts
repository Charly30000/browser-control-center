import type { GeneratorType, HeaderEntry, CookieEntry, StorageEntry, RequestOverrideEntry, InputMode } from "../../domain/manual/manualProfile";
import { isJsonValue, type JsonValue } from "../../domain/manual/storageValue";
import { isRequestOverrideEntry, validateRequestOverride } from "../../domain/manual/requestOverride";
import type { AutomationNodeConfig } from "../../domain/automations/automation";
import { isVariableName } from "../../domain/automations/variables";
import { failure, success, type Result } from "../../shared/result";
import type { AssertionKind, ExtractProperty, WaitKind } from "./automationBrowserSession";
import type { NodeDefinition } from "./nodeRegistry";
import { NodeRegistry } from "./nodeRegistry";
import { DATA_ASSERTION_OPERATORS, DATA_ASSERTION_PATHS, DATA_ASSERTION_SOURCES, resolveDataAssertionPath, type DataAssertionOperator, type DataAssertionSource } from "../../domain/automations/dataAssertion";

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const asConfig = (value: unknown): Result<AutomationNodeConfig> => isRecord(value) && isJsonValue(value) ? success({ ...value }) : failure("La configuración debe ser un objeto JSON.");
const text = (config: AutomationNodeConfig, key: string): string => { const value = config[key]; if (typeof value !== "string") throw new Error(`El campo «${key}» debe ser texto.`); return value; };
const number = (config: AutomationNodeConfig, key: string): number => { const value = config[key]; if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`El campo «${key}» debe ser numérico.`); return value; };
const required = (value: string, label: string): void => { if (value.trim() === "") throw new Error(`${label} es obligatorio.`); };
const oneOf = <T extends string>(value: string, values: readonly T[], label: string): T => { if (!values.includes(value as T)) throw new Error(`${label} no es válido.`); return value as T; };

const validateConfig = (check: (config: AutomationNodeConfig) => void) => (value: unknown): Result<AutomationNodeConfig> => {
  const config = asConfig(value); if (!config.ok) return config;
  try { check(config.value); return config; }
  catch (error: unknown) { return failure(error instanceof Error ? error.message : "Configuración no válida."); }
};

const validateFields = (requiredText: readonly string[] = [], requiredNumbers: readonly string[] = []) => (value: unknown): Result<AutomationNodeConfig> => {
  const config = asConfig(value); if (!config.ok) return config;
  try {
    for (const key of requiredText) required(text(config.value, key), key);
    for (const key of requiredNumbers) number(config.value, key);
    return config;
  } catch (error: unknown) { return failure(error instanceof Error ? error.message : "Configuración no válida."); }
};

const asEntries = <T>(config: AutomationNodeConfig, validate: (value: unknown) => value is T): T[] => {
  const entries = config.entries;
  if (!Array.isArray(entries)) throw new Error("La lista de entradas no es válida.");
  const result: T[] = [];
  for (const entry of entries) { if (!validate(entry)) throw new Error("La lista de entradas no es válida."); result.push(structuredClone(entry)); }
  return result;
};

const isHeader = (value: unknown): value is HeaderEntry => isRecord(value) && typeof value.id === "string" && typeof value.key === "string" && typeof value.value === "string" && typeof value.enabled === "boolean";
const isCookie = (value: unknown): value is CookieEntry => isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.value === "string" && typeof value.domain === "string" && !value.domain.includes("://") && typeof value.path === "string" && (value.expires === null || typeof value.expires === "string") && typeof value.secure === "boolean" && typeof value.httpOnly === "boolean" && ["Strict", "Lax", "None"].includes(String(value.sameSite)) && typeof value.enabled === "boolean";
const isStorage = (value: unknown): value is StorageEntry => isRecord(value) && typeof value.id === "string" && typeof value.key === "string" && typeof value.value === "string" && ["string", "number", "boolean", "json", "null"].includes(String(value.valueType)) && typeof value.enabled === "boolean";
const isOverride = (value: unknown): value is RequestOverrideEntry => isRequestOverrideEntry(value) && validateRequestOverride(value).ok;
const validateEntryList = <T>(validate: (value: unknown) => value is T, extra?: (config: AutomationNodeConfig) => void) => validateConfig((config) => { asEntries(config, validate); extra?.(config); });

const definition = (value: NodeDefinition): NodeDefinition => value;

export const createDefaultNodeRegistry = (): NodeRegistry => {
  const registry = new NodeRegistry();
  registry.register(definition({
    type: "navigate", title: "Navigate", category: "Navegación", defaultTimeoutMs: 30_000,
    inspectorFields: [{ key: "url", label: "URL", kind: "text" }], validate: validateFields(["url"]),
    execute: async (context, config, _nodeId, timeoutMs) => context.browser.navigate(text(context.resolveConfig(config), "url"), timeoutMs)
  }));
  registry.register(definition({
    type: "click", title: "Click", category: "Página", defaultTimeoutMs: 10_000,
    inspectorFields: [{ key: "selector", label: "Selector CSS", kind: "text" }], validate: validateFields(["selector"]),
    execute: async (context, config, _nodeId, timeoutMs) => context.browser.click(text(context.resolveConfig(config), "selector"), timeoutMs)
  }));
  registry.register(definition({
    type: "fill", title: "Fill", category: "Página", defaultTimeoutMs: 10_000,
    inspectorFields: [
      { key: "selector", label: "Selector CSS", kind: "text" }, { key: "value", label: "Valor / {variable}", kind: "text" },
      { key: "mode", label: "Escritura", kind: "select", options: [{ value: "instant", label: "Instantánea" }, { value: "sequential", label: "Secuencial" }] },
      { key: "delayMs", label: "Retraso (ms)", kind: "number" }
    ], validate: validateConfig((config) => { required(text(config, "selector"), "selector"); oneOf(text(config, "mode"), ["instant", "sequential"], "mode"); if (number(config, "delayMs") < 0) throw new Error("delayMs no puede ser negativo."); }),
    execute: async (context, config, _nodeId, timeoutMs) => { const resolved = context.resolveConfig(config); const value = resolved.value; if (value === undefined) throw new Error("El valor es obligatorio."); await context.browser.fill(text(resolved, "selector"), value, text(resolved, "mode") as InputMode, number(resolved, "delayMs"), timeoutMs); }
  }));
  registry.register(definition({
    type: "generate-value", title: "Generate Value", category: "Datos", defaultTimeoutMs: 5_000,
    inspectorFields: [
      { key: "generatorType", label: "Generador", kind: "select", options: ["firstName", "lastName", "email", "phone", "number", "dni", "nie", "cif", "formula", "array"].map((value) => ({ value, label: value })) },
      { key: "outputVariable", label: "Variable de salida", kind: "text" }, { key: "resourceId", label: "Fórmula / Array", kind: "resource" },
      { key: "min", label: "Mínimo", kind: "text" }, { key: "max", label: "Máximo", kind: "text" }
    ], validate: validateConfig((config) => { const generatorType = oneOf(text(config, "generatorType"), ["firstName", "lastName", "email", "phone", "number", "dni", "nie", "cif", "formula", "array"], "generatorType"); const variable = text(config, "outputVariable"); if (!isVariableName(variable)) throw new Error("La variable de salida no es válida."); if ((generatorType === "formula" || generatorType === "array") && (typeof config.resourceId !== "string" || config.resourceId.trim() === "")) throw new Error("Selecciona una fórmula o array."); }),
    execute: async (context, config, nodeId) => {
      const resolved = context.resolveConfig(config); const generatorType = text(resolved, "generatorType") as GeneratorType;
      const result = await context.generators.resolve({ id: nodeId, generatorType, selector: "", propertyKind: "value", propertyName: "", min: typeof resolved.min === "string" ? resolved.min : "0", max: typeof resolved.max === "string" ? resolved.max : "100", resourceId: typeof resolved.resourceId === "string" && resolved.resourceId !== "" ? resolved.resourceId : null, inputMode: "instant", delayMs: 0, enabled: true });
      if (!result.ok) throw new Error(result.error); if (result.value === undefined) throw new Error("El generador no devolvió ningún valor.");
      const stored = context.variables.set(text(resolved, "outputVariable"), result.value); if (!stored.ok) throw new Error(stored.error);
    }
  }));
  registry.register(definition({
    type: "set-headers", title: "Set Headers", category: "Sesión", defaultTimeoutMs: 5_000,
    inspectorFields: [{ key: "entries", label: "Headers (JSON)", kind: "json" }], validate: validateEntryList(isHeader),
    execute: async (context, config) => context.browser.setHeaders(asEntries(context.resolveConfig(config), isHeader))
  }));
  registry.register(definition({
    type: "set-cookies", title: "Set Cookies", category: "Sesión", defaultTimeoutMs: 5_000,
    inspectorFields: [{ key: "entries", label: "Cookies (JSON, dominio sin protocolo)", kind: "json" }], validate: validateEntryList(isCookie),
    execute: async (context, config) => context.browser.setCookies(asEntries(context.resolveConfig(config), isCookie))
  }));
  registry.register(definition({
    type: "set-storage", title: "Set Storage", category: "Sesión", defaultTimeoutMs: 5_000,
    inspectorFields: [{ key: "scope", label: "Ámbito", kind: "select", options: [{ value: "local", label: "localStorage" }, { value: "session", label: "sessionStorage" }] }, { key: "entries", label: "Entradas (JSON)", kind: "json" }], validate: validateEntryList(isStorage, (config) => { oneOf(text(config, "scope"), ["local", "session"], "scope"); }),
    execute: async (context, config) => { const resolved = context.resolveConfig(config); await context.browser.setStorage(text(resolved, "scope") as "local" | "session", asEntries(resolved, isStorage)); }
  }));
  registry.register(definition({
    type: "request-override", title: "Request Override", category: "Red", defaultTimeoutMs: 5_000,
    inspectorFields: [{ key: "entries", label: "Overrides", kind: "json" }], validate: validateEntryList(isOverride),
    execute: async (context, config) => context.browser.setRequestOverrides(asEntries(context.resolveConfig(config), isOverride))
  }));
  registry.register(definition({
    type: "wait", title: "Wait", category: "Control", defaultTimeoutMs: 30_000,
    inspectorFields: [
      { key: "kind", label: "Tipo", kind: "select", options: ["fixed", "random", "element", "url", "navigation", "response"].map((value) => ({ value, label: value })) },
      { key: "durationMs", label: "Duración mínima", kind: "number" }, { key: "maxDurationMs", label: "Duración máxima", kind: "number" },
      { key: "selector", label: "Selector", kind: "text" }, { key: "url", label: "URL / patrón", kind: "text" }, { key: "status", label: "Status", kind: "number" }
    ], validate: validateConfig((config) => { const kind = oneOf(text(config, "kind"), ["fixed", "random", "element", "url", "navigation", "response"], "kind"); if ((kind === "fixed" || kind === "random") && number(config, "durationMs") < 0) throw new Error("La duración no puede ser negativa."); if (kind === "random" && number(config, "maxDurationMs") < number(config, "durationMs")) throw new Error("La duración máxima debe ser igual o mayor que la mínima."); if (kind === "element") required(text(config, "selector"), "selector"); if (kind === "url") required(text(config, "url"), "url"); if (kind === "response") { const status = number(config, "status"); if (!Number.isInteger(status) || status < 0 || status > 599) throw new Error("El status debe ser 0 o un entero HTTP válido."); } }),
    execute: async (context, config, _nodeId, timeoutMs) => { const resolved = context.resolveConfig(config); await context.browser.wait(text(resolved, "kind") as WaitKind, resolved, timeoutMs); }
  }));
  registry.register(definition({
    type: "assertion", title: "Assertion", category: "Validación", defaultTimeoutMs: 10_000,
    inspectorFields: [
      { key: "kind", label: "Tipo", kind: "select", options: ["exists", "visible", "text-equals", "value-equals", "url-equals", "response-status"].map((value) => ({ value, label: value })) },
      { key: "selector", label: "Selector", kind: "text" }, { key: "expected", label: "Esperado", kind: "text" }
    ], validate: validateConfig((config) => { const kind = oneOf(text(config, "kind"), ["exists", "visible", "text-equals", "value-equals", "url-equals", "response-status"], "kind"); if (!["url-equals", "response-status"].includes(kind)) required(text(config, "selector"), "selector"); if (["text-equals", "value-equals", "url-equals", "response-status"].includes(kind) && typeof config.expected !== "string") throw new Error("expected debe ser texto."); if (kind === "response-status" && (!Number.isInteger(Number(config.expected)) || Number(config.expected) < 100 || Number(config.expected) > 599)) throw new Error("El status esperado no es válido."); }),
    execute: async (context, config, _nodeId, timeoutMs) => { const resolved = context.resolveConfig(config); await context.browser.assert(text(resolved, "kind") as AssertionKind, resolved, timeoutMs); }
  }));
  registry.register(definition({
    type: "validate-data", title: "Validate Data", category: "Validación", defaultTimeoutMs: 10_000,
    inspectorFields: [
      { key: "source", label: "Fuente", kind: "select", options: [
        { value: "request", label: "Request observada" }, { value: "response", label: "Response observada" },
        { value: "cookie", label: "Cookie" }, { value: "localStorage", label: "localStorage" }, { value: "sessionStorage", label: "sessionStorage" }
      ] },
      { key: "urlPattern", label: "La URL contiene", kind: "text", visibleWhen: { key: "source", values: ["request", "response"] } },
      { key: "key", label: "Nombre / clave", kind: "text", visibleWhen: { key: "source", values: ["cookie", "localStorage", "sessionStorage"] } },
      { key: "path", label: "Campo / ruta interna", kind: "text" },
      { key: "operator", label: "Operador", kind: "select", options: [
        { value: "exists", label: "Existe" }, { value: "not-exists", label: "No existe" }, { value: "equals", label: "Es igual" },
        { value: "not-equals", label: "No es igual" }, { value: "contains", label: "Contiene" }, { value: "matches", label: "Coincide con regex" }, { value: "json-equals", label: "JSON equivalente" }
      ] },
      { key: "expected", label: "Valor esperado", kind: "textarea", visibleWhen: { key: "operator", values: ["equals", "not-equals", "contains", "matches", "json-equals"] } }
    ],
    validate: validateConfig((config) => {
      const source = oneOf(text(config, "source"), DATA_ASSERTION_SOURCES, "source");
      const operator = oneOf(text(config, "operator"), DATA_ASSERTION_OPERATORS, "operator");
      if (config.pathPreset !== undefined && (typeof config.pathPreset !== "string" || (config.pathPreset !== "custom" && !DATA_ASSERTION_PATHS[source].includes(config.pathPreset)))) throw new Error("El campo seleccionado no es válido para la fuente.");
      const path = resolveDataAssertionPath(source, config.pathPreset, config.path);
      if (source === "request" || source === "response") required(path, "path");
      else required(text(config, "key"), "key");
      if (config.pathPreset === "custom") required(path, "path");
      if (!["exists", "not-exists"].includes(operator) && typeof config.expected !== "string") throw new Error("expected debe ser texto.");
      if (operator === "matches") { try { new RegExp(text(config, "expected")); } catch { throw new Error("La expresión regular esperada no es válida."); } }
      if (operator === "json-equals") { try { JSON.parse(text(config, "expected")); } catch { throw new Error("El valor esperado debe ser JSON válido."); } }
    }),
    execute: async (context, config, _nodeId, timeoutMs) => {
      const resolved = context.resolveConfig(config);
      const source = text(resolved, "source") as DataAssertionSource;
      await context.browser.assertData(source, text(resolved, "operator") as DataAssertionOperator, { ...resolved, path: resolveDataAssertionPath(source, resolved.pathPreset, resolved.path) }, timeoutMs);
    }
  }));
  registry.register(definition({
    type: "extract-value", title: "Extract Value", category: "Datos", defaultTimeoutMs: 10_000,
    inspectorFields: [
      { key: "selector", label: "Selector", kind: "text" }, { key: "property", label: "Propiedad", kind: "select", options: ["value", "textContent", "innerText", "attribute"].map((value) => ({ value, label: value })) },
      { key: "attribute", label: "Atributo", kind: "text" }, { key: "outputVariable", label: "Variable de salida", kind: "text" }
    ], validate: validateConfig((config) => { required(text(config, "selector"), "selector"); const property = oneOf(text(config, "property"), ["value", "textContent", "innerText", "attribute"], "property"); if (property === "attribute") required(text(config, "attribute"), "attribute"); if (!isVariableName(text(config, "outputVariable"))) throw new Error("La variable de salida no es válida."); }),
    execute: async (context, config, _nodeId, timeoutMs) => { const resolved = context.resolveConfig(config); const value = await context.browser.extract(text(resolved, "selector"), text(resolved, "property") as ExtractProperty, typeof resolved.attribute === "string" ? resolved.attribute : "", timeoutMs); const stored = context.variables.set(text(resolved, "outputVariable"), value); if (!stored.ok) throw new Error(stored.error); }
  }));
  registry.register(definition({
    type: "set-variable", title: "Set Variable", category: "Datos", defaultTimeoutMs: 1_000,
    inspectorFields: [{ key: "name", label: "Nombre", kind: "text" }, { key: "value", label: "Valor", kind: "text" }], validate: validateConfig((config) => { if (!isVariableName(text(config, "name"))) throw new Error("El nombre de variable no es válido."); }),
    execute: (context, config) => { const resolved = context.resolveConfig(config); const value: JsonValue = resolved.value ?? null; const stored = context.variables.set(text(resolved, "name"), value); return stored.ok ? Promise.resolve() : Promise.reject(new Error(stored.error)); }
  }));
  registry.register(definition({
    type: "wait-user", title: "Pause / Wait User", category: "Control", defaultTimeoutMs: 3_600_000,
    inspectorFields: [{ key: "message", label: "Instrucciones", kind: "textarea" }], validate: validateFields(["message"]),
    execute: async (context, config, nodeId) => { let action: "continue" | "retry"; do { action = await context.waitForUser(nodeId, text(context.resolveConfig(config), "message")); } while (action === "retry"); }
  }));
  return registry;
};
