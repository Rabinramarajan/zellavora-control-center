import { Pipe, PipeTransform } from '@angular/core';
import { EntryStatus } from '../data/timesheet.model';

export interface DayStatusStyle {
  label: string;
  /** Tailwind classes for the status badge. */
  badgeClass: string;
  /** Tailwind classes shading the whole row, or '' to leave it alone. */
  rowClass: string;
}

const STYLES: Record<EntryStatus, DayStatusStyle> = {
  EMPTY: {
    label: '—',
    badgeClass: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    rowClass: '',
  },
  WORKING: {
    label: 'Working',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    rowClass: '',
  },
  EXTENDED: {
    label: 'Extended',
    badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300',
    rowClass: '',
  },
  WEEKEND_WORK: {
    label: 'Weekend work',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
    rowClass: 'bg-purple-50/60 dark:bg-purple-950/20',
  },
  LEAVE: {
    label: 'Leave',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    rowClass: 'bg-amber-50 dark:bg-amber-950/20',
  },
  HOLIDAY: {
    label: 'Holiday',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    rowClass: 'bg-sky-50 dark:bg-sky-950/20',
  },
};

/**
 * Maps an `EntryStatus` to its label and colours.
 *
 *   {{ entry.status | dayStatus }}            → the whole style object
 *   {{ entry.status | dayStatus:'label' }}    → just the label
 *   {{ entry.status | dayStatus:'badgeClass' }}
 */
@Pipe({ name: 'dayStatus', standalone: true })
export class DayStatusPipe implements PipeTransform {
  transform(status: EntryStatus): DayStatusStyle;
  transform(status: EntryStatus, field: keyof DayStatusStyle): string;
  transform(status: EntryStatus, field?: keyof DayStatusStyle): DayStatusStyle | string {
    const style = STYLES[status] ?? STYLES.EMPTY;
    return field ? style[field] : style;
  }
}

/** Options for the status dropdown, in the order the grid offers them. */
export const ENTRY_STATUS_OPTIONS: ReadonlyArray<{ label: string; value: EntryStatus }> = (
  Object.keys(STYLES) as EntryStatus[]
).map((value) => ({ label: STYLES[value].label, value }));
