import { describe, expect, it } from "vitest";
import { buildUrlWithQueryParams, queryParamsFromUrl } from "../src/domain/manual/queryParams";

describe("query params", () => {
  it("incluye solo entradas activas y conserva valores repetidos", () => {
    const result = buildUrlWithQueryParams("https://example.com/path?old=value#section", [
      { id: "1", key: "tag", value: "uno", enabled: true },
      { id: "2", key: "tag", value: "dos", enabled: true },
      { id: "3", key: "skip", value: "x", enabled: false }
    ]);
    expect(result).toEqual({ ok: true, value: "https://example.com/path?tag=uno&tag=dos#section" });
  });

  it("extrae parámetros usando URLSearchParams", () => {
    let id = 0;
    const result = queryParamsFromUrl("https://example.com/?a=1&b=hello%20world", () => String(++id));
    expect(result.ok && result.value.entries.map(({ key, value }) => [key, value])).toEqual([["a", "1"], ["b", "hello world"]]);
  });

  it("rechaza URLs inválidas", () => {
    expect(buildUrlWithQueryParams("no es una url", [])).toEqual({ ok: false, error: "La URL no es válida." });
  });
});
