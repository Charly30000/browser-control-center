import { FORMULA_SCHEMA_VERSION, type FormulaResource } from "../../domain/formulas/formula";
import { failure, success, type Result } from "../../shared/result";
import type { DataCodec } from "../../application/persistence/applicationDataDao";

export const isFormulaResource = (value: unknown): value is FormulaResource => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.schemaVersion === FORMULA_SCHEMA_VERSION &&
    typeof record.id === "string" && record.id.length > 0 &&
    typeof record.name === "string" &&
    typeof record.code === "string" &&
    typeof record.createdAt === "string" && typeof record.updatedAt === "string";
};

export const formulaCodec: DataCodec<FormulaResource> = {
  serialize: (resource) => JSON.stringify(resource, null, 2),
  deserialize: (serialized): Result<FormulaResource> => {
    try {
      const value: unknown = JSON.parse(serialized);
      return isFormulaResource(value) ? success(value) : failure("La fórmula no tiene una estructura válida.");
    } catch {
      return failure("La fórmula no contiene JSON válido.");
    }
  }
};
