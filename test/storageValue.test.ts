import { describe, expect, it } from "vitest";
import { parseStorageValue } from "../src/domain/manual/storageValue";

describe("validación de storage", () => {
  it("convierte tipos primitivos", () => {
    expect(parseStorageValue("number", "12.5")).toEqual({ ok: true, value: 12.5 });
    expect(parseStorageValue("boolean", "false")).toEqual({ ok: true, value: false });
    expect(parseStorageValue("null", "null")).toEqual({ ok: true, value: null });
  });

  it("valida JSON", () => {
    expect(parseStorageValue("json", "{\"enabled\":true}")).toEqual({ ok: true, value: { enabled: true } });
    expect(parseStorageValue("json", "{").ok).toBe(false);
  });

  it("rechaza valores incompatibles", () => {
    expect(parseStorageValue("boolean", "yes").ok).toBe(false);
    expect(parseStorageValue("number", "").ok).toBe(false);
  });
});
