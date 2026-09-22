import type { GlobalResource } from "./globalResource";

export interface ResourceRepository<T extends GlobalResource> {
  initialize(): Promise<void>;
  load(id: string): Promise<T | null>;
  save(resource: T): Promise<void>;
  delete(id: string): Promise<void>;
}
