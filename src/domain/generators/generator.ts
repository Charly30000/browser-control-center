import { t } from "../../localization";
import { failure, success, type Result } from "../../shared/result";
import type { GeneratorBinding, GeneratorType } from "../manual/manualProfile";
import { generateCif, generateDni, generateNie } from "./spanishIdentifiers";

export interface RandomSource {
  next(): number;
}

export const systemRandom: RandomSource = { next: () => Math.random() };

const FIRST_NAMES = ["Lucía", "Hugo", "Martina", "Daniel", "Sofía", "Mateo", "Paula", "Alejandro"] as const;
const LAST_NAMES = ["García", "Martínez", "López", "Sánchez", "González", "Pérez", "Romero", "Torres"] as const;

const pick = (values: readonly string[], random: RandomSource): string => {
  const index = Math.min(values.length - 1, Math.floor(random.next() * values.length));
  return values[index] ?? values[0] ?? "";
};

const normalizeEmailPart = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");

export const decimalPlaces = (value: string): number => {
  const normalized = value.trim().toLowerCase();
  const [coefficient = "", exponentText] = normalized.split("e");
  const fractionLength = coefficient.split(".")[1]?.length ?? 0;
  const exponent = exponentText === undefined ? 0 : Number.parseInt(exponentText, 10);
  return Math.max(0, fractionLength - (Number.isFinite(exponent) ? exponent : 0));
};

export const generateNumber = (minText: string, maxText: string, random: RandomSource): Result<string> => {
  const min = Number(minText);
  const max = Number(maxText);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return failure(t("text.theNumericGeneratorLimitsAreInvalid"));
  }
  if (min > max) {
    return failure(t("text.theMinimumCannotExceedTheMaximum"));
  }
  const precision = Math.max(decimalPlaces(minText), decimalPlaces(maxText));
  const generated = min === max ? min : min + random.next() * (max - min);
  return success(generated.toFixed(precision));
};

const generatePhone = (random: RandomSource): string => {
  const prefixes = ["6", "7", "9"] as const;
  let value = pick(prefixes, random);
  for (let index = 0; index < 8; index += 1) {
    value += Math.floor(random.next() * 10).toString();
  }
  return value;
};

export const generateValue = (
  type: GeneratorType,
  binding: Pick<GeneratorBinding, "min" | "max" | "literalValue">,
  random: RandomSource = systemRandom
): Result<string> => {
  switch (type) {
    case "string":
      return success(binding.literalValue ?? "");
    case "firstName":
      return success(pick(FIRST_NAMES, random));
    case "lastName":
      return success(pick(LAST_NAMES, random));
    case "email": {
      const firstName = normalizeEmailPart(pick(FIRST_NAMES, random));
      const lastName = normalizeEmailPart(pick(LAST_NAMES, random));
      const suffix = Math.floor(random.next() * 10_000).toString().padStart(4, "0");
      return success(`${firstName}.${lastName}${suffix}@example.test`);
    }
    case "phone":
      return success(generatePhone(random));
    case "number":
      return generateNumber(binding.min, binding.max, random);
    case "dni":
      return success(generateDni(random));
    case "nie":
      return success(generateNie(random));
    case "cif":
      return success(generateCif(random));
    case "formula":
      return failure(t("text.formulasWillBeAvailableInALaterRelease"));
    case "array":
      return failure(t("text.arraysWillBeAvailableInALaterRelease"));
  }
};
