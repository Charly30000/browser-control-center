import { describe, expect, it } from "vitest";
import { createDefaultNodeRegistry } from "../src/application/automations/nodeDefinitions";
import { AUTOMATION_NODE_TYPES } from "../src/domain/automations/automation";
import { validateAutomationProcess } from "../src/domain/automations/automationValidation";
import { AUTOMATION_EXAMPLE_URL, createCompleteAutomationExample, repairCompleteAutomationExamples } from "../src/domain/automations/exampleAutomation";
import { createAutomationDocument } from "../src/domain/automations/automation";

describe("ejemplo completo de automatizaciones", () => {
  it("crea un proceso válido por tipo y termina con todos concatenados", () => {
    let sequence = 0;
    const group = createCompleteAutomationExample(() => `example-${sequence += 1}`);
    const dedicatedTypes = ["request-override", "navigate", "click", "fill", "fill", "set-headers", "set-cookies", "set-storage", "wait", "assertion", "validate-data", "extract-value", "set-variable", "wait-user", "capture-value"] as const;
    const concatenated = group.processes.at(-1);

    expect(group.processes).toHaveLength(dedicatedTypes.length + 3);
    expect(group.processes[0]?.viewport).toMatchObject({ preset: "custom", width: 390, height: 844, hasTouch: true, isMobile: true });
    expect(group.processes[1]?.variables).toEqual({ initialName: "Ada", expectedGreeting: "Hola, Ada" });
    dedicatedTypes.forEach((type, index) => expect(group.processes[index + 2]?.nodes.some((node) => node.type === type)).toBe(true));
    expect(concatenated?.viewport).toMatchObject({ width: 390, height: 844 });
    expect(concatenated?.variables.initialName).toBe("Ada");
    expect(new Set(concatenated?.nodes.map(({ type }) => type))).toEqual(new Set(AUTOMATION_NODE_TYPES.filter((type) => type !== "generate-value")));
    expect(group.processes.every((process) => process.edges.length === process.nodes.length - 1)).toBe(true);
    expect(group.processes.every((process) => process.nodes.find(({ type }) => type === "navigate")?.config.url === AUTOMATION_EXAMPLE_URL)).toBe(true);
    expect(group.processes.every((process) => validateAutomationProcess(process, createDefaultNodeRegistry()).ok)).toBe(true);
    const pageOverride = group.processes[0]?.nodes[0]?.config.entries;
    expect(JSON.stringify(pageOverride)).toContain("box-sizing: border-box");
  });

  it("repara el HTML de ejemplos guardados antes de incorporar border-box", () => {
    let sequence = 0;
    const document = createAutomationDocument("automation");
    const group = createCompleteAutomationExample(() => `example-${sequence += 1}`);
    const requestOverride = group.processes[0]?.nodes.find(({ type }) => type === "request-override");
    if (requestOverride === undefined || !Array.isArray(requestOverride.config.entries)) throw new Error("El ejemplo no contiene el override esperado.");
    requestOverride.config = {
      ...requestOverride.config,
      entries: requestOverride.config.entries.map((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry) && typeof entry.body === "string"
        ? { ...entry, body: entry.body.replace("*, *::before, *::after { box-sizing: border-box; }", "") }
        : entry)
    };
    document.groups.push(group);

    const repaired = repairCompleteAutomationExamples(document);
    const repairedEntries = repaired.groups[0]?.processes[0]?.nodes.find(({ type }) => type === "request-override")?.config.entries;
    expect(JSON.stringify(repairedEntries)).toContain("box-sizing: border-box");
  });

  it("incluye capturas de respuesta, campo, texto visible, atributo y JSON del DOM", () => {
    let sequence = 0;
    const group = createCompleteAutomationExample(() => `example-${sequence += 1}`);
    const dedicated = group.processes.find(({ name }) => name === "17 · Guardar dato");
    const captures = dedicated?.nodes.filter(({ type }) => type === "capture-value").map(({ config }) => config);
    expect(captures).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "body.item.id", outputVariable: "itemId" }),
      expect.objectContaining({ source: "dom", selector: "#name", property: "value", valueType: "number", outputVariable: "fieldNumber" }),
      expect.objectContaining({ source: "dom", selector: "h1", property: "innerText", valueType: "string" }),
      expect.objectContaining({ source: "dom", selector: "#name", property: "attribute", attribute: "id" })
    ]));
    expect(group.processes.at(-1)?.nodes.some(({ type, config }) => type === "capture-value" && config.source === "dom" && config.property === "textContent" && config.path === "item.id")).toBe(true);
  });
});
