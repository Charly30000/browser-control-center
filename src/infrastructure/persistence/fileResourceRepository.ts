import * as vscode from "vscode";
import type { GlobalResource } from "../../domain/resources/globalResource";
import type { ResourceRepository } from "../../domain/resources/resourceRepository";
import type { Result } from "../../shared/result";

const SAFE_ID = /^[a-zA-Z0-9-]+$/;

export interface ResourceCodec<T extends GlobalResource> {
  serialize(resource: T): string;
  deserialize(serialized: string): Result<T>;
}

export class FileResourceRepository<T extends GlobalResource> implements ResourceRepository<T> {
  private readonly directory: vscode.Uri;

  public constructor(storageUri: vscode.Uri, folderName: string, private readonly codec: ResourceCodec<T>) {
    this.directory = vscode.Uri.joinPath(storageUri, folderName);
  }

  public async initialize(): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.directory);
  }

  public async load(id: string): Promise<T | null> {
    try {
      const contents = await vscode.workspace.fs.readFile(this.resourceUri(id));
      const result = this.codec.deserialize(new TextDecoder().decode(contents));
      if (!result.ok) throw new Error(`No se pudo cargar el recurso ${id}: ${result.error}`);
      return result.value;
    } catch (error: unknown) {
      if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") return null;
      throw error;
    }
  }

  public async save(resource: T): Promise<void> {
    const target = this.resourceUri(resource.id);
    const temporary = vscode.Uri.joinPath(this.directory, `${resource.id}.tmp`);
    await vscode.workspace.fs.writeFile(temporary, new TextEncoder().encode(this.codec.serialize(resource)));
    await vscode.workspace.fs.rename(temporary, target, { overwrite: true });
  }

  public async delete(id: string): Promise<void> {
    try {
      await vscode.workspace.fs.delete(this.resourceUri(id), { useTrash: false });
    } catch (error: unknown) {
      if (!(error instanceof vscode.FileSystemError && error.code === "FileNotFound")) throw error;
    }
  }

  private resourceUri(id: string): vscode.Uri {
    if (!SAFE_ID.test(id)) throw new Error("El identificador del recurso contiene caracteres no permitidos.");
    return vscode.Uri.joinPath(this.directory, `${id}.json`);
  }
}
