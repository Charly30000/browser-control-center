import { describe, expect, it } from "vitest";
import { createAutomationDocument, createAutomationGroup, createAutomationNode, createAutomationProcess } from "../src/domain/automations/automation";
import { applyAutomationDocumentSelection, selectAutomationDocument } from "../src/domain/automations/automationSelection";

const documentWithTwoGroups = () => {
  const document = createAutomationDocument("automation-1");
  const first = createAutomationGroup("group-1", "Primero");
  first.processes = [createAutomationProcess("process-1", "Uno"), createAutomationProcess("process-2", "Dos")];
  const second = createAutomationGroup("group-2", "Segundo");
  second.processes = [createAutomationProcess("process-3", "Tres")];
  document.groups = [first, second];
  return document;
};

describe("selección JSON de Automatizaciones", () => {
  it("recorta un grupo completo para Ver JSON y Exportar", () => {
    const selected = selectAutomationDocument(documentWithTwoGroups(), { kind: "group", groupId: "group-1" });

    expect(selected.name).toBe("Primero");
    expect(selected.groups).toHaveLength(1);
    expect(selected.groups[0]?.processes.map(({ id }) => id)).toEqual(["process-1", "process-2"]);
  });

  it("recorta únicamente el flujo seleccionado", () => {
    const selected = selectAutomationDocument(documentWithTwoGroups(), { kind: "process", groupId: "group-1", processId: "process-2" });

    expect(selected.name).toBe("Dos");
    expect(selected.groups).toHaveLength(1);
    expect(selected.groups[0]?.processes.map(({ id }) => id)).toEqual(["process-2"]);
  });

  it("aplica un flujo editado sin eliminar otros procesos o grupos", () => {
    const current = documentWithTwoGroups();
    const scope = { kind: "process" as const, groupId: "group-1", processId: "process-2" };
    const selected = selectAutomationDocument(current, scope);
    selected.groups[0]!.processes[0]!.name = "Dos editado";

    const applied = applyAutomationDocumentSelection(current, selected, scope, () => "generated-id");

    expect(applied.groups).toHaveLength(2);
    expect(applied.groups[0]?.processes.map(({ name }) => name)).toEqual(["Uno", "Dos editado"]);
    expect(applied.groups[1]?.processes[0]?.name).toBe("Tres");
  });

  it("aplica un grupo editado sin eliminar los demás grupos", () => {
    const current = documentWithTwoGroups();
    const scope = { kind: "group" as const, groupId: "group-1" };
    const selected = selectAutomationDocument(current, scope);
    selected.groups[0]!.name = "Primero editado";

    const applied = applyAutomationDocumentSelection(current, selected, scope, () => "generated-id");

    expect(applied.groups.map(({ name }) => name)).toEqual(["Primero editado", "Segundo"]);
  });

  it("pega un grupo externo conservando el ID de destino y repara IDs que colisionan", () => {
    const current = documentWithTwoGroups();
    const external = createAutomationDocument("external-document");
    const externalGroup = createAutomationGroup("external-group", "Grupo pegado");
    externalGroup.processes = [createAutomationProcess("process-3", "Flujo pegado")];
    external.groups = [externalGroup];

    const applied = applyAutomationDocumentSelection(
      current,
      external,
      { kind: "group", groupId: "group-1" },
      () => "generated-process"
    );

    expect(applied.id).toBe("automation-1");
    expect(applied.groups[0]?.id).toBe("group-1");
    expect(applied.groups[0]?.processes[0]?.id).toBe("generated-process");
    expect(applied.groups[1]?.id).toBe("group-2");
  });

  it("pega un flujo externo conservando el grupo y el ID del flujo de destino", () => {
    const current = documentWithTwoGroups();
    current.groups[0]!.processes[0]!.nodes = [
      createAutomationNode("shared-node", "navigate", { x: 0, y: 0 }),
      createAutomationNode("other-node", "click", { x: 100, y: 0 })
    ];
    current.groups[0]!.processes[0]!.edges = [{ id: "shared-edge", sourceNodeId: "shared-node", sourcePort: "out", targetNodeId: "other-node", targetPort: "in" }];
    const external = createAutomationDocument("external-document");
    const externalGroup = createAutomationGroup("external-group", "Grupo externo");
    const externalProcess = createAutomationProcess("external-process", "Tres");
    externalProcess.nodes = [
      createAutomationNode("shared-node", "navigate", { x: 0, y: 0 }),
      createAutomationNode("external-target", "click", { x: 100, y: 0 })
    ];
    externalProcess.edges = [{ id: "shared-edge", sourceNodeId: "shared-node", sourcePort: "out", targetNodeId: "external-target", targetPort: "in" }];
    externalGroup.processes = [externalProcess];
    external.groups = [externalGroup];
    const generatedIds = ["pasted-node", "pasted-edge"];

    const applied = applyAutomationDocumentSelection(
      current,
      external,
      { kind: "process", groupId: "group-1", processId: "process-2" },
      () => generatedIds.shift() ?? "fallback-id"
    );

    expect(applied.groups[0]?.id).toBe("group-1");
    expect(applied.groups[0]?.name).toBe("Primero");
    expect(applied.groups[0]?.processes[1]?.id).toBe("process-2");
    expect(applied.groups[0]?.processes[1]?.name).toBe("Tres-1");
    expect(applied.groups[0]?.processes[1]?.nodes.map(({ id }) => id)).toEqual(["pasted-node", "external-target"]);
    expect(applied.groups[0]?.processes[1]?.edges[0]).toMatchObject({ id: "pasted-edge", sourceNodeId: "pasted-node", targetNodeId: "external-target" });
  });
});
