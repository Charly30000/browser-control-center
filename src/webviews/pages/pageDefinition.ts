export interface PageDefinition {
  readonly id: "manual" | "formulas" | "arrays" | "automations" | "browserManagement";
  readonly title: string;
  readonly available: boolean;
}
