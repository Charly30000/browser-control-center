import { describe, expect, it } from "vitest";
import { readDataPath, resolveDataAssertionPath, validateDataValue } from "../src/domain/automations/dataAssertion";

describe("validación de datos de automatización", () => {
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
