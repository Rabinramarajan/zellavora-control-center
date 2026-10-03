import type { SelectControlOption } from '@zellavoras/ui';

/** Maps plain string lists to the option shape expected by select controls. */
export function stringsToOptions(values: readonly string[]): SelectControlOption[] {
  return values.map((value) => ({ value, label: value }));
}
