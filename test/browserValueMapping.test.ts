import { describe, expect, it } from "vitest";
import { createCookie, createHeader, createStorageEntry } from "../src/domain/manual/manualProfile";
import { toCookieParams, toHeaderRecord, toStorageValues } from "../src/infrastructure/browser/browserValueMapping";

describe("mapeo de configuración al navegador", () => {
  it("omite headers inactivos y claves vacías", () => {
    expect(toHeaderRecord([
      { ...createHeader("1"), key: " X-Test ", value: "yes" },
      { ...createHeader("2"), key: "X-Off", value: "no", enabled: false },
      createHeader("3")
    ])).toEqual({ "X-Test": "yes" });
  });

  it("construye cookies por URL o dominio y convierte su expiración", () => {
    const byUrl = { ...createCookie("1"), name: "session", value: "abc" };
    const byDomain = { ...createCookie("2"), name: "theme", value: "dark", domain: ".example.com", path: "/app", expires: "2030-01-01T00:00" };
    const result = toCookieParams([byUrl, byDomain], "https://example.test/page");
    expect(result[0]).toMatchObject({ name: "session", url: "https://example.test/page" });
    expect(result[1]).toMatchObject({ name: "theme", domain: ".example.com", path: "/app" });
    expect(result[1]?.expires).toBeTypeOf("number");
  });

  it("serializa storage tipado como valores de Web Storage", () => {
    expect(toStorageValues([
      { ...createStorageEntry("1"), key: "count", valueType: "number", value: "4" },
      { ...createStorageEntry("2"), key: "settings", valueType: "json", value: "{\"ok\":true}" }
    ])).toEqual([{ key: "count", value: "4" }, { key: "settings", value: "{\"ok\":true}" }]);
  });
});
