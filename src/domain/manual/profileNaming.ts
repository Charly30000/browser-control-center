const UNTITLED_PATTERN = /^untitled(?:-(\d+))?$/;

export const nextUntitledName = (existingNames: readonly string[]): string => {
  const used = new Set<number>();
  for (const name of existingNames) {
    const match = UNTITLED_PATTERN.exec(name);
    if (match === null) {
      continue;
    }
    const suffix = match[1];
    used.add(suffix === undefined ? 0 : Number.parseInt(suffix, 10));
  }

  let candidate = 0;
  while (used.has(candidate)) {
    candidate += 1;
  }
  return candidate === 0 ? "untitled" : `untitled-${candidate}`;
};

export const makeUniqueProfileName = (requestedName: string, existingNames: readonly string[]): string => {
  const trimmed = requestedName.trim() || "untitled";
  const occupied = new Set(existingNames);
  if (!occupied.has(trimmed)) {
    return trimmed;
  }

  const suffixPattern = /^(.*?)(?:-(\d+))?$/;
  const match = suffixPattern.exec(trimmed);
  const base = match?.[1] || trimmed;
  let suffix = 1;
  while (occupied.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};
