export interface PageDefinition {
  readonly id: "manual" | "formulas" | "arrays" | "automations";
  readonly title: string;
  readonly available: boolean;
}
