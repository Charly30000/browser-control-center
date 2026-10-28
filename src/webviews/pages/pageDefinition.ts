export interface PageDefinition {
  readonly id: "manual" | "formulas" | "arrays" | "automations" | "aiDocumentation" | "browserManagement";
  readonly title: string;
  readonly available: boolean;
}
