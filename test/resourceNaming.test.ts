import { describe, expect, it } from "vitest";
import { hasDuplicateResourceName, nextResourceName, uniqueImportedResourceName } from "../src/domain/resources/resourceNaming";

describe("nombres de recursos globales", () => {
  it("crea sufijos planos", () => {
    expect(nextResourceName("formula", ["formula", "formula-1", "formula-3"])).toBe("formula-2");
  });

  it("detecta duplicados sin distinguir mayúsculas", () => {
    expect(hasDuplicateResourceName("CITIES", "2", [{ id: "1", name: "cities", updatedAt: "now" }])).toBe(true);
  });

  it("renombra imports duplicados", () => {
    expect(uniqueImportedResourceName("cities", ["cities", "cities-1"])).toBe("cities-2");
  });
});
