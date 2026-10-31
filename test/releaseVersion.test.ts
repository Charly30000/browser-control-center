import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../package.json";

describe("coherencia de la publicación", () => {
  it("mantiene el lockfile sincronizado con la versión del manifiesto", () => {
    const lockfile = JSON.parse(readFileSync(resolve(process.cwd(), "package-lock.json"), "utf8")) as {
      version: string;
      packages: Record<string, { version: string }>;
    };

    expect(lockfile.version).toBe(manifest.version);
    expect(lockfile.packages[""]?.version).toBe(manifest.version);
  });

  it("documenta la publicación actual en el changelog", () => {
    const changelog = readFileSync(resolve(process.cwd(), "CHANGELOG.md"), "utf8");

    expect(changelog.split(/\r?\n/)).toContain(`## ${manifest.version}`);
  });
});
