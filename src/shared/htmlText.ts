/** Escapes catalog text when composing standalone HTML outside Lit templates. */
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (character) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
