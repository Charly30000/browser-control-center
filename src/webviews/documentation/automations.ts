import { t } from "../../localization";
import { introduction, jsonBlock, resourceReference, sessionReference } from "./common";
import { automationDocumentationExample, documentedNodes } from "./examples";

export const automationsDocumentation = (): string => t("documentation.automations", {
  introduction: `${introduction(t("navigation.automations"))}\n${t("documentation.processCards")}\n`, sessionReference, resourceReference,
  nodeCatalog: documentedNodes.map(({ type, usage, config }) => `\n### ${type}\n${usage}\n${jsonBlock(config)}`).join("\n"),
  example: jsonBlock(automationDocumentationExample)
});
