import { t } from "../../localization";
import { arraysDocumentation } from "./arrays";
import { automationsDocumentation } from "./automations";
import { formulasDocumentation } from "./formulas";
import { manualDocumentation } from "./manual";

export type AiDocumentationArea = "manual" | "formulas" | "arrays" | "automations";

export const AI_DOCUMENTATION_AREAS: Readonly<Record<AiDocumentationArea, string>> = {
  manual: t("navigation.manual"), formulas: t("navigation.formulas"), arrays: t("navigation.arrays"), automations: t("navigation.automations")
};

const documentation: Readonly<Record<AiDocumentationArea, () => string>> = {
  manual: manualDocumentation, formulas: formulasDocumentation, arrays: arraysDocumentation, automations: automationsDocumentation
};

export const getAiDocumentation = (area: AiDocumentationArea): string => documentation[area]();

export const getAllAiDocumentation = (): string => (Object.keys(AI_DOCUMENTATION_AREAS) as AiDocumentationArea[])
  .map(getAiDocumentation).join("\n\n---\n\n");
