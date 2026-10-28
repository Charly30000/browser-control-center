import { describe, expect, it } from "vitest";
import { decimalPlaces, generateNumber, generateValue, type RandomSource } from "../src/domain/generators/generator";
import { calculateCifControl, calculateDniLetter } from "../src/domain/generators/spanishIdentifiers";

const fixedRandom = (value: number): RandomSource => ({ next: () => value });

describe("generadores", () => {
  it("devuelve texto fijo sin transformarlo", () => {
    expect(generateValue("string", { min: "0", max: "1", literalValue: "Texto literal" })).toEqual({ ok: true, value: "Texto literal" });
  });

  it("usa la precisión máxima entre mínimo y máximo", () => {
    expect(decimalPlaces("1.2")).toBe(1);
    expect(decimalPlaces("2.345")).toBe(3);
    expect(generateNumber("1.2", "2.345", fixedRandom(0.4))).toEqual({ ok: true, value: "1.658" });
  });

  it("genera datos básicos", () => {
    const binding = { min: "0", max: "10" };
    const name = generateValue("firstName", binding, fixedRandom(0));
    const email = generateValue("email", binding, fixedRandom(0));
    const phone = generateValue("phone", binding, fixedRandom(0));
    expect(name.ok).toBe(true);
    expect(email.ok && email.value).toMatch(/@example\.test$/);
    expect(phone.ok && phone.value).toMatch(/^\d{9}$/);
  });

  it("genera identificadores españoles con control válido", () => {
    const binding = { min: "0", max: "10" };
    const dni = generateValue("dni", binding, fixedRandom(0));
    expect(dni.ok && dni.value.at(-1)).toBe(calculateDniLetter(0));
    expect(calculateCifControl("0000000")).toEqual({ digit: "0", letter: "J" });
    const nie = generateValue("nie", binding, fixedRandom(0));
    const cif = generateValue("cif", binding, fixedRandom(0));
    expect(nie.ok && nie.value).toMatch(/^X\d{7}[A-Z]$/);
    expect(cif.ok && cif.value).toMatch(/^[A-Z]\d{7}[A-Z0-9]$/);
  });

  it("marca fórmula y array como no disponibles", () => {
    const binding = { min: "0", max: "1" };
    expect(generateValue("formula", binding).ok).toBe(false);
    expect(generateValue("array", binding).ok).toBe(false);
  });
});
