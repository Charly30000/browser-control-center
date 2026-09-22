import { failure, success, type Result } from "../../shared/result";
import type { RequestOverrideEntry } from "./manualProfile";

export const validateRequestOverride = (override: RequestOverrideEntry): Result<RequestOverrideEntry> => {
  if (override.matcher.trim() === "") {
    return failure("El matcher del override es obligatorio.");
  }
  if (override.matcherType === "regex") {
    try {
      new RegExp(override.matcher);
    } catch {
      return failure("La expresión regular del override no es válida.");
    }
  }
  if (override.action === "fulfill" && (!Number.isInteger(override.status) || override.status < 100 || override.status > 599)) {
    return failure("El estado HTTP debe ser un entero entre 100 y 599.");
  }
  return success(override);
};
