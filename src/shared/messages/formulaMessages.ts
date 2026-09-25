import type { FormulaResource } from "../../domain/formulas/formula";
import type { ResourceEditorState } from "../../domain/resources/globalResource";
import { isFormulaResource } from "../../infrastructure/persistence/formulaSerializer";

export type FormulaToExtensionMessage =
  | { readonly type: "formula.ready" }
  | { readonly type: "formula.new" }
  | { readonly type: "formula.select"; readonly id: string }
  | { readonly type: "formula.save"; readonly resource: FormulaResource }
  | { readonly type: "formula.deleteSelected"; readonly ids: readonly string[] }
  | { readonly type: "formula.import" }
  | { readonly type: "formula.export"; readonly resource: FormulaResource }
  | { readonly type: "formula.viewJson"; readonly resource: FormulaResource }
  | { readonly type: "formula.applyJson"; readonly serialized: string; readonly currentId: string }
  | { readonly type: "formula.test"; readonly resource: FormulaResource }
  | { readonly type: "formula.generateExample" };

export type ExtensionToFormulaMessage =
  | { readonly type: "formula.state"; readonly state: ResourceEditorState<FormulaResource> }
  | { readonly type: "formula.jsonDocument"; readonly serialized: string }
  | { readonly type: "formula.jsonApplied"; readonly resource: FormulaResource }
  | { readonly type: "formula.notice"; readonly tone: "info" | "success" | "warning" | "error"; readonly message: string };

export const isFormulaToExtensionMessage = (value: unknown): value is FormulaToExtensionMessage => {
  if (typeof value !== "object" || value === null || !("type" in value)) return false;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case "formula.ready":
    case "formula.new":
    case "formula.import":
    case "formula.generateExample":
      return true;
    case "formula.applyJson":
      return typeof message.serialized === "string" && typeof message.currentId === "string";
    case "formula.select":
      return typeof message.id === "string";
    case "formula.deleteSelected":
      return Array.isArray(message.ids) && message.ids.every((id) => typeof id === "string");
    case "formula.save":
    case "formula.export":
    case "formula.viewJson":
    case "formula.test":
      return isFormulaResource(message.resource);
    default:
      return false;
  }
};
