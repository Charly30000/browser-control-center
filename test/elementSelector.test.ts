import { describe, expect, it } from "vitest";
import { preferredSelector } from "../src/domain/browser/elementSelector";

describe("selector estable del picker", () => {
  it("prioriza id y atributos de testing antes que el path CSS", () => {
    expect(preferredSelector({ tagName: "button", id: "save", attributes: {}, fallbackPath: "body button:nth-of-type(2)" })).toBe("#save");
    expect(preferredSelector({ tagName: "button", id: "", attributes: { "data-testid": "save-action" }, fallbackPath: "body button" })).toBe('button[data-testid="save-action"]');
  });

  it("usa el path CSS como último recurso", () => {
    expect(preferredSelector({ tagName: "input", id: "", attributes: {}, fallbackPath: "form input:nth-of-type(2)" })).toBe("form input:nth-of-type(2)");
  });
});
