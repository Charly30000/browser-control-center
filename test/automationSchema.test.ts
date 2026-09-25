import { describe, expect, it } from "vitest";
import { AUTOMATION_NODE_TYPES, createAutomationDocument, createAutomationGroup, createAutomationNode, createAutomationProcess } from "../src/domain/automations/automation";
import { createDefaultNodeRegistry } from "../src/application/automations/nodeDefinitions";
import { validateAutomationDocument } from "../src/domain/automations/automationValidation";
import { deserializeAutomation, serializeAutomation } from "../src/infrastructure/persistence/automationSerializer";

describe("schema de automatizaciones", () => {
  it("serializa y valida un documento", () => {
    const document = createAutomationDocument("automation", "2026-01-01T00:00:00.000Z"); const group = createAutomationGroup("group", "Checkout"); const process = createAutomationProcess("process", "Compra");
    process.nodes.push(createAutomationNode("node", "navigate", { x: 0, y: 0 })); group.processes.push(process); document.groups.push(group);
    expect(validateAutomationDocument(document, createDefaultNodeRegistry()).ok).toBe(true);
    expect(deserializeAutomation(serializeAutomation(document))).toEqual({ ok: true, value: document });
  });
  it("rechaza IDs duplicados y tipos desconocidos", () => {
    const document = createAutomationDocument("automation"); const group = createAutomationGroup("group"); const process = createAutomationProcess("process");
    process.nodes.push(createAutomationNode("same", "navigate", { x: 0, y: 0 }), createAutomationNode("same", "click", { x: 0, y: 100 })); group.processes.push(process); document.groups.push(group);
    expect(validateAutomationDocument(document, createDefaultNodeRegistry()).ok).toBe(false);
  });

  it("conserva la configuración completa de todos los tipos de nodo", () => {
    const document = createAutomationDocument("automation", "2026-01-01T00:00:00.000Z");
    const group = createAutomationGroup("group", "Persistencia");
    const process = createAutomationProcess("process", "Todos los nodos");
    process.nodes.push(...AUTOMATION_NODE_TYPES.map((type, index) => createAutomationNode(`node-${type}`, type, { x: index * 10, y: index * 20 })));
    const validateData = process.nodes.find(({ type }) => type === "validate-data");
    if (validateData === undefined) throw new Error("No se creó el nodo Validate Data.");
    validateData.config = {
      source: "response",
      urlPattern: "/api/example",
      key: "",
      pathPreset: "body",
      path: "",
      operator: "json-equals",
      expected: "{\"ok\":true}"
    };
    group.processes.push(process);
    document.groups.push(group);

    const result = deserializeAutomation(serializeAutomation(document));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.groups[0]?.processes[0]?.nodes).toEqual(process.nodes);
  });
});
