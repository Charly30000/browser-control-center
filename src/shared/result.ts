export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const success = <T>(value: T): Result<T> => ({ ok: true, value });

export const failure = <T = never>(error: string): Result<T> => ({ ok: false, error });
