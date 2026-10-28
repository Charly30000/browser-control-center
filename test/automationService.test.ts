import { describe, expect, it, vi } from "vitest";
import { AutomationService } from "../src/application/automations/automationService";
import { createDefaultNodeRegistry } from "../src/application/automations/nodeDefinitions";
import type { SingletonDataDao } from "../src/application/persistence/applicationDataDao";
import { createAutomationDocument, createAutomationGroup, createAutomationNode, createAutomationProcess, type AutomationDocument } from "../src/domain/automations/automation";

const incompleteDocument = (): AutomationDocument => {
  const document = createAutomationDocument("automation");
  const group = createAutomationGroup("group");
  const process = createAutomationProcess("process");
  process.nodes.push(createAutomationNode("field", "fill", { x: 0, y: 0 }));
  group.processes.push(process);
  document.groups.push(group);
  return document;
};

describe("AutomationService", () => {
  it("persiste borradores incompletos pero mantiene la importación estricta", async () => {
    const save = vi.fn((_document: AutomationDocument) => Promise.resolve());
    const dao: SingletonDataDao<AutomationDocument> = { load: () => Promise.resolve(null), save };
    const service = new AutomationService(dao, createDefaultNodeRegistry());
    await service.initialize();

    await expect(service.save(incompleteDocument())).resolves.toMatchObject({ id: "automation" });
    expect(save).toHaveBeenCalledOnce();
    await expect(service.import(incompleteDocument())).rejects.toThrow("selector");
  });
});
