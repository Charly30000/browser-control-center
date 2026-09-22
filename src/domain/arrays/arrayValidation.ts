import { isJsonValue, type JsonValue } from "../manual/storageValue";
import { failure, success, type Result } from "../../shared/result";

export const parseArrayContent = (content: string): Result<JsonValue[]> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return failure("El contenido no es JSON válido.");
  }
  if (!Array.isArray(parsed)) return failure("La raíz del JSON debe ser un array.");
  if (!parsed.every(isJsonValue)) return failure("El array contiene valores que no son serializables como JSON.");
  return success(parsed);
};
