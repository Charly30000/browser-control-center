import type { ArrayResourceService } from "../arrays/arrayResourceService";
import type { FormulaExecutionService } from "../formulas/formulaExecutionService";
import type { FormulaService } from "../formulas/formulaService";
import { ArrayValueGenerator } from "../../domain/arrays/arrayValueGenerator";
import { generateValue } from "../../domain/generators/generator";
import type { GeneratorBinding } from "../../domain/manual/manualProfile";
import type { JsonValue } from "../../domain/manual/storageValue";
import { failure, success, type Result } from "../../shared/result";

export class GeneratorValueResolver {
  private readonly arrayGenerator = new ArrayValueGenerator();

  public constructor(
    private readonly formulas: FormulaService,
    private readonly arrays: ArrayResourceService,
    private readonly formulaExecution: FormulaExecutionService
  ) {}

  public async resolve(binding: GeneratorBinding): Promise<Result<JsonValue | undefined>> {
    if (binding.generatorType === "formula") {
      if (binding.resourceId === null) return failure("Selecciona una fórmula.");
      const formula = (await this.formulas.getAll()).find(({ id }) => id === binding.resourceId);
      if (formula === undefined) return failure("La fórmula seleccionada ya no existe.");
      const result = await this.formulaExecution.execute(formula);
      return result.ok ? success(result.value.value) : result;
    }
    if (binding.generatorType === "array") {
      if (binding.resourceId === null) return failure("Selecciona un array.");
      const resource = (await this.arrays.getAll()).find(({ id }) => id === binding.resourceId);
      if (resource === undefined) return failure("El array seleccionado ya no existe.");
      return success(this.arrayGenerator.pick(resource.items));
    }
    const result = generateValue(binding.generatorType, binding);
    return result.ok ? success(result.value) : result;
  }
}
