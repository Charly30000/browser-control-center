import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as vscode from "vscode";
import historical from "./fixtures/persistence/historical.json";
import { VsCodeApplicationDataDao } from "../src/infrastructure/persistence/vsCodeApplicationDataDao";
import { MANUAL_PROFILE_SCHEMA_VERSION } from "../src/domain/manual/manualProfile";

const storage = vi.hoisted(() => ({ files: new Map<string, Uint8Array>(), writes: vi.fn(), failRename: false }));
vi.mock("vscode", () => {
  class FileSystemError extends Error { public code = "FileNotFound"; }
  class Uri {
    public constructor(public path: string) {}
    public static joinPath(base: Uri, ...parts: string[]): Uri { return new Uri([base.path, ...parts].join("/")); }
    public with(change: { path: string }): Uri { return new Uri(change.path); }
  }
  return { Uri, FileSystemError, FileType: { File: 1 }, workspace: { fs: {
    stat: (uri: Uri) => { const bytes = storage.files.get(uri.path); return bytes === undefined ? Promise.reject(new FileSystemError("missing")) : Promise.resolve({ type: 1, size: bytes.length }); },
    readFile: (uri: Uri) => Promise.resolve(storage.files.get(uri.path)),
    writeFile: (uri: Uri, bytes: Uint8Array) => { storage.writes(uri.path); storage.files.set(uri.path, bytes); return Promise.resolve(); },
    rename: (from: Uri, to: Uri) => {
      if (storage.failRename) return Promise.reject(new Error("write failed"));
      storage.files.set(to.path, storage.files.get(from.path)!); storage.files.delete(from.path); return Promise.resolve();
    }
  } } };
});

const root = { path: "/storage" } as vscode.Uri;
const state = { get: () => undefined, update: () => Promise.resolve() } as unknown as vscode.Memento;
const profileFile = "/storage/profiles/historical-profile.json";
const seed = (value: unknown) => storage.files.set(profileFile, new TextEncoder().encode(JSON.stringify(value)));
const read = () => new TextDecoder().decode(storage.files.get(profileFile));
beforeEach(() => { storage.files.clear(); storage.writes.mockClear(); storage.failRename = false; });

describe("automatic persisted upgrades", () => {
  it("atomically upgrades an automation v1 without resetting its groups or preferences", async () => {
    const path = "/storage/automations/automation.json";
    storage.files.set(path, new TextEncoder().encode(JSON.stringify(historical.automations)));
    const dao = new VsCodeApplicationDataDao(root, state);
    expect(await dao.automations.load()).toEqual({ ...historical.automations, schemaVersion: 2 });
    expect(storage.writes).toHaveBeenCalledWith(path + ".tmp");
    await dao.automations.load();
    expect(storage.writes).toHaveBeenCalledTimes(1);
  });
  it("atomically writes a validated migrated profile once on read", async () => {
    seed(historical.manual);
    const dao = new VsCodeApplicationDataDao(root, state);
    const loaded = await dao.profiles.load("historical-profile");
    expect(loaded?.schemaVersion).toBe(MANUAL_PROFILE_SCHEMA_VERSION);
    expect(JSON.parse(read()) as unknown).toMatchObject({ schemaVersion: MANUAL_PROFILE_SCHEMA_VERSION, id: historical.manual.id, updatedAt: historical.manual.updatedAt });
    expect(storage.writes).toHaveBeenCalledWith(profileFile + ".tmp");
    await dao.profiles.load("historical-profile");
    expect(storage.writes).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite an unsupported or invalid historical file", async () => {
    for (const value of [{ ...historical.manual, schemaVersion: 999 }, { ...historical.manual, headers: null }]) {
      seed(value);
      const original = read();
      await expect(new VsCodeApplicationDataDao(root, state).profiles.load("historical-profile")).rejects.toThrow();
      expect(read()).toBe(original);
      expect(storage.writes).not.toHaveBeenCalled();
    }
  });

  it("keeps the original file if the atomic rename fails", async () => {
    seed(historical.manual);
    const original = read();
    storage.failRename = true;
    await expect(new VsCodeApplicationDataDao(root, state).profiles.load("historical-profile")).rejects.toThrow("write failed");
    expect(read()).toBe(original);
  });
});
