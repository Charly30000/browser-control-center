import type { JsonValue } from "../manual/storageValue";
import { failure, success, type Result } from "../../shared/result";

const EXACT_VARIABLE = /^\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/;
const VARIABLE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
export const isVariableName = (value: string): boolean => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value);

export class VariableStore {
  private readonly values: Map<string, JsonValue>;
  public constructor(initial: Readonly<Record<string, JsonValue>> = {}) { this.values = new Map(Object.entries(initial)); }
  public set(name: string, value: JsonValue): Result<void> {
    if (!isVariableName(name)) return failure(`«${name}» no es un nombre de variable válido.`);
    this.values.set(name, structuredClone(value)); return success(undefined);
  }
  public get(name: string): JsonValue | undefined { const value = this.values.get(name); return value === undefined ? undefined : structuredClone(value); }
  public snapshot(): Readonly<Record<string, JsonValue>> { return Object.fromEntries([...this.values].map(([key, value]) => [key, structuredClone(value)])); }
  public resolve(value: JsonValue): Result<JsonValue> {
    if (typeof value === "string") return this.resolveString(value);
    if (Array.isArray(value)) {
      const result: JsonValue[] = [];
      for (const item of value) { const resolved = this.resolve(item); if (!resolved.ok) return resolved; result.push(resolved.value); }
      return success(result);
    }
    if (value !== null && typeof value === "object") {
      const result: Record<string, JsonValue> = {};
      for (const [key, item] of Object.entries(value)) { const resolved = this.resolve(item); if (!resolved.ok) return resolved; result[key] = resolved.value; }
      return success(result);
    }
    return success(value);
  }
  private resolveString(value: string): Result<JsonValue> {
    const exact = EXACT_VARIABLE.exec(value);
    if (exact?.[1] !== undefined) {
      const resolved = this.values.get(exact[1]);
      return resolved === undefined ? failure(`La variable «${exact[1]}» no existe.`) : success(structuredClone(resolved));
    }
    const missing: string[] = [];
    const interpolated = value.replace(VARIABLE, (_match, name: string) => {
      const resolved = this.values.get(name);
      if (resolved === undefined) { missing.push(name); return ""; }
      return typeof resolved === "string" ? resolved : JSON.stringify(resolved);
    });
    return missing[0] === undefined ? success(interpolated) : failure(`La variable «${missing[0]}» no existe.`);
  }
}
