import type { ManualProfile } from "../../domain/manual/manualProfile";

export interface ProfileRepository {
  initialize(): Promise<void>;
  load(id: string): Promise<ManualProfile | null>;
  save(profile: ManualProfile): Promise<void>;
  delete(id: string): Promise<void>;
}
