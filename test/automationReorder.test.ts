import { describe, expect, it } from "vitest";
import { createAutomationDocument, createAutomationGroup, createAutomationNode, createAutomationProcess } from "../src/domain/automations/automation";
import { moveAutomationProcess } from "../src/domain/automations/reorderAutomation";
import { moveEntry } from "../src/domain/manual/reorderEntries";
import { deserializeAutomation, serializeAutomation } from "../src/infrastructure/persistence/automationSerializer";
import { AutomationImportService } from "../src/application/importExport/automationImportService";
import { applyAutomationDocumentSelection, selectAutomationDocument } from "../src/domain/automations/automationSelection";

const fixture = () => {
  const document = createAutomationDocument("document");
  const first = createAutomationProcess("first", "Proceso con datos");
  first.nodes = [createAutomationNode("navigate", "navigate", { x: 5, y: 10 }), createAutomationNode("click", "click", { x: 300, y: 10 })];
  first.edges = [{ id: "edge", sourceNodeId: "navigate", sourcePort: "out", targetNodeId: "click", targetPort: "in" }];
  first.variables = { data: { value: "original" } };
  document.groups = [
    { ...createAutomationGroup("one", "Primero"), expanded: false, processes: [first, createAutomationProcess("second", "Segundo proceso")] },
    { ...createAutomationGroup("two", "Segundo"), expanded: true, processes: [createAutomationProcess("third", "Tercer proceso")] },
    createAutomationGroup("empty", "Vacío")
  ];
  return document;
};

describe("orden y expansión de Automatizaciones", () => {
  it("ordena grupos y procesos sin cambiar sus datos ni identidades", () => {
    const document = fixture();
    const original = structuredClone(document.groups[0]!);
    moveEntry(document.groups, "two", "one", "before");
    expect(document.groups.map(({ id }) => id)).toEqual(["two", "one", "empty"]);
    expect(document.groups[1]).toEqual(original);
    expect(moveAutomationProcess(document, "second", "one", "first", "before")).toBe(true);
    expect(document.groups[1]!.processes.map(({ id }) => id)).toEqual(["second", "first"]);
    expect(moveAutomationProcess(document, "second", "one", "first", "after")).toBe(true);
    expect(document.groups[1]).toEqual(original);
  });

  it("mueve procesos completos entre grupos y admite destinos vacíos o colapsados", () => {
    const document = fixture();
    const original = document.groups[0]!.processes[0]!;
    expect(moveAutomationProcess(document, "first", "two", "third", "before")).toBe(true);
    expect(document.groups[1]!.processes.map(({ id }) => id)).toEqual(["first", "third"]);
    expect(document.groups[1]!.processes[0]).toBe(original);
    expect(moveAutomationProcess(document, "first", "empty")).toBe(true);
    expect(document.groups[2]!.processes[0]).toBe(original);
    expect(moveAutomationProcess(document, "first", "one")).toBe(true);
    expect(document.groups[0]!.processes.map(({ id }) => id)).toEqual(["second", "first"]);
    expect(document.groups[0]!.expanded).toBe(false);
    expect(document.groups.flatMap(({ processes }) => processes).filter(({ id }) => id === "first")).toHaveLength(1);
  });

  it.each([
    ["missing", "two", null], ["first", "missing", null], ["first", "two", "missing"],
    ["first", "two", "first"], ["first", "one", "first"], ["second", "one", null]
  ] as const)("no pierde procesos con un destino inválido o sin cambio: %s / %s / %s", (processId, groupId, targetId) => {
    const document = fixture();
    const previous = structuredClone(document);
    expect(moveAutomationProcess(document, processId, groupId, targetId)).toBe(false);
    expect(document).toEqual(previous);
  });

  it("conserva el orden y expanded en JSON y admite grupos anteriores sin la preferencia", () => {
    const document = fixture();
    moveEntry(document.groups, "empty", "one", "before");
    expect(deserializeAutomation(serializeAutomation(document))).toEqual({ ok: true, value: document });
    const invalid = JSON.parse(serializeAutomation(document)) as { groups: { expanded?: unknown }[] };
    invalid.groups[0]!.expanded = "false";
    expect(deserializeAutomation(JSON.stringify(invalid)).ok).toBe(false);
  });

  it("transporta la preferencia de expansión al importar y editar el JSON de un grupo", () => {
    const document = fixture();
    const imported = new AutomationImportService().merge(createAutomationDocument("target"), document, () => "unused");
    expect(imported.groups).toEqual(document.groups);
    const scope = { kind: "group" as const, groupId: "one" };
    const selected = selectAutomationDocument(document, scope);
    expect(selected.groups[0]!.expanded).toBe(false);
    selected.groups[0]!.expanded = true;
    expect(applyAutomationDocumentSelection(document, selected, scope, () => "unused").groups[0]!.expanded).toBe(true);
    delete selected.groups[0]!.expanded;
    expect(applyAutomationDocumentSelection(document, selected, scope, () => "unused").groups[0]!.expanded).toBe(false);
  });
});
