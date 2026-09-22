import type { GlobalResource } from "../resources/globalResource";

export const FORMULA_SCHEMA_VERSION = 1 as const;
export const DEFAULT_FORMULA_CODE = `function generate() {
  return "valor";
}`;

export const EXAMPLE_FORMULA_CODE = `function generate() {
  const number = Math.floor(Math.random() * 10000);
  return \`user\${number}@example.test\`;
}`;

export interface FormulaResource extends GlobalResource {
  readonly schemaVersion: typeof FORMULA_SCHEMA_VERSION;
  code: string;
}

export const createFormula = (
  id: string,
  name: string,
  now = new Date().toISOString()
): FormulaResource => ({
  schemaVersion: FORMULA_SCHEMA_VERSION,
  id,
  name,
  code: DEFAULT_FORMULA_CODE,
  createdAt: now,
  updatedAt: now
});
