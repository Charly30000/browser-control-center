import type { DataAssertionOperator } from "./dataAssertion";

export const ASSERTION_COMPARISONS = {
  "text-equals": { target: "text", operator: "equals" },
  "text-not-equals": { target: "text", operator: "not-equals" },
  "text-contains": { target: "text", operator: "contains" },
  "text-not-contains": { target: "text", operator: "not-contains" },
  "value-equals": { target: "value", operator: "equals" },
  "value-not-equals": { target: "value", operator: "not-equals" },
  "value-contains": { target: "value", operator: "contains" },
  "value-not-contains": { target: "value", operator: "not-contains" },
  "url-equals": { target: "url", operator: "equals" },
  "url-not-equals": { target: "url", operator: "not-equals" },
  "url-contains": { target: "url", operator: "contains" },
  "url-not-contains": { target: "url", operator: "not-contains" },
  "response-status": { target: "status", operator: "equals" },
  "response-status-not-equals": { target: "status", operator: "not-equals" }
} as const satisfies Record<string, { target: "text" | "value" | "url" | "status"; operator: DataAssertionOperator }>;

export type AssertionKind = "exists" | "not-exists" | "visible" | "not-visible" | keyof typeof ASSERTION_COMPARISONS;
export const ASSERTION_KINDS: readonly AssertionKind[] = ["exists", "not-exists", "visible", "not-visible", ...Object.keys(ASSERTION_COMPARISONS) as (keyof typeof ASSERTION_COMPARISONS)[]];
