import { describe, expect, it } from "vitest";
import { createArrayResource } from "../src/domain/arrays/arrayResource";
import { createFormula } from "../src/domain/formulas/formula";
import { arrayResourceCodec } from "../src/infrastructure/persistence/arrayResourceSerializer";
import { formulaCodec } from "../src/infrastructure/persistence/formulaSerializer";

describe("serialización de recursos globales", () => {
  it("conserva fórmulas", () => {
    const formula = createFormula("formula-1", "randomEmail", "2026-01-01T00:00:00.000Z");
    expect(formulaCodec.deserialize(formulaCodec.serialize(formula))).toEqual({ ok: true, value: formula });
  });

  it("conserva arrays JSON tipados", () => {
    const array = { ...createArrayResource("array-1", "cities", "2026-01-01T00:00:00.000Z"), items: ["Madrid", { country: "ES" }] };
    expect(arrayResourceCodec.deserialize(arrayResourceCodec.serialize(array))).toEqual({ ok: true, value: array });
  });
});
