import { describe, expect, it } from "vitest";
import { createDefaultNodeRegistry } from "../src/application/automations/nodeDefinitions";
import { AUTOMATION_NODE_TYPES } from "../src/domain/automations/automation";

describe("NodeRegistry de automatizaciones", () => {
  const registry = createDefaultNodeRegistry();

  it("requires explicit removal scope and validates negative comparison inputs", () => {
    expect(registry.validate("remove-headers", { mode: "selected", names: "  " }).ok).toBe(false);
    expect(registry.validate("remove-headers", { mode: "all" }).ok).toBe(true);
    expect(registry.validate("remove-storage", { mode: "selected", names: "one\ntwo", scope: "session" }).ok).toBe(true);
    expect(registry.validate("remove-storage", { mode: "all", scope: "wrong" }).ok).toBe(false);
    expect(registry.validate("remove-cookies", { mode: "selected", names: "token", domain: "https://test.local", path: "/" }).ok).toBe(false);
    for (const [operator, expected] of [["not-matches", "["], ["json-not-equals", "invalid"]]) {
      expect(registry.validate("validate-data", { source: "cookie", key: "token", pathPreset: "value", operator, expected }).ok).toBe(false);
    }
    expect(registry.validate("assertion", { kind: "text-not-contains", selector: "", expected: "x" }).ok).toBe(false);
    expect(registry.validate("assertion", { kind: "response-status-not-equals", expected: "999" }).ok).toBe(false);
  });

  it("registra todos los nodos iniciales con metadatos para paleta e inspector", () => {
    expect(registry.descriptors().map(({ type }) => type)).toEqual(AUTOMATION_NODE_TYPES);
    expect(registry.descriptors().every(({ title, category, inspectorFields }) => title !== "" && category !== "" && Array.isArray(inspectorFields))).toBe(true);
    expect(registry.descriptors().find(({ type }) => type === "fill")).toMatchObject({ title: "Field", availableInPalette: true });
    expect(registry.descriptors().find(({ type }) => type === "generate-value")?.availableInPalette).toBe(false);
  });

  it("acepta texto y generadores directamente en Campo", () => {
    expect(registry.validate("fill", { selector: "#name", value: "Ada", mode: "instant", delayMs: 0 }).ok).toBe(true);
    expect(registry.validate("fill", { selector: "#name", generatorType: "firstName", resourceId: null, min: "0", max: "100", mode: "instant", delayMs: 0 }).ok).toBe(true);
    expect(registry.validate("fill", { selector: "#name", generatorType: "formula", resourceId: null, min: "0", max: "100", mode: "instant", delayMs: 0 }).ok).toBe(false);
  });

  it("valida la ruta y el destino de Guardar dato", () => {
    expect(registry.validate("capture-value", { path: "body.items.0.id", outputVariable: "itemId" }).ok).toBe(true);
    expect(registry.validate("capture-value", { path: "", outputVariable: "fullValue" }).ok).toBe(true);
    expect(registry.validate("capture-value", { path: "body..id", outputVariable: "itemId" }).ok).toBe(false);
    expect(registry.validate("capture-value", { path: "id", outputVariable: "not-valid" }).ok).toBe(false);
    expect(registry.validate("capture-value", { source: "dom", selector: "#name", property: "value", path: "", valueType: "number", outputVariable: "fieldNumber" }).ok).toBe(true);
    expect(registry.validate("capture-value", { source: "dom", selector: "", property: "value", path: "", outputVariable: "value" }).ok).toBe(false);
    expect(registry.validate("capture-value", { source: "dom", selector: "#name", property: "attribute", attribute: "", path: "", outputVariable: "value" }).ok).toBe(false);
    expect(registry.validate("capture-value", { source: "dom", selector: "#name", property: "unknown", path: "", outputVariable: "value" }).ok).toBe(false);
    expect(registry.validate("capture-value", { source: "unknown", path: "", outputVariable: "value" }).ok).toBe(false);
    expect(registry.validate("capture-value", { path: "", valueType: "unknown", outputVariable: "value" }).ok).toBe(false);
  });

  it("valida query params y valores de storage estructurados", () => {
    expect(registry.validate("navigate", { url: "https://example.com", queryParams: [{ id: "query", key: "page", value: "2", enabled: true }] }).ok).toBe(true);
    expect(registry.validate("navigate", { url: "https://example.com", queryParams: [{ id: "query", key: 1, value: "2", enabled: true }] }).ok).toBe(false);
    expect(registry.validate("set-storage", { scope: "local", entries: [{ id: "entry", key: "data", value: "{", valueType: "json", enabled: true }] }).ok).toBe(false);
  });

  it("rechaza configuraciones semánticamente inválidas", () => {
    expect(registry.validate("fill", { selector: "#name", value: "x", mode: "wrong", delayMs: 0 }).ok).toBe(false);
    expect(registry.validate("set-storage", { scope: "other", entries: [] }).ok).toBe(false);
    expect(registry.validate("request-override", { entries: [{ id: "x", matcherType: "exact", matcher: "", method: "GET", action: "fulfill", status: 200, headers: [], body: "", contentType: "text/plain", enabled: true }] }).ok).toBe(false);
    expect(registry.validate("validate-data", { source: "sessionStorage", urlPattern: "", key: "", path: "", operator: "equals", expected: "x" }).ok).toBe(false);
    expect(registry.validate("validate-data", { source: "request", urlPattern: "/api", key: "", path: "body.id", operator: "matches", expected: "[" }).ok).toBe(false);
    expect(registry.validate("validate-data", { source: "response", urlPattern: "/api", key: "", pathPreset: "body", path: "", operator: "json-equals", expected: "{\"ok\":true}" }).ok).toBe(true);
    expect(registry.validate("set-variable", { name: "not-valid", value: "x" }).ok).toBe(false);
  });
});
