import { t } from "../../localization";
import type { FormulaResource } from "./formula";
import { failure, success, type Result } from "../../shared/result";

const generateDeclaration = /\b(?:async\s+)?function\s+generate\s*\(\s*\)\s*\{/;
const parameterizedGenerate = /\b(?:async\s+)?function\s+generate\s*\(([^)]*)\)/;

export const validateFormula = (formula: FormulaResource): Result<FormulaResource> => {
  if (formula.name.trim() === "") return failure(t("text.theFormulaNameIsRequired"));
  const declaration = parameterizedGenerate.exec(formula.code);
  if (declaration !== null && (declaration[1] ?? "").trim() !== "") {
    return failure(t("text.theGenerateFunctionCannotAcceptParameters"));
  }
  if (!generateDeclaration.test(formula.code)) {
    return failure(t("text.theCodeMustDeclareFunctionGenerateWithNoParameters"));
  }
  return success(formula);
};
