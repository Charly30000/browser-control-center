import { describe, expect, it } from "vitest";
import { createFormula, EXAMPLE_FORMULA_CODE } from "../src/domain/formulas/formula";
import { validateFormula } from "../src/domain/formulas/formulaValidation";

describe("contrato de fórmulas", () => {
  it("acepta generate sin parámetros", () => {
    expect(validateFormula(createFormula("1", "randomEmail")).ok).toBe(true);
  });

  it("rechaza otro nombre y parámetros", () => {
    expect(validateFormula({ ...createFormula("1", "test"), code: "function other() { return 1; }" }).ok).toBe(false);
    expect(validateFormula({ ...createFormula("2", "test"), code: "function generate(value) { return value; }" }).ok).toBe(false);
  });

  it("exige nombre", () => {
    expect(validateFormula({ ...createFormula("1", "test"), name: "  " }).ok).toBe(false);
  });

  it("mantiene válido el ejemplo generado", () => {
    expect(validateFormula({ ...createFormula("1", "example"), code: EXAMPLE_FORMULA_CODE }).ok).toBe(true);
  });
});
