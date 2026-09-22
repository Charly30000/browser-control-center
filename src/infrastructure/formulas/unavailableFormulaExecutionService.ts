import type { FormulaExecutionService, FormulaExecutionResult } from "../../application/formulas/formulaExecutionService";
import type { FormulaResource } from "../../domain/formulas/formula";
import { failure, type Result } from "../../shared/result";

export class UnavailableFormulaExecutionService implements FormulaExecutionService {
  public execute(_formula: FormulaResource): Promise<Result<FormulaExecutionResult>> {
    return Promise.resolve(failure("Ejecución aislada disponible al integrar el navegador."));
  }
}
