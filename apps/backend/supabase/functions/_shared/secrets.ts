/** Signing secrets for the edge functions. Missing, short or placeholder values fail closed. */
const PLACEHOLDERS = new Set(['dev-secret-change-in-production', 'dev-refresh-secret']);

export function requireSecret(name: 'JWT_SECRET' | 'REFRESH_TOKEN_SECRET'): string {
  const value = Deno.env.get(name) ?? '';
  if (value.length < 32 || PLACEHOLDERS.has(value)) {
    throw new Error(`${name} must be set to at least 32 characters and not a default value`);
  }
  return value;
}
