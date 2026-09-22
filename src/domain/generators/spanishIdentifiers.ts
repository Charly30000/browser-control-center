import type { RandomSource } from "./generator";

const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

const randomDigits = (length: number, random: RandomSource): string => {
  let result = "";
  for (let index = 0; index < length; index += 1) {
    result += Math.floor(random.next() * 10).toString();
  }
  return result;
};

export const calculateDniLetter = (numericPart: number): string => DNI_LETTERS[numericPart % 23] ?? "T";

export const generateDni = (random: RandomSource): string => {
  const digits = randomDigits(8, random);
  return `${digits}${calculateDniLetter(Number.parseInt(digits, 10))}`;
};

export const generateNie = (random: RandomSource): string => {
  const prefixes = ["X", "Y", "Z"] as const;
  const prefixIndex = Math.min(2, Math.floor(random.next() * prefixes.length));
  const prefix = prefixes[prefixIndex] ?? "X";
  const digits = randomDigits(7, random);
  const numericValue = Number.parseInt(`${prefixIndex}${digits}`, 10);
  return `${prefix}${digits}${calculateDniLetter(numericValue)}`;
};

export const calculateCifControl = (digits: string): { digit: string; letter: string } => {
  let evenSum = 0;
  let oddSum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const value = Number.parseInt(digits[index] ?? "0", 10);
    if ((index + 1) % 2 === 0) {
      evenSum += value;
    } else {
      const doubled = value * 2;
      oddSum += Math.floor(doubled / 10) + (doubled % 10);
    }
  }
  const controlNumber = (10 - ((evenSum + oddSum) % 10)) % 10;
  return {
    digit: controlNumber.toString(),
    letter: "JABCDEFGHI"[controlNumber] ?? "J"
  };
};

export const generateCif = (random: RandomSource): string => {
  const entityTypes = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "N", "P", "Q", "R", "S", "U", "V", "W"] as const;
  const entityType = entityTypes[Math.min(entityTypes.length - 1, Math.floor(random.next() * entityTypes.length))] ?? "A";
  const digits = randomDigits(7, random);
  const control = calculateCifControl(digits);
  const letterOnly = "PQSW".includes(entityType);
  const digitOnly = "ABEH".includes(entityType);
  const controlValue = letterOnly ? control.letter : digitOnly ? control.digit : random.next() < 0.5 ? control.digit : control.letter;
  return `${entityType}${digits}${controlValue}`;
};
