/** Reads a display/value field off an option, by key name or by function. */
export type OptionAccessor<T, R = any> = keyof T | string | ((option: T) => R);

export function readOption<T, R = any>(
  option: T,
  accessor: OptionAccessor<T, R> | null | undefined,
  fallback?: R
): R {
  if (option === null || option === undefined) return fallback as R;
  if (typeof accessor === 'function') return (accessor as (o: T) => R)(option);
  if (typeof accessor === 'string' && accessor) {
    // Supports dotted paths, e.g. "profile.displayName".
    const value = accessor
      .split('.')
      .reduce<any>((acc, key) => (acc === null || acc === undefined ? acc : acc[key]), option);
    return (value ?? fallback) as R;
  }
  return (option as unknown as R) ?? (fallback as R);
}

/** Default comparison used to match a control value back to an option. */
export function defaultCompareWith(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;
  // Codes and ids routinely differ only in case between API and stored value.
  if (typeof a === 'string' && typeof b === 'string') {
    return a.toLowerCase() === b.toLowerCase();
  }
  return false;
}
