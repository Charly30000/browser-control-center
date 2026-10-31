import { t } from "../../localization";
import { introduction, jsonBlock, resourceReference, sessionReference } from "./common";
import { manualDocumentationExample } from "./examples";

export const manualDocumentation = (): string => t("documentation.manual", {
  introduction: introduction(t("navigation.manual")), sessionReference, resourceReference,
  example: jsonBlock(manualDocumentationExample)
});
