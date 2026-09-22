import { describe, expect, it } from "vitest";
import { ArrayValueGenerator } from "../src/domain/arrays/arrayValueGenerator";

describe("generador de valores de array", () => {
  it("devuelve undefined para un array vacío", () => {
    expect(new ArrayValueGenerator({ next: () => 0.5 }).pick([])).toBeUndefined();
  });

  it("elige un elemento mediante la fuente aleatoria", () => {
    expect(new ArrayValueGenerator({ next: () => 0.6 }).pick(["a", "b", "c"])).toBe("b");
  });
});
