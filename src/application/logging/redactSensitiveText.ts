const REDACTED = "[REDACTADO]";

export const redactSensitiveText = (value: string): string => value
  .replace(/\bBearer\s+[^\s,;]+/gi, `Bearer ${REDACTED}`)
  .replace(/([?&](?:access_token|auth|authorization|api[_-]?key|password|token)=)[^&#\s]*/gi, `$1${REDACTED}`)
  .replace(/("(?:authorization|proxy-authorization|cookie|set-cookie|password|passwd|token|api[_-]?key)"\s*:\s*)"(?:\\.|[^"\\])*"/gi, `$1"${REDACTED}"`)
  .replace(/\b(authorization|proxy-authorization|cookie|set-cookie|password|passwd|token|api[_-]?key)(\s*[:=]\s*)([^\s,;]+)/gi, `$1$2${REDACTED}`);
