import { describe, expect, it } from "vitest";
import { makeUniqueProfileName, nextUntitledName } from "../src/domain/manual/profileNaming";

describe("nombres de perfil", () => {
  it("empieza con untitled", () => {
    expect(nextUntitledName([])).toBe("untitled");
  });

  it("utiliza el primer sufijo disponible sin encadenarlo", () => {
    expect(nextUntitledName(["untitled", "untitled-1", "untitled-3", "untitled-1-1"])).toBe("untitled-2");
  });

  it("crea un nombre único al importar", () => {
    expect(makeUniqueProfileName("QA", ["QA", "QA-1"])).toBe("QA-2");
  });
});
