import { t } from "../../localization";
import { introduction, jsonBlock, resourceReference, sessionReference } from "./common";
import { automationDocumentationExample, documentedNodes } from "./examples";
import { AUTOMATION_SCHEMA_VERSION } from "../../domain/automations/automation";

export const automationsDocumentation = (): string => t("documentation.automations", {
  automationSchemaVersion: AUTOMATION_SCHEMA_VERSION,
  introduction: `${introduction(t("navigation.automations"))}\n${t("documentation.processCards")}\n\n${t("documentation.sessionRemoval")}\n\n${t("documentation.validationVariants")}\n`, sessionReference, resourceReference,
  nodeCatalog: documentedNodes.map(({ type, usage, config }) => `\n### ${type}\n${usage}\n${jsonBlock(config)}`).join("\n"),
  example: jsonBlock(automationDocumentationExample)
});
