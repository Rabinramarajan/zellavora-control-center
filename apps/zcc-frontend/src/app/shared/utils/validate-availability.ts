import { resource } from '@angular/core';
import { SchemaPath, validateAsync } from '@angular/forms/signals';

export interface AvailabilityOptions {
  /** Resolves `true` when the value is free to use. */
  check: (value: string) => Promise<boolean>;
  /** Values that don't need a server round-trip, e.g. the one already saved. */
  skip?: (value: string) => boolean;
  message: string;
  /** Milliseconds to wait after the last keystroke before checking. */
  debounceMs?: number;
}

/**
 * Server-side uniqueness check for a string field. While the request is in
 * flight the field reports `pending()`, so a submit waits for the answer.
 */
export function validateAvailability(path: SchemaPath<string>, options: AvailabilityOptions): void {
  validateAsync(path, {
    params: ({ value }) => {
      const candidate = value().trim();
      return candidate && !options.skip?.(candidate) ? candidate : undefined;
    },
    debounce: options.debounceMs ?? 400,
    factory: (params) =>
      resource({
        params,
        loader: ({ params: candidate }) => options.check(candidate),
      }),
    onSuccess: (available) =>
      available ? undefined : { kind: 'unavailable', message: options.message },
    onError: () => undefined,
  });
}
