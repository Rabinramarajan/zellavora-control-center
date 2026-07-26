/**
 * Wildcard matcher for permission keys.
 * Supports `*` as any segment, e.g. `users:*:create` matches `users:user:create`.
 *
 * Patterns are cached and compiled once on first use.
 */
const cache = new Map<string, RegExp>();

function compile(pattern: string): RegExp {
  if (cache.has(pattern)) return cache.get(pattern)!;

  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^:]*');

  const re = new RegExp('^' + escaped + '$');
  cache.set(pattern, re);
  return re;
}

export function matchesGlob(pattern: string, key: string): boolean {
  if (!pattern.includes('*')) return pattern === key;
  return compile(pattern).test(key);
}

export function isWildcard(pattern: string): boolean {
  return pattern.includes('*');
}
