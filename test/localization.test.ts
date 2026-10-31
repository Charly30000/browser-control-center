import { describe, expect, it } from "vitest";
import english from "../src/localization/locales/en.json";
import manifestEnglish from "../package.nls.json";
import manifest from "../package.json";
import { createTranslator, resolveLocale, getLocale, initializeLocale, t } from "../src/localization";
import { escapeHtml } from "../src/shared/htmlText";

describe("English text catalog", () => {
  it("falls back to English when a future locale omits a key", () => {
    const translate = createTranslator({ "actions.save": "Guardar" });
    expect(translate("actions.save")).toBe("Guardar");
    expect(translate("actions.apply")).toBe("Apply");
    expect(t("autoSave.title")).toBe("Auto-save");
  });

  it("resolves registered regional locales and falls back to the configured default", () => {
    const supported = ["en", "es", "pt-BR"];
    expect(resolveLocale("ES_es", supported, "en")).toBe("es");
    expect(resolveLocale("pt-br", supported, "en")).toBe("pt-BR");
    expect(resolveLocale("fr-CA", supported, "en")).toBe("en");
    initializeLocale("en-US");
    expect(getLocale()).toBe("en");
  });

  it("substitutes values once without evaluating dollars, markup or automation variables", () => {
    const value = '$& ${code} {itemId} <script>';
    expect(t("names.processCopy", { name: value })).toBe(value + " copy");
    expect(t("text.idItemId")).toBe("ID: {itemId}");
    expect(t("names.processCopy")).toBe("{name} copy");
    expect(escapeHtml('A&B <input title="x">')).toBe("A&amp;B &lt;input title=&quot;x&quot;&gt;");
  });

  it("resolves every VS Code manifest placeholder using a nonempty catalog entry", () => {
    const placeholders = [...JSON.stringify(manifest).matchAll(/%([^%]+)%/g)].map((match) => match[1]);
    expect(placeholders).toContain("commands.openManual");
    expect(placeholders).toContain("extension.description");
    for (const key of placeholders) {
      expect(Object.hasOwn(english, key!)).toBe(true);
      expect(Object.hasOwn(manifestEnglish, key!)).toBe(true);
    }
    expect(Object.keys(manifestEnglish).sort()).toEqual([...new Set(placeholders)].sort());
    expect(Object.values(english).every((value) => value.trim().length > 0)).toBe(true);
  });
});
