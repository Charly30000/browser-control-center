import type * as vscode from "vscode";
import type { GlobalResource } from "../src/domain/resources/globalResource";
import type { ResourceRepository } from "../src/domain/resources/resourceRepository";
import { ResourceMetadataStore } from "../src/infrastructure/persistence/resourceMetadataStore";

export class InMemoryResourceRepository<T extends GlobalResource> implements ResourceRepository<T> {
  public readonly values = new Map<string, T>();
  public async initialize(): Promise<void> { return Promise.resolve(); }
  public load(id: string): Promise<T | null> { return Promise.resolve(structuredClone(this.values.get(id) ?? null)); }
  public save(resource: T): Promise<void> { this.values.set(resource.id, structuredClone(resource)); return Promise.resolve(); }
  public delete(id: string): Promise<void> { this.values.delete(id); return Promise.resolve(); }
}

export const createMetadataStore = (key = "test.resources"): ResourceMetadataStore => {
  const values = new Map<string, unknown>();
  const memento: vscode.Memento = {
    keys: () => [...values.keys()],
    get: <T>(storageKey: string, defaultValue?: T): T | undefined =>
      (values.has(storageKey) ? values.get(storageKey) : defaultValue) as T | undefined,
    update: (storageKey: string, value: unknown): Promise<void> => {
      if (value === undefined) values.delete(storageKey); else values.set(storageKey, value);
      return Promise.resolve();
    }
  };
  return new ResourceMetadataStore(memento, key);
};
