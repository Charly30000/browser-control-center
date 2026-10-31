import { t } from "../../localization";
import { introduction, jsonBlock, resourceReference } from "./common";
import { formulaDocumentationExample } from "./examples";

export const formulasDocumentation = (): string => t("documentation.formulas", {
  introduction: introduction(t("navigation.formulas")), resourceReference,
  example: jsonBlock(formulaDocumentationExample)
});
