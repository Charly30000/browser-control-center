export const createContentSecurityPolicy = (cspSource: string, nonce: string, allowInlineStyles: boolean): string => {
  const styleSource = allowInlineStyles ? `${cspSource} 'unsafe-inline'` : cspSource;
  return [
    "default-src 'none'",
    `img-src ${cspSource} data:`,
    `font-src ${cspSource}`,
    `style-src ${styleSource}`,
    `script-src 'nonce-${nonce}'`
  ].join("; ");
};
