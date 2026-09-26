/**
 * Adapters from the app's option sources to the `SelectControlOption` shape
 * that `@zellavoras/ui` select controls take.
 */
import type { SelectControlOption } from '@zellavoras/ui';
import type { DdlItem } from '@core/api/ddl.api';

/** DDL rows keep the stored key in `key` and the display text in `value`. */
export function ddlToOptions(items: readonly DdlItem[]): SelectControlOption[] {
  return items.map((item) => ({ value: item.key, label: item.label || item.value }));
}

/** For lists where the stored value and the display text are the same string. */
export function stringsToOptions(values: readonly string[]): SelectControlOption[] {
  return values.map((value) => ({ value, label: value }));
}

/** For `{ value, label }` literals, optionally with a description line. */
export function toOptions<T extends { value: string; label: string; description?: string }>(
  items: readonly T[]
): SelectControlOption[] {
  return items.map(({ value, label, description }) => ({ value, label, description }));
}
