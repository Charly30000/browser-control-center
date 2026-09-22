import type { FormulaResource } from "./formula";
import { failure, success, type Result } from "../../shared/result";

const generateDeclaration = /\bfunction\s+generate\s*\(\s*\)\s*\{/;
const parameterizedGenerate = /\bfunction\s+generate\s*\(([^)]*)\)/;

export const validateFormula = (formula: FormulaResource): Result<FormulaResource> => {
  if (formula.name.trim() === "") return failure("El nombre de la fórmula es obligatorio.");
  const declaration = parameterizedGenerate.exec(formula.code);
  if (declaration !== null && (declaration[1] ?? "").trim() !== "") {
    return failure("La función generate no puede recibir parámetros.");
  }
  if (!generateDeclaration.test(formula.code)) {
    return failure("El código debe declarar function generate() sin parámetros.");
  }
  return success(formula);
};
