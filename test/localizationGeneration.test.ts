import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { generateLocalization } from "../src/localization/generate.mjs";

const roots: string[] = [];
const read = (root: string, file: string): unknown => JSON.parse(readFileSync(join(root, file), "utf8")) as unknown;
const write = (root: string, file: string, value: unknown): void => {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), JSON.stringify(value), "utf8");
};
const config = (locales: Record<string, string>) => ({ defaultLocale: "en", fallbackLocale: "en", locales });
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "bcc-localization-"));
  roots.push(root);
  write(root, "package.json", { displayName: "%extension.displayName%", description: "%extension.description%" });
  write(root, "src/localization/config.json", config({ en: "locales/en.json", es: "locales/es.json" }));
  write(root, "src/localization/locales/en.json", { "extension.displayName": "Browser Control", "extension.description": "Browser tools", greeting: "Hello {name}" });
  write(root, "src/localization/locales/es.json", { "extension.displayName": "Control de navegador", greeting: "Hola {name}" });
  return root;
};

afterEach(() => {
  for (const root of roots.splice(0)) {
    if (dirname(root) !== resolve(tmpdir()) || !basename(root).startsWith("bcc-localization-")) throw new Error("Unexpected test cleanup target.");
    rmSync(root, { recursive: true, force: true });
  }
});

describe("locale registration and generated integration files", () => {
  it("registers another language using only its JSON and config entry", () => {
    const root = fixture();
    generateLocalization(root);
    expect(readFileSync(join(root, "src/localization/generated/catalogs.ts"), "utf8")).toContain('import locale1 from "../locales/es.json"');
    expect(read(root, "package.nls.json")).toEqual({ "extension.displayName": "Browser Control", "extension.description": "Browser tools" });
    expect(read(root, "package.nls.es.json")).toEqual({ "extension.displayName": "Control de navegador" });
    expect(read(root, "src/localization/locales/es.json")).toEqual({ "extension.displayName": "Control de navegador", greeting: "Hola {name}" });
    expect(() => generateLocalization(root, { check: true })).not.toThrow();
  });

  it("rejects unknown keys and changed interpolation placeholders", () => {
    const root = fixture();
    write(root, "src/localization/locales/es.json", { greeting: "Hola {nombre}" });
    expect(() => generateLocalization(root)).toThrow("Placeholder mismatch");
    write(root, "src/localization/locales/es.json", { unknown: "Texto" });
    expect(() => generateLocalization(root)).toThrow("Unknown translation key");
  });

  it("removes only previously generated manifest files when a locale is unregistered", () => {
    const root = fixture();
    generateLocalization(root);
    write(root, "package.nls.fr.json", { custom: "Manually maintained" });
    write(root, "src/localization/config.json", config({ en: "locales/en.json" }));
    generateLocalization(root);
    expect(existsSync(join(root, "package.nls.es.json"))).toBe(false);
    expect(existsSync(join(root, "package.nls.fr.json"))).toBe(true);
    expect(existsSync(join(root, "src/localization/locales/es.json"))).toBe(true);
  });
});
