import { t } from "../../localization";
import { isJsonValue, type JsonValue } from "../manual/storageValue";
import { failure, success, type Result } from "../../shared/result";

export const parseArrayContent = (content: string): Result<JsonValue[]> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return failure(t("text.theContentIsNotValidJSON"));
  }
  if (!Array.isArray(parsed)) return failure(t("text.theJSONRootMustBeAnArray"));
  if (!parsed.every(isJsonValue)) return failure(t("text.theArrayContainsValuesThatCannotBeSerializedAsJSON"));
  return success(parsed);
};
