import { t } from "../../localization";
import { introduction, jsonBlock, resourceReference } from "./common";
import { arrayDocumentationExample, documentationArray } from "./examples";

export const arraysDocumentation = (): string => t("documentation.arrays", {
  introduction: introduction(t("navigation.arrays")), resourceReference,
  items: jsonBlock(documentationArray.items), example: jsonBlock(arrayDocumentationExample)
});
