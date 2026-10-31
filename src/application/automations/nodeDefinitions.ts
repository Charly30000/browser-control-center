import { t } from "../../localization";
import { dataAssertionOperatorLabel, nodeOptionLabel } from "../../localization/displayLabels";
import { ASSERTION_COMPARISONS, ASSERTION_KINDS } from "../../domain/automations/assertion";
import type { GeneratorType, HeaderEntry, CookieEntry, StorageEntry, RequestOverrideEntry, InputMode, QueryParamEntry } from "../../domain/manual/manualProfile";
import { buildUrlWithQueryParams } from "../../domain/manual/queryParams";
import { isJsonValue, parseStorageValue, type JsonValue } from "../../domain/manual/storageValue";
import { isRequestOverrideEntry, validateRequestOverride } from "../../domain/manual/requestOverride";
import type { AutomationNodeConfig } from "../../domain/automations/automation";
import { isVariableName } from "../../domain/automations/variables";
import { failure, success, type Result } from "../../shared/result";
import type { AssertionKind, ExtractProperty, WaitKind } from "./automationBrowserSession";
import type { InspectorField, NodeDefinition } from "./nodeRegistry";
import { NodeRegistry } from "./nodeRegistry";
import { DATA_ASSERTION_OPERATORS, DATA_ASSERTION_PATHS, DATA_ASSERTION_SOURCES, readDataPath, resolveDataAssertionPath, type DataAssertionOperator, type DataAssertionSource } from "../../domain/automations/dataAssertion";

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const asConfig = (value: unknown): Result<AutomationNodeConfig> => isRecord(value) && isJsonValue(value) ? success({ ...value }) : failure(t("text.theConfigurationMustBeAJSONObject"));
const text = (config: AutomationNodeConfig, key: string): string => { const value = config[key]; if (typeof value !== "string") throw new Error(t("text.fieldArg0MustBeText", { arg0: key })); return value; };
const number = (config: AutomationNodeConfig, key: string): number => { const value = config[key]; if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(t("text.fieldArg0MustBeNumeric", { arg0: key })); return value; };
const required = (value: string, label: string): void => { if (value.trim() === "") throw new Error(t("text.arg0IsRequired", { arg0: label })); };
const removalNames = (config: AutomationNodeConfig): string[] | null => {
  if (text(config, "mode") === "all") return null;
  const names = text(config, "names").split(/\r?\n/).map((name) => name.trim()).filter(Boolean);
  if (names.length === 0) throw new Error(t("sessionRemoval.namesRequired"));
  return [...new Set(names)];
};
const oneOf = <T extends string>(value: string, values: readonly T[], label: string): T => { if (!values.includes(value as T)) throw new Error(t("text.arg0IsInvalid", { arg0: label })); return value as T; };
const removalFields = (): readonly InspectorField[] => [
  { key: "mode", label: t("sessionRemoval.mode"), kind: "select", options: [{ value: "selected", label: t("sessionRemoval.selected") }, { value: "all", label: t("sessionRemoval.all") }] },
  { key: "names", label: t("sessionRemoval.names"), kind: "name-list", visibleWhen: { key: "mode", values: ["selected"] } }
];
const validateRemoval = (config: AutomationNodeConfig): void => {
  oneOf(text(config, "mode"), ["selected", "all"], "mode");
  removalNames(config);
};

const validateConfig = (check: (config: AutomationNodeConfig) => void) => (value: unknown): Result<AutomationNodeConfig> => {
  const config = asConfig(value); if (!config.ok) return config;
  try { check(config.value); return config; }
  catch (error: unknown) { return failure(error instanceof Error ? error.message : t("text.invalidConfiguration")); }
};

const validateFields = (requiredText: readonly string[] = [], requiredNumbers: readonly string[] = []) => (value: unknown): Result<AutomationNodeConfig> => {
  const config = asConfig(value); if (!config.ok) return config;
  try {
    for (const key of requiredText) required(text(config.value, key), key);
    for (const key of requiredNumbers) number(config.value, key);
    return config;
  } catch (error: unknown) { return failure(error instanceof Error ? error.message : t("text.invalidConfiguration")); }
};

const asEntries = <T>(config: AutomationNodeConfig, validate: (value: unknown) => value is T): T[] => {
  const entries = config.entries;
  if (!Array.isArray(entries)) throw new Error(t("text.theEntryListIsInvalid"));
  const result: T[] = [];
  for (const entry of entries) { if (!validate(entry)) throw new Error(t("text.theEntryListIsInvalid")); result.push(structuredClone(entry)); }
  return result;
};

const isHeader = (value: unknown): value is HeaderEntry => isRecord(value) && typeof value.id === "string" && typeof value.key === "string" && typeof value.value === "string" && typeof value.enabled === "boolean";
const isQueryParam = (value: unknown): value is QueryParamEntry => isHeader(value);
const isCookie = (value: unknown): value is CookieEntry => isRecord(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.value === "string" && typeof value.domain === "string" && !value.domain.includes("://") && typeof value.path === "string" && (value.expires === null || typeof value.expires === "string") && typeof value.secure === "boolean" && typeof value.httpOnly === "boolean" && ["Strict", "Lax", "None"].includes(String(value.sameSite)) && typeof value.enabled === "boolean";
const isStorage = (value: unknown): value is StorageEntry => isRecord(value) && typeof value.id === "string" && typeof value.key === "string" && typeof value.value === "string" && ["string", "number", "boolean", "json", "null"].includes(String(value.valueType)) && parseStorageValue(value.valueType as StorageEntry["valueType"], value.value).ok && typeof value.enabled === "boolean";
const isOverride = (value: unknown): value is RequestOverrideEntry => isRequestOverrideEntry(value) && validateRequestOverride(value).ok;
const validateEntryList = <T>(validate: (value: unknown) => value is T, extra?: (config: AutomationNodeConfig) => void) => validateConfig((config) => { asEntries(config, validate); extra?.(config); });
const queryParamsFrom = (config: AutomationNodeConfig): QueryParamEntry[] => {
  if (config.queryParams === undefined) return [];
  if (!Array.isArray(config.queryParams)) throw new Error(t("text.theQueryParametersAreInvalid"));
  const result: QueryParamEntry[] = [];
  for (const entry of config.queryParams) {
    if (!isQueryParam(entry)) throw new Error(t("text.theQueryParametersAreInvalid"));
    result.push(structuredClone(entry));
  }
  return result;
};

const definition = (value: NodeDefinition): NodeDefinition => value;

const generatorOptions: readonly { readonly value: GeneratorType; readonly label: string }[] = [
  { value: "string", label: t("text.fixedText") },
  { value: "firstName", label: t("text.name") },
  { value: "lastName", label: t("text.lastName") },
  { value: "email", label: t("text.email") },
  { value: "phone", label: t("text.phone") },
  { value: "number", label: t("text.number2") },
  { value: "dni", label: t("text.dni") },
  { value: "nie", label: t("text.nie") },
  { value: "cif", label: t("text.cif") },
  { value: "formula", label: t("text.formula") },
  { value: "array", label: t("text.array") }
];

const generatorTypeFrom = (config: AutomationNodeConfig): GeneratorType => {
  if (config.generatorType === undefined) return "string";
  return oneOf(text(config, "generatorType"), generatorOptions.map(({ value }) => value), t("text.valueSource"));
};

const validateGeneratorSelection = (config: AutomationNodeConfig, generatorType: GeneratorType): void => {
  if ((generatorType === "formula" || generatorType === "array") && (typeof config.resourceId !== "string" || config.resourceId.trim() === "")) {
    throw new Error(t("text.selectAFormulaOrArray"));
  }
  if (generatorType === "number") {
    text(config, "min");
    text(config, "max");
  }
};

export const createDefaultNodeRegistry = (): NodeRegistry => {
  const registry = new NodeRegistry();
  registry.register(definition({
    type: "navigate", title: t("text.navigate"), category: t("text.navigation"), defaultTimeoutMs: 30_000,
    inspectorFields: [], validate: validateConfig((config) => {
      required(text(config, "url"), t("text.url"));
      queryParamsFrom(config);
    }),
    execute: async (context, config, _nodeId, timeoutMs) => {
      const resolved = context.resolveConfig(config);
      const url = buildUrlWithQueryParams(text(resolved, "url"), queryParamsFrom(resolved));
      if (!url.ok) throw new Error(url.error);
      await context.browser.navigate(url.value, timeoutMs);
    }
  }));
  registry.register(definition({
    type: "click", title: t("text.click"), category: t("text.page"), defaultTimeoutMs: 10_000,
    inspectorFields: [{ key: "selector", label: t("text.cssSelector"), kind: "text" }], validate: validateFields(["selector"]),
    execute: async (context, config, _nodeId, timeoutMs) => context.browser.click(text(context.resolveConfig(config), "selector"), timeoutMs)
  }));
  registry.register(definition({
    type: "fill", title: t("text.field"), category: t("text.page"), defaultTimeoutMs: 10_000,
    inspectorFields: [
      { key: "selector", label: t("text.cssSelector"), kind: "text" },
      { key: "generatorType", label: t("text.valueSource2"), kind: "select", options: generatorOptions },
      { key: "value", label: t("text.textVariable"), kind: "text", visibleWhen: { key: "generatorType", values: ["string"] } },
      { key: "resourceId", label: t("text.formulaArray"), kind: "resource" },
      { key: "min", label: t("text.minimum"), kind: "text", visibleWhen: { key: "generatorType", values: ["number"] } },
      { key: "max", label: t("text.maximum"), kind: "text", visibleWhen: { key: "generatorType", values: ["number"] } },
      { key: "mode", label: t("text.typing"), kind: "select", options: [{ value: "instant", label: t("text.instant") }, { value: "sequential", label: t("text.sequential") }] },
      { key: "delayMs", label: t("text.delayMs"), kind: "number", visibleWhen: { key: "mode", values: ["sequential"] } }
    ], validate: validateConfig((config) => {
      required(text(config, "selector"), "selector");
      const generatorType = generatorTypeFrom(config);
      validateGeneratorSelection(config, generatorType);
      if (generatorType === "string" && config.value === undefined) throw new Error(t("text.textIsRequired"));
      oneOf(text(config, "mode"), ["instant", "sequential"], "mode");
      if (number(config, "delayMs") < 0) throw new Error(t("errors.delayNegative"));
    }),
    execute: async (context, config, nodeId, timeoutMs) => {
      const resolved = context.resolveConfig(config);
      const generatorType = generatorTypeFrom(resolved);
      let value = resolved.value;
      if (generatorType !== "string") {
        const generated = await context.generators.resolve({ id: nodeId, generatorType, selector: "", propertyKind: "value", propertyName: "", min: typeof resolved.min === "string" ? resolved.min : "0", max: typeof resolved.max === "string" ? resolved.max : "100", resourceId: typeof resolved.resourceId === "string" && resolved.resourceId !== "" ? resolved.resourceId : null, inputMode: "instant", delayMs: 0, enabled: true });
        if (!generated.ok) throw new Error(generated.error);
        value = generated.value;
      }
      if (value === undefined) throw new Error(t("text.theValueCannotBeUndefined"));
      await context.browser.fill(text(resolved, "selector"), value, text(resolved, "mode") as InputMode, number(resolved, "delayMs"), timeoutMs);
      return value;
    }
  }));
  registry.register(definition({
    type: "generate-value", title: t("text.generateValue"), category: t("text.data"), defaultTimeoutMs: 5_000,
    availableInPalette: false,
    inspectorFields: [
      { key: "generatorType", label: t("text.generator"), kind: "select", options: generatorOptions.filter(({ value }) => value !== "string") },
      { key: "outputVariable", label: t("text.outputVariable"), kind: "text" }, { key: "resourceId", label: t("text.formulaArray"), kind: "resource" },
      { key: "min", label: t("text.minimum"), kind: "text" }, { key: "max", label: t("text.maximum"), kind: "text" }
    ], validate: validateConfig((config) => { const generatorType = oneOf(text(config, "generatorType"), ["firstName", "lastName", "email", "phone", "number", "dni", "nie", "cif", "formula", "array"], "generatorType"); const variable = text(config, "outputVariable"); if (!isVariableName(variable)) throw new Error(t("text.theOutputVariableIsInvalid")); if ((generatorType === "formula" || generatorType === "array") && (typeof config.resourceId !== "string" || config.resourceId.trim() === "")) throw new Error(t("text.selectAFormulaOrArray")); }),
    execute: async (context, config, nodeId) => {
      const resolved = context.resolveConfig(config); const generatorType = text(resolved, "generatorType") as GeneratorType;
      const result = await context.generators.resolve({ id: nodeId, generatorType, selector: "", propertyKind: "value", propertyName: "", min: typeof resolved.min === "string" ? resolved.min : "0", max: typeof resolved.max === "string" ? resolved.max : "100", resourceId: typeof resolved.resourceId === "string" && resolved.resourceId !== "" ? resolved.resourceId : null, inputMode: "instant", delayMs: 0, enabled: true });
      if (!result.ok) throw new Error(result.error); if (result.value === undefined) throw new Error(t("text.theGeneratorDidNotReturnAValue"));
      const stored = context.variables.set(text(resolved, "outputVariable"), result.value); if (!stored.ok) throw new Error(stored.error);
      return result.value;
    }
  }));
  registry.register(definition({
    type: "set-headers", title: t("text.setHeaders"), category: t("text.session"), defaultTimeoutMs: 5_000,
    inspectorFields: [], validate: validateEntryList(isHeader),
    execute: async (context, config) => context.browser.setHeaders(asEntries(context.resolveConfig(config), isHeader))
  }));
  registry.register(definition({
    type: "set-cookies", title: t("text.setCookies"), category: t("text.session"), defaultTimeoutMs: 5_000,
    inspectorFields: [], validate: validateEntryList(isCookie),
    execute: async (context, config) => context.browser.setCookies(asEntries(context.resolveConfig(config), isCookie))
  }));
  registry.register(definition({
    type: "set-storage", title: t("text.setStorage"), category: t("text.session"), defaultTimeoutMs: 5_000,
    inspectorFields: [], validate: validateEntryList(isStorage, (config) => { oneOf(text(config, "scope"), ["local", "session"], "scope"); }),
    execute: async (context, config) => { const resolved = context.resolveConfig(config); await context.browser.setStorage(text(resolved, "scope") as "local" | "session", asEntries(resolved, isStorage)); }
  }));
  registry.register(definition({
    type: "remove-headers", title: t("sessionRemoval.headers"), category: t("text.session"), defaultTimeoutMs: 5_000,
    inspectorFields: removalFields(), validate: validateConfig(validateRemoval),
    execute: async (context, config) => context.browser.removeHeaders(removalNames(context.resolveConfig(config)))
  }));
  registry.register(definition({
    type: "remove-cookies", title: t("sessionRemoval.cookies"), category: t("text.session"), defaultTimeoutMs: 5_000,
    inspectorFields: [...removalFields(),
      { key: "domain", label: t("sessionRemoval.domain"), kind: "text", visibleWhen: { key: "mode", values: ["selected"] } },
      { key: "path", label: t("sessionRemoval.path"), kind: "text", visibleWhen: { key: "mode", values: ["selected"] } }
    ], validate: validateConfig((config) => {
      validateRemoval(config);
      if (config.mode === "selected") {
        const domain = text(config, "domain"); const path = text(config, "path");
        if (domain.includes("://") || domain.includes("/")) throw new Error(t("sessionRemoval.invalidDomain"));
        if (path !== "" && !path.startsWith("/")) throw new Error(t("sessionRemoval.invalidPath"));
      }
    }),
    execute: async (context, config) => {
      const resolved = context.resolveConfig(config);
      await context.browser.removeCookies(removalNames(resolved), typeof resolved.domain === "string" ? resolved.domain.trim() : "", typeof resolved.path === "string" ? resolved.path.trim() : "");
    }
  }));
  registry.register(definition({
    type: "remove-storage", title: t("sessionRemoval.storage"), category: t("text.session"), defaultTimeoutMs: 5_000,
    inspectorFields: [
      { key: "scope", label: t("sessionRemoval.scope"), kind: "select", options: [{ value: "local", label: "localStorage" }, { value: "session", label: "sessionStorage" }] },
      ...removalFields()
    ], validate: validateConfig((config) => { validateRemoval(config); oneOf(text(config, "scope"), ["local", "session"], "scope"); }),
    execute: async (context, config) => {
      const resolved = context.resolveConfig(config);
      await context.browser.removeStorage(text(resolved, "scope") as "local" | "session", removalNames(resolved));
    }
  }));
  registry.register(definition({
    type: "request-override", title: t("text.requestOverride"), category: t("text.network"), defaultTimeoutMs: 5_000,
    inspectorFields: [], validate: validateEntryList(isOverride),
    execute: async (context, config) => context.browser.setRequestOverrides(asEntries(context.resolveConfig(config), isOverride))
  }));
  registry.register(definition({
    type: "wait", title: t("text.wait"), category: "Control", defaultTimeoutMs: 30_000,
    inspectorFields: [
      { key: "kind", label: t("text.type"), kind: "select", options: ["fixed", "random", "element", "url", "navigation", "response"].map((value) => ({ value, label: nodeOptionLabel(value) })) },
      { key: "durationMs", label: t("text.minimumDuration"), kind: "number" }, { key: "maxDurationMs", label: t("text.maximumDuration"), kind: "number" },
      { key: "selector", label: t("text.selector"), kind: "text" }, { key: "url", label: t("text.urlPattern"), kind: "text" }, { key: "status", label: t("text.status"), kind: "number" }
    ], validate: validateConfig((config) => { const kind = oneOf(text(config, "kind"), ["fixed", "random", "element", "url", "navigation", "response"], "kind"); if ((kind === "fixed" || kind === "random") && number(config, "durationMs") < 0) throw new Error(t("text.durationCannotBeNegative")); if (kind === "random" && number(config, "maxDurationMs") < number(config, "durationMs")) throw new Error(t("text.theMaximumDurationMustBeGreaterThanOrEqualToTheMinimum")); if (kind === "element") required(text(config, "selector"), "selector"); if (kind === "url") required(text(config, "url"), "url"); if (kind === "response") { const status = number(config, "status"); if (!Number.isInteger(status) || status < 0 || status > 599) throw new Error(t("text.statusMustBe0OrAValidHTTPInteger")); } }),
    execute: async (context, config, _nodeId, timeoutMs) => { const resolved = context.resolveConfig(config); return context.browser.wait(text(resolved, "kind") as WaitKind, resolved, timeoutMs); }
  }));
  registry.register(definition({
    type: "assertion", title: t("text.assertion"), category: t("text.validation"), defaultTimeoutMs: 10_000,
    inspectorFields: [
      { key: "kind", label: t("text.type"), kind: "select", options: ASSERTION_KINDS.map((value) => ({ value, label: nodeOptionLabel(value) })) },
      { key: "selector", label: t("text.selector"), kind: "text", visibleWhen: { key: "kind", values: ASSERTION_KINDS.filter((kind) => !kind.startsWith("url-") && !kind.startsWith("response-status")) } },
      { key: "expected", label: t("text.expected"), kind: "text", visibleWhen: { key: "kind", values: Object.keys(ASSERTION_COMPARISONS) } }
    ], validate: validateConfig((config) => {
      const kind = oneOf(text(config, "kind"), ASSERTION_KINDS, "kind");
      const comparison = kind in ASSERTION_COMPARISONS ? ASSERTION_COMPARISONS[kind as keyof typeof ASSERTION_COMPARISONS] : null;
      if (comparison === null || comparison.target === "text" || comparison.target === "value") required(text(config, "selector"), "selector");
      if (comparison !== null && typeof config.expected !== "string") throw new Error(t("text.expectedMustBeText"));
      if (comparison?.target === "status" && (!Number.isInteger(Number(config.expected)) || Number(config.expected) < 100 || Number(config.expected) > 599)) throw new Error(t("text.theExpectedStatusIsInvalid"));
    }),
    execute: async (context, config, _nodeId, timeoutMs) => { const resolved = context.resolveConfig(config); await context.browser.assert(text(resolved, "kind") as AssertionKind, resolved, timeoutMs); }
  }));
  registry.register(definition({
    type: "validate-data", title: t("text.validateData"), category: t("text.validation"), defaultTimeoutMs: 10_000,
    inspectorFields: [
      { key: "source", label: t("text.source"), kind: "select", options: [
        { value: "request", label: t("text.observedRequest") }, { value: "response", label: t("text.observedResponse") },
        { value: "cookie", label: "Cookie" }, { value: "localStorage", label: t("text.localstorage") }, { value: "sessionStorage", label: t("text.sessionstorage") }
      ] },
      { key: "urlPattern", label: t("text.urlContains"), kind: "text", visibleWhen: { key: "source", values: ["request", "response"] } },
      { key: "key", label: t("text.nameKey"), kind: "text", visibleWhen: { key: "source", values: ["cookie", "localStorage", "sessionStorage"] } },
      { key: "path", label: t("text.fieldInternalPath"), kind: "text" },
      { key: "operator", label: t("text.operator"), kind: "select", options: DATA_ASSERTION_OPERATORS.map((value) => ({ value, label: dataAssertionOperatorLabel(value) })) },
      { key: "expected", label: t("text.expectedValue"), kind: "textarea", visibleWhen: { key: "operator", values: DATA_ASSERTION_OPERATORS.filter((value) => value !== "exists" && value !== "not-exists") } }
    ],
    validate: validateConfig((config) => {
      const source = oneOf(text(config, "source"), DATA_ASSERTION_SOURCES, "source");
      const operator = oneOf(text(config, "operator"), DATA_ASSERTION_OPERATORS, "operator");
      if (config.pathPreset !== undefined && (typeof config.pathPreset !== "string" || (config.pathPreset !== "custom" && !DATA_ASSERTION_PATHS[source].includes(config.pathPreset)))) throw new Error(t("text.theSelectedFieldIsInvalidForThisSource"));
      const path = resolveDataAssertionPath(source, config.pathPreset, config.path);
      if (source === "request" || source === "response") required(path, "path");
      else required(text(config, "key"), "key");
      if (config.pathPreset === "custom") required(path, "path");
      if (!["exists", "not-exists"].includes(operator) && typeof config.expected !== "string") throw new Error(t("text.expectedMustBeText"));
      if (operator === "matches" || operator === "not-matches") { try { new RegExp(text(config, "expected")); } catch { throw new Error(t("text.theExpectedRegularExpressionIsInvalid")); } }
      if (operator === "json-equals" || operator === "json-not-equals") { try { JSON.parse(text(config, "expected")); } catch { throw new Error(t("text.theExpectedValueMustBeValidJSON")); } }
    }),
    execute: async (context, config, _nodeId, timeoutMs) => {
      const resolved = context.resolveConfig(config);
      const source = text(resolved, "source") as DataAssertionSource;
      await context.browser.assertData(source, text(resolved, "operator") as DataAssertionOperator, { ...resolved, path: resolveDataAssertionPath(source, resolved.pathPreset, resolved.path) }, timeoutMs);
    }
  }));
  registry.register(definition({
    type: "extract-value", title: t("text.extractValue"), category: t("text.data"), defaultTimeoutMs: 10_000,
    inspectorFields: [
      { key: "selector", label: t("text.selector"), kind: "text" }, { key: "property", label: t("text.property"), kind: "select", options: ["value", "textContent", "innerText", "attribute"].map((value) => ({ value, label: value })) },
      { key: "attribute", label: t("text.attribute2"), kind: "text" }, { key: "outputVariable", label: t("text.outputVariable"), kind: "text" }
    ], validate: validateConfig((config) => { required(text(config, "selector"), "selector"); const property = oneOf(text(config, "property"), ["value", "textContent", "innerText", "attribute"], "property"); if (property === "attribute") required(text(config, "attribute"), "attribute"); if (!isVariableName(text(config, "outputVariable"))) throw new Error(t("text.theOutputVariableIsInvalid")); }),
    execute: async (context, config, _nodeId, timeoutMs) => { const resolved = context.resolveConfig(config); const value = await context.browser.extract(text(resolved, "selector"), text(resolved, "property") as ExtractProperty, typeof resolved.attribute === "string" ? resolved.attribute : "", timeoutMs); const stored = context.variables.set(text(resolved, "outputVariable"), value); if (!stored.ok) throw new Error(stored.error); return value; }
  }));
  registry.register(definition({
    type: "set-variable", title: t("text.setVariable"), category: t("text.data"), defaultTimeoutMs: 1_000,
    inspectorFields: [{ key: "name", label: t("text.name"), kind: "text" }, { key: "value", label: t("text.value"), kind: "text" }], validate: validateConfig((config) => { if (!isVariableName(text(config, "name"))) throw new Error(t("text.theVariableNameIsInvalid")); }),
    execute: (context, config) => { const resolved = context.resolveConfig(config); const value: JsonValue = resolved.value ?? null; const stored = context.variables.set(text(resolved, "name"), value); return stored.ok ? Promise.resolve(value) : Promise.reject(new Error(stored.error)); }
  }));
  registry.register(definition({
    type: "capture-value", title: t("text.saveData"), category: t("text.data"), defaultTimeoutMs: 10_000,
    inspectorFields: [
      { key: "source", label: t("text.dataSource"), kind: "select", options: [{ value: "previous", label: t("text.previousNodeOutput") }, { value: "dom", label: t("text.domElementTextField") }] },
      { key: "selector", label: t("text.cssSelector"), kind: "text", visibleWhen: { key: "source", values: ["dom"] } },
      { key: "property", label: t("text.elementReadType"), kind: "select", options: [
        { value: "value", label: t("text.fieldValueInputTextareaSelect") },
        { value: "textContent", label: t("text.textContentTextContent") },
        { value: "innerText", label: t("text.visibleTextInnerText") },
        { value: "attribute", label: t("text.elementAttribute") }
      ], visibleWhen: { key: "source", values: ["dom"] } },
      { key: "attribute", label: t("text.attributeNameWhenReadingAnAttribute"), kind: "text", visibleWhen: { key: "source", values: ["dom"] } },
      { key: "path", label: t("text.optionalJSONPathEmptyFullValue"), kind: "text" },
      { key: "valueType", label: t("text.storedDataType"), kind: "select", options: [
        { value: "auto", label: t("text.keepOriginalType") }, { value: "string", label: t("text.text") },
        { value: "number", label: t("text.number2") }, { value: "boolean", label: t("text.booleanTrueFalse") },
        { value: "json", label: t("text.json") }, { value: "null", label: t("text.null2") }
      ] },
      { key: "outputVariable", label: t("text.outputVariable"), kind: "text" }
    ],
    validate: validateConfig((config) => {
      const source = oneOf(config.source === undefined ? "previous" : text(config, "source"), ["previous", "dom"], t("labels.origin"));
      if (source === "dom") {
        required(text(config, "selector"), t("text.cssSelector"));
        const property = oneOf(config.property === undefined ? "value" : text(config, "property"), ["value", "textContent", "innerText", "attribute"], t("text.readType"));
        if (property === "attribute") required(text(config, "attribute"), t("text.attributeName"));
      }
      oneOf(config.valueType === undefined ? "auto" : text(config, "valueType"), ["auto", "string", "number", "boolean", "json", "null"], t("text.dataType"));
      const path = text(config, "path");
      if (path !== "" && path.split(".").some((segment) => segment.trim() === "")) throw new Error(t("text.thePathMustContainDotSeparatedPropertiesOrIndices"));
      if (!isVariableName(text(config, "outputVariable"))) throw new Error(t("text.theOutputVariableIsInvalid"));
    }),
    execute: async (context, config, _nodeId, timeoutMs) => {
      const resolved = context.resolveConfig(config);
      const input = resolved.source === "dom"
        ? await context.browser.extract(text(resolved, "selector"), (resolved.property ?? "value") as ExtractProperty, typeof resolved.attribute === "string" ? resolved.attribute : "", timeoutMs)
        : context.previousOutput();
      const selectedValue = readDataPath(input, text(resolved, "path"));
      if (selectedValue === undefined) throw new Error(t("text.thePathDoesNotExistInTheSourceData"));
      if (!isJsonValue(selectedValue)) throw new Error(t("text.theSelectedDataIsNotAValidJSONValue"));
      let value: JsonValue = selectedValue;
      const valueType = oneOf(resolved.valueType === undefined ? "auto" : text(resolved, "valueType"), ["auto", "string", "number", "boolean", "json", "null"], t("text.dataType"));
      if (valueType !== "auto") {
        const converted = parseStorageValue(valueType, typeof value === "string" ? value : JSON.stringify(value));
        if (!converted.ok) throw new Error(t("text.cannotSaveTheDataAsArg0Arg1", { arg0: valueType, arg1: converted.error }));
        value = converted.value;
      }
      const stored = context.variables.set(text(resolved, "outputVariable"), value);
      if (!stored.ok) throw new Error(stored.error);
      return value;
    }
  }));
  registry.register(definition({
    type: "wait-user", title: t("text.pauseWaitUser"), category: "Control", defaultTimeoutMs: 3_600_000,
    inspectorFields: [{ key: "message", label: t("text.instructions"), kind: "textarea" }], validate: validateFields(["message"]),
    execute: async (context, config, nodeId) => { let action: "continue" | "retry"; do { action = await context.waitForUser(nodeId, text(context.resolveConfig(config), "message")); } while (action === "retry"); }
  }));
  return registry;
};
