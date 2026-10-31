import { describe, expect, it } from "vitest";
import { AutomationImportService } from "../src/application/importExport/automationImportService";
import {
  createAutomationDocument,
  createAutomationGroup,
  createAutomationNode,
  createAutomationProcess
} from "../src/domain/automations/automation";

const currentDocument = () => {
  const document = createAutomationDocument("document-current", "2026-01-01T00:00:00.000Z");
  const group = createAutomationGroup("group-shared", "Grupo");
  const process = createAutomationProcess("process-shared", "Proceso");
  process.nodes.push(createAutomationNode("node-shared", "navigate", { x: 0, y: 0 }));
  group.processes.push(process);
  document.groups.push(group);
  return document;
};

describe("importación de automatizaciones", () => {
  it("añade grupos sin reemplazar el documento y repara todas las referencias que colisionan", () => {
    const current = currentDocument();
    const imported = createAutomationDocument("document-imported", "2026-01-02T00:00:00.000Z");
    const group = createAutomationGroup("group-shared", "grupo");
    const process = createAutomationProcess("process-shared", "proceso");
    process.nodes.push(
      createAutomationNode("node-shared", "navigate", { x: 10, y: 10 }),
      createAutomationNode("node-second", "click", { x: 20, y: 20 })
    );
    process.edges.push({ id: "edge-imported", sourceNodeId: "node-shared", sourcePort: "out", targetNodeId: "node-second", targetPort: "in" });
    group.processes.push(process);
    imported.groups.push(group);
    const ids = ["group-new", "process-new", "node-new"];

    const merged = new AutomationImportService().merge(
      current,
      imported,
      () => ids.shift() ?? "fallback",
      "2026-03-01T00:00:00.000Z"
    );
    const importedGroup = merged.groups[1];
    const importedProcess = importedGroup?.processes[0];

    expect(merged.id).toBe("document-current");
    expect(merged.groups[0]).toEqual(current.groups[0]);
    expect(importedGroup).toMatchObject({ id: "group-new", name: "grupo-1" });
    expect(importedProcess).toMatchObject({ id: "process-new", name: "proceso-1" });
    expect(importedProcess?.nodes.map(({ id }) => id)).toEqual(["node-new", "node-second"]);
    expect(importedProcess?.edges[0]).toMatchObject({ sourceNodeId: "node-new", targetNodeId: "node-second" });
  });

  it("conserva IDs y nombres únicos", () => {
    const imported = createAutomationDocument("document-imported");
    const group = createAutomationGroup("group-imported", "Otro grupo");
    group.processes.push(createAutomationProcess("process-imported", "Otro proceso"));
    imported.groups.push(group);

    const merged = new AutomationImportService().merge(currentDocument(), imported, () => "unused");
    expect(merged.groups[1]).toMatchObject({ id: "group-imported", name: "Otro grupo" });
    expect(merged.groups[1]?.processes[0]).toMatchObject({ id: "process-imported", name: "Otro proceso" });
  });

  it("reutiliza un grupo cuando coinciden su ID y todo su contenido", () => {
    const current = currentDocument();
    const imported = createAutomationDocument("document-imported");
    imported.groups.push(structuredClone(current.groups[0]!));

    const merged = new AutomationImportService().merge(current, imported, () => "unused");

    expect(merged.groups).toEqual(current.groups);
  });

  it("rechaza documentos sin grupos importables", () => {
    expect(() => new AutomationImportService().merge(
      currentDocument(),
      createAutomationDocument("empty"),
      () => "unused"
    )).toThrow("does not contain any groups");
  });
});
