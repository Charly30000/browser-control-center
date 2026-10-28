import { describe, expect, it } from "vitest";
import { createDefaultNodeRegistry } from "../src/application/automations/nodeDefinitions";
import { ImportExportDocumentService, decodeResourceCollection, decodeWithGuard } from "../src/application/importExport/importExportDocumentService";
import { parseArrayContent } from "../src/domain/arrays/arrayValidation";
import { validateAutomationDocument } from "../src/domain/automations/automationValidation";
import { AUTOMATION_NODE_TYPES } from "../src/domain/automations/automation";
import { validateFormula } from "../src/domain/formulas/formulaValidation";
import { CURRENT_EXTENSION_VERSION } from "../src/domain/importExport/importExportDocument";
import { isArrayResource } from "../src/infrastructure/persistence/arrayResourceSerializer";
import { isAutomationDocument } from "../src/infrastructure/persistence/automationSerializer";
import { isFormulaResource } from "../src/infrastructure/persistence/formulaSerializer";
import { isManualProfile } from "../src/infrastructure/persistence/profileSerializer";
import { AI_DOCUMENTATION_AREAS, getAiDocumentation, getAllAiDocumentation, type AiDocumentationArea } from "../src/webviews/documentation/aiDocumentation";
import { arrayDocumentationExample, automationDocumentationExample, documentedNodes, formulaDocumentationExample, manualDocumentationExample } from "../src/webviews/documentation/examples";

const jsonBlocks = (area: AiDocumentationArea): unknown[] => [...getAiDocumentation(area).matchAll(/```json\n([\s\S]*?)\n```/g)].map((match) => JSON.parse(match[1] ?? "") as unknown);

describe("documentación copiable para IA", () => {
  it("reúne todas las guías en la documentación completa", () => {
    const all = getAllAiDocumentation();
    for (const area of Object.keys(AI_DOCUMENTATION_AREAS) as AiDocumentationArea[]) expect(all).toContain(getAiDocumentation(area));
  });
  it("incluye en cada guía el documento completo que se valida y conserva la versión actual", () => {
    const examples = { manual: manualDocumentationExample, formulas: formulaDocumentationExample, arrays: arrayDocumentationExample, automations: automationDocumentationExample };
    for (const area of Object.keys(AI_DOCUMENTATION_AREAS) as AiDocumentationArea[]) {
      expect(jsonBlocks(area)).toContainEqual(examples[area]);
      expect(examples[area].extensionVersion).toBe(CURRENT_EXTENSION_VERSION);
    }
  });

  it("el perfil Manual documentado tiene recursos portátiles que resuelven sus referencias", () => {
    const bundle = manualDocumentationExample.data;
    expect(bundle.bundleVersion).toBe(1);
    expect(isManualProfile(bundle.profile)).toBe(true);
    for (const formula of bundle.formulas) {
      expect(isFormulaResource(formula)).toBe(true);
      expect(validateFormula(formula).ok).toBe(true);
    }
    expect(bundle.arrays.every(isArrayResource)).toBe(true);
    for (const binding of bundle.profile.generatorBindings) {
      if (binding.generatorType === "formula") expect(bundle.formulas.some(({ id }) => id === binding.resourceId)).toBe(true);
      if (binding.generatorType === "array") expect(bundle.arrays.some(({ id }) => id === binding.resourceId)).toBe(true);
    }
  });

  it("los ejemplos de Fórmulas y Arrays pasan por sus lectores de importación", () => {
    const formulas = new ImportExportDocumentService("browser-control-center/formulas", decodeResourceCollection(isFormulaResource, "fórmulas"));
    const arrays = new ImportExportDocumentService("browser-control-center/arrays", decodeResourceCollection(isArrayResource, "arrays"));
    expect(formulas.deserialize(JSON.stringify(formulaDocumentationExample)).ok).toBe(true);
    expect(arrays.deserialize(JSON.stringify(arrayDocumentationExample)).ok).toBe(true);
    expect(validateFormula(formulaDocumentationExample.data[0]!).ok).toBe(true);
    const content = jsonBlocks("arrays").find(Array.isArray);
    expect(parseArrayContent(JSON.stringify(content)).ok).toBe(true);
  });

  it("documenta todos los tipos de nodo con configuraciones ejecutables", () => {
    const registry = createDefaultNodeRegistry();
    expect(new Set(documentedNodes.map(({ type }) => type))).toEqual(new Set(AUTOMATION_NODE_TYPES));
    for (const node of documentedNodes) expect(registry.validate(node.type, node.config)).toMatchObject({ ok: true });
  });

  it("el flujo completo se puede importar, tiene una selección válida y conexiones consecutivas", () => {
    const reader = new ImportExportDocumentService("browser-control-center/automations", decodeWithGuard(isAutomationDocument, "Documento inválido"));
    expect(reader.deserialize(JSON.stringify(automationDocumentationExample)).ok).toBe(true);
    expect(validateAutomationDocument(automationDocumentationExample.data, createDefaultNodeRegistry()).ok).toBe(true);
    const groups = automationDocumentationExample.data.groups;
    expect(groups).toHaveLength(1);
    expect(groups[0]?.processes).toHaveLength(1);
    const process = groups[0]!.processes[0]!;
    expect(process.edges).toHaveLength(process.nodes.length - 1);
    process.edges.forEach((edge, index) => {
      expect(edge.sourceNodeId).toBe(process.nodes[index]?.id);
      expect(edge.targetNodeId).toBe(process.nodes[index + 1]?.id);
    });
  });
});
