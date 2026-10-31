import { describe, expect, it } from "vitest";
import { DATA_ASSERTION_OPERATORS, readDataPath, resolveDataAssertionPath, validateDataValue } from "../src/domain/automations/dataAssertion";

describe("validación de datos de automatización", () => {
  it.each([
    ["not-contains", "Ada Lovelace", "Grace", true], ["not-contains", "Ada Lovelace", "Ada", false],
    ["not-contains", "", "", false], ["not-contains", "Ada", "ada", true],
    ["not-matches", "Ada", "^Grace$", true], ["not-matches", "Ada", "^Ada$", false],
    ["not-matches", "Ada", "[", false],
    ["json-not-equals", { a: 1, b: 2 }, '{"b":2,"a":1}', false],
    ["json-not-equals", { a: 1 }, '{"a":2}', true], ["json-not-equals", "value", "invalid", false]
  ] as const)("%s checks both passing and failing cases", (operator, actual, expected, passes) => {
    expect(validateDataValue(actual, operator, expected, "value").ok).toBe(passes);
  });

  it("does not treat missing values as successful negative comparisons", () => {
    for (const actual of [null, undefined]) {
      for (const operator of DATA_ASSERTION_OPERATORS.filter((value) => value !== "not-exists")) {
        expect(validateDataValue(actual, operator, '"value"', "missing").ok).toBe(false);
      }
    }
  });
  it("lee rutas anidadas dentro de cuerpos JSON", () => {
    expect(readDataPath({ body: "{\"user\":{\"id\":42}}" }, "body.user.id")).toBe(42);
  });

  it("compara JSON sin depender del orden de las propiedades", () => {
    expect(validateDataValue({ name: "Ada", id: 1 }, "json-equals", "{\"id\":1,\"name\":\"Ada\"}", "respuesta").ok).toBe(true);
  });

  it("distingue entre un dato ausente y un valor vacío", () => {
    expect(validateDataValue(undefined, "not-exists", "", "cookie").ok).toBe(true);
    expect(validateDataValue("", "exists", "", "cookie").ok).toBe(true);
  });

  it("resuelve campos predefinidos y rutas personalizadas", () => {
    expect(resolveDataAssertionPath("response", "body", "ignored.path")).toBe("body");
    expect(resolveDataAssertionPath("response", "custom", "body.user.id")).toBe("body.user.id");
  });
});
