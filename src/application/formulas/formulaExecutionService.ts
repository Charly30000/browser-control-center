import type { FormulaResource } from "../../domain/formulas/formula";
import type { JsonValue } from "../../domain/manual/storageValue";
import type { Result } from "../../shared/result";

export interface FormulaExecutionResult {
  readonly value: JsonValue | undefined;
  readonly valueType: string;
  readonly durationMs: number;
}

export interface FormulaExecutionService {
  execute(formula: FormulaResource): Promise<Result<FormulaExecutionResult>>;
}
