import * as vscode from "vscode";
import type { ManualProfile } from "../../domain/manual/manualProfile";
import { deserializeProfile, serializeProfile } from "./profileSerializer";
import type { ProfileRepository } from "./profileRepository";

const SAFE_ID = /^[a-zA-Z0-9-]+$/;

export class FileProfileRepository implements ProfileRepository {
  private readonly profilesDirectory: vscode.Uri;

  public constructor(storageUri: vscode.Uri) {
    this.profilesDirectory = vscode.Uri.joinPath(storageUri, "profiles");
  }

  public async initialize(): Promise<void> {
    await vscode.workspace.fs.createDirectory(this.profilesDirectory);
  }

  public async load(id: string): Promise<ManualProfile | null> {
    const uri = this.profileUri(id);
    try {
      const contents = await vscode.workspace.fs.readFile(uri);
      const result = deserializeProfile(new TextDecoder().decode(contents));
      if (!result.ok) {
        throw new Error(`No se pudo cargar el perfil ${id}: ${result.error}`);
      }
      return result.value;
    } catch (error: unknown) {
      if (error instanceof vscode.FileSystemError && error.code === "FileNotFound") {
        return null;
      }
      throw error;
    }
  }

  public async save(profile: ManualProfile): Promise<void> {
    const uri = this.profileUri(profile.id);
    const temporaryUri = vscode.Uri.joinPath(this.profilesDirectory, `${profile.id}.tmp`);
    await vscode.workspace.fs.writeFile(temporaryUri, new TextEncoder().encode(serializeProfile(profile)));
    await vscode.workspace.fs.rename(temporaryUri, uri, { overwrite: true });
  }

  public async delete(id: string): Promise<void> {
    try {
      await vscode.workspace.fs.delete(this.profileUri(id), { useTrash: false });
    } catch (error: unknown) {
      if (!(error instanceof vscode.FileSystemError && error.code === "FileNotFound")) {
        throw error;
      }
    }
  }

  private profileUri(id: string): vscode.Uri {
    if (!SAFE_ID.test(id)) {
      throw new Error("El identificador de perfil contiene caracteres no permitidos.");
    }
    return vscode.Uri.joinPath(this.profilesDirectory, `${id}.json`);
  }
}
