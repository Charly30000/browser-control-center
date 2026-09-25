import { describe, expect, it } from "vitest";
import { resolveImportedIdentity } from "../src/application/importExport/importIdentityResolver";

describe("identidad de elementos importados", () => {
  it("conserva la identidad si no colisiona", () => {
    expect(resolveImportedIdentity(
      { id: "incoming", name: "Importado" },
      new Set(["existing"]),
      ["Existente"],
      () => "generated"
    )).toEqual({ id: "incoming", name: "Importado", changed: false });
  });

  it("cambia ID y nombre cuando colisiona el ID", () => {
    expect(resolveImportedIdentity(
      { id: "existing", name: "Importado" },
      new Set(["existing"]),
      ["Existente"],
      () => "generated"
    )).toEqual({ id: "generated", name: "Importado-1", changed: true });
  });

  it("cambia ID y nombre cuando colisiona el nombre sin distinguir mayúsculas ni espacios", () => {
    expect(resolveImportedIdentity(
      { id: "incoming", name: " existente " },
      new Set(["existing"]),
      ["Existente"],
      () => "generated"
    )).toEqual({ id: "generated", name: "existente-1", changed: true });
  });

  it("sustituye IDs no seguros para nombres de archivo", () => {
    expect(resolveImportedIdentity(
      { id: "../fuera", name: "Importado" },
      new Set(),
      [],
      () => "generated"
    )).toEqual({ id: "generated", name: "Importado-1", changed: true });
  });
});
