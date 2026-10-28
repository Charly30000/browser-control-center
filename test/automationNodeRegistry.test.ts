import { describe, expect, it } from "vitest";
import { createDefaultNodeRegistry } from "../src/application/automations/nodeDefinitions";
import { AUTOMATION_NODE_TYPES } from "../src/domain/automations/automation";

describe("NodeRegistry de automatizaciones", () => {
  const registry = createDefaultNodeRegistry();

  it("registra todos los nodos iniciales con metadatos para paleta e inspector", () => {
    expect(registry.descriptors().map(({ type }) => type)).toEqual(AUTOMATION_NODE_TYPES);
    expect(registry.descriptors().every(({ title, category, inspectorFields }) => title !== "" && category !== "" && Array.isArray(inspectorFields))).toBe(true);
    expect(registry.descriptors().find(({ type }) => type === "fill")).toMatchObject({ title: "Campo", availableInPalette: true });
    expect(registry.descriptors().find(({ type }) => type === "generate-value")?.availableInPalette).toBe(false);
  });

  it("acepta texto y generadores directamente en Campo", () => {
    expect(registry.validate("fill", { selector: "#name", value: "Ada", mode: "instant", delayMs: 0 }).ok).toBe(true);
    expect(registry.validate("fill", { selector: "#name", generatorType: "firstName", resourceId: null, min: "0", max: "100", mode: "instant", delayMs: 0 }).ok).toBe(true);
    expect(registry.validate("fill", { selector: "#name", generatorType: "formula", resourceId: null, min: "0", max: "100", mode: "instant", delayMs: 0 }).ok).toBe(false);
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
