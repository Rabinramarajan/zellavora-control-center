/** Form value types a search filter can hold. */
export type SearchFieldValue = string | number | boolean | string[] | null | undefined;

type Normalized<T> = { [K in keyof T]: T[K] extends string[] ? string[] : T[K] | null };

/**
 * Builds the criteria part of a search request from form values: strings are trimmed
 * and blanks become `null`, so only real filters reach the backend.
 */
export function toSearchCriteria<T extends Record<string, SearchFieldValue>>(
  form: T
): Normalized<T> {
  const out: Record<string, SearchFieldValue> = {};
  for (const [key, value] of Object.entries(form)) {
    if (typeof value === 'string') out[key] = value.trim() || null;
    else out[key] = value ?? null;
  }
  return out as Normalized<T>;
}

/** Number of filters that are actually set (non-blank, non-empty list). */
export function countActiveFilters(criteria: object | null): number {
  if (!criteria) return 0;
  return Object.values(criteria).filter((v) =>
    Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && v !== ''
  ).length;
}

/**
 * Form values from criteria returned by the server (null -> '' for text inputs);
 * used to fill a filter form from the applied or default search.
 */
export function toSearchForm<T extends Record<string, SearchFieldValue>>(
  empty: T,
  criteria: object | null
): T {
  const source = (criteria ?? {}) as Record<string, SearchFieldValue>;
  const out: Record<string, SearchFieldValue> = { ...empty };
  for (const key of Object.keys(empty)) {
    const value = source[key];
    if (value === null || value === undefined) continue;
    out[key] = Array.isArray(value) ? [...value] : value;
  }
  return out as T;
}
