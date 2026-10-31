import { describe, expect, it } from "vitest";
import { parseArrayContent } from "../src/domain/arrays/arrayValidation";

describe("validación de arrays", () => {
  it("acepta elementos JSON de cualquier tipo", () => {
    expect(parseArrayContent('["Madrid", 2, true, null, {"role":"admin"}]')).toEqual({
      ok: true,
      value: ["Madrid", 2, true, null, { role: "admin" }]
    });
  });

  it("rechaza JSON inválido", () => {
    expect(parseArrayContent("[").ok).toBe(false);
  });

  it("rechaza una raíz que no sea array", () => {
    expect(parseArrayContent('{"city":"Madrid"}')).toEqual({ ok: false, error: "The JSON root must be an array." });
  });
});
