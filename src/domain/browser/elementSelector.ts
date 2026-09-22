export interface ElementSelectorMetadata {
  readonly tagName: string;
  readonly id: string;
  readonly attributes: Readonly<Record<string, string | null>>;
  readonly fallbackPath: string;
}

const escapeAttribute = (value: string): string => value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");

export const preferredSelector = (metadata: ElementSelectorMetadata): string => {
  if (metadata.id !== "") return `#${metadata.id}`;
  for (const name of ["data-testid", "data-test", "name", "aria-label"] as const) {
    const value = metadata.attributes[name];
    if (value !== null && value !== undefined && value !== "") return `${metadata.tagName}[${name}="${escapeAttribute(value)}"]`;
  }
  return metadata.fallbackPath;
};
