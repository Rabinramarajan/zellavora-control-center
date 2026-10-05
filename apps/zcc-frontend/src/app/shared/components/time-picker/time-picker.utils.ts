/** A wall-clock time; minutes since midnight keeps comparison and stepping trivial. */
export type TimeFormat = '12h' | '24h';

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * Reads what people actually type: "9", "930", "9:30", "9.30pm", "21:30",
 * "9 a", "12am". Returns minutes since midnight, or null when unreadable.
 */
export function parseTime(text: string | null | undefined): number | null {
  const value = (text ?? '').trim().toLowerCase().replace(/\s+/g, '');
  if (!value) return null;

  const match = /^(\d{1,2})(?:[:.]?(\d{2}))?(a|am|p|pm)?$/.exec(value);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  const meridiem = match[3]?.[0];
  if (minutes > 59) return null;

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem === 'p' ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

/** "10:00 AM" in 12-hour mode, "10:00" in 24-hour mode. */
export function formatTime(minutes: number, format: TimeFormat = '12h'): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  if (format === '24h') return `${pad(hours)}:${pad(mins)}`;
  const suffix = hours < 12 ? 'AM' : 'PM';
  return `${hours % 12 || 12}:${pad(mins)} ${suffix}`;
}

/** Every slot in a day at the given step, as minutes since midnight. */
export function timeSlots(stepMinutes: number): number[] {
  const step = Math.min(Math.max(Math.round(stepMinutes), 1), 720);
  return Array.from({ length: Math.ceil(1440 / step) }, (_, index) => index * step);
}

/** Hours between two times; an end before the start is read as crossing midnight. */
export function hoursBetween(start: number, end: number): number {
  const span = end >= start ? end - start : end + 1440 - start;
  return Math.round((span / 60) * 100) / 100;
}
