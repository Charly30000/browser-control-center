import { describe, expect, it } from "vitest";
import { createRequestOverride } from "../src/domain/manual/manualProfile";
import { isRequestOverrideEntry, validateRequestOverride } from "../src/domain/manual/requestOverride";

describe("modelo de overrides", () => {
  it("acepta un override válido", () => {
    const override = { ...createRequestOverride("1"), matcher: "https://example.com/api" };
    expect(validateRequestOverride(override)).toEqual({ ok: true, value: override });
  });

  it("rechaza regex y estados inválidos", () => {
    expect(validateRequestOverride({ ...createRequestOverride("1"), matcherType: "regex", matcher: "[" }).ok).toBe(false);
    expect(validateRequestOverride({ ...createRequestOverride("2"), matcher: "*", status: 999 }).ok).toBe(false);
  });
  it("mantiene editable un override nuevo aunque todavía no tenga matcher", () => {
    const override = createRequestOverride("nuevo");
    expect(isRequestOverrideEntry(override)).toBe(true);
    expect(validateRequestOverride(override).ok).toBe(false);
  });
});
