import * as vscode from "vscode";

const DEFAULT_MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const RESERVED_WINDOWS_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export interface ImportDialogOptions {
  readonly filterName: string;
  readonly openLabel: string;
}

export interface ExportDialogOptions {
  readonly suggestedName: string;
  readonly suffix: string;
  readonly filterName: string;
  readonly saveLabel: string;
}

const safeBaseName = (value: string): string => {
  const sanitized = value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "").slice(0, 100) || "export";
  return RESERVED_WINDOWS_NAME.test(sanitized) ? `${sanitized}-export` : sanitized;
};

export class JsonImportExportFileService {
  public constructor(private readonly maxImportBytes = DEFAULT_MAX_IMPORT_BYTES) {}

  public async read(options: ImportDialogOptions): Promise<string | null> {
    const files = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { [options.filterName]: ["json"] },
      openLabel: options.openLabel
    });
    const source = files?.[0];
    if (source === undefined) return null;
    const contents = await vscode.workspace.fs.readFile(source);
    if (contents.byteLength > this.maxImportBytes) throw new Error(`El archivo supera el límite de ${Math.floor(this.maxImportBytes / 1024 / 1024)} MB.`);
    try { return new TextDecoder("utf-8", { fatal: true }).decode(contents).replace(/^\uFEFF/, ""); }
    catch { throw new Error("El archivo no contiene texto UTF-8 válido."); }
  }

  public async write(contents: string, options: ExportDialogOptions): Promise<boolean> {
    const target = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(`${safeBaseName(options.suggestedName)}${options.suffix}`),
      filters: { [options.filterName]: ["json"] },
      saveLabel: options.saveLabel
    });
    if (target === undefined) return false;
    await vscode.workspace.fs.writeFile(target, new TextEncoder().encode(contents));
    return true;
  }
}
