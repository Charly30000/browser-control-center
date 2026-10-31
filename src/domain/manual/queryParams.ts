import { t } from "../../localization";
import { failure, success, type Result } from "../../shared/result";
import type { QueryParamEntry } from "./manualProfile";

export const buildUrlWithQueryParams = (baseUrl: string, entries: readonly QueryParamEntry[]): Result<string> => {
  try {
    const url = new URL(baseUrl);
    url.search = "";
    for (const entry of entries) {
      if (entry.enabled && entry.key.trim() !== "") {
        url.searchParams.append(entry.key, entry.value);
      }
    }
    return success(url.toString());
  } catch {
    return failure(t("text.theURLIsInvalid"));
  }
};

export const queryParamsFromUrl = (
  urlValue: string,
  createId: () => string
): Result<{ baseUrl: string; entries: QueryParamEntry[] }> => {
  try {
    const url = new URL(urlValue);
    const entries = Array.from(url.searchParams.entries(), ([key, value]) => ({
      id: createId(),
      key,
      value,
      enabled: true
    }));
    url.search = "";
    return success({ baseUrl: url.toString(), entries });
  } catch {
    return failure(t("text.theURLIsInvalid"));
  }
};
