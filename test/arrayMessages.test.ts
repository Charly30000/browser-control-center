import { describe, expect, it } from "vitest";
import { createArrayResource } from "../src/domain/arrays/arrayResource";
import { isArrayToExtensionMessage } from "../src/shared/messages/arrayMessages";

describe("mensajes de Arrays", () => {
  it("acepta probar el contenido actual de un array válido", () => {
    const resource = createArrayResource("array-1", "datos");
    resource.items = ["uno", { id: 2 }];

    expect(isArrayToExtensionMessage({ type: "array.test", resource })).toBe(true);
  });

  it("rechaza probar contenido que no sea un recurso de array válido", () => {
    expect(isArrayToExtensionMessage({ type: "array.test", resource: { items: ["uno"] } })).toBe(false);
  });
});
