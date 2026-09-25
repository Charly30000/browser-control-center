import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(projectRoot, "src");

const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = resolve(directory, entry.name);
  if (entry.isDirectory()) return sourceFiles(path);
  return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
});

const projectPath = (path: string): string => relative(projectRoot, path).replaceAll("\\", "/");

describe("frontera de persistencia", () => {
  it("reserva workspace.fs al DAO y al adaptador de archivos externos", () => {
    const allowed = new Set([
      "src/infrastructure/persistence/vsCodeApplicationDataDao.ts",
      "src/extension/importExport/jsonImportExportFileService.ts"
    ]);
    const violations = sourceFiles(sourceRoot)
      .filter((path) => readFileSync(path, "utf8").includes("vscode.workspace.fs"))
      .map(projectPath)
      .filter((path) => !allowed.has(path));

    expect(violations).toEqual([]);
  });

  it("inyecta globalState únicamente desde la raíz de composición", () => {
    const violations = sourceFiles(sourceRoot)
      .filter((path) => readFileSync(path, "utf8").includes("globalState"))
      .map(projectPath)
      .filter((path) => path !== "src/extension/compositionRoot.ts");

    expect(violations).toEqual([]);
  });

  it("impide dependencias de VS Code en aplicación y dominio", () => {
    const guardedRoots = [resolve(sourceRoot, "application"), resolve(sourceRoot, "domain")];
    const violations = guardedRoots.flatMap(sourceFiles)
      .filter((path) => /from\s+["']vscode["']/.test(readFileSync(path, "utf8")))
      .map(projectPath);

    expect(violations).toEqual([]);
  });
});
