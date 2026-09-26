/**
 * Clock and hour arithmetic for the sheet form. It mirrors the server's
 * rules so the live preview shows what will be saved.
 */

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isClock = (value: string | null | undefined): value is string =>
  !!value && CLOCK.test(value);

/** Minutes since midnight for "HH:mm". */
export const clockToMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/**
 * Hours between two times less the break. An end earlier than the start is
 * an overnight shift. Returns null when either time is missing or invalid.
 */
export const hoursBetween = (
  start: string | null | undefined,
  end: string | null | undefined,
  breakMinutes: number
): number | null => {
  if (!isClock(start) || !isClock(end)) return null;
  let span = clockToMinutes(end) - clockToMinutes(start);
  if (span <= 0) span += 24 * 60;
  return round2((span - (breakMinutes || 0)) / 60);
};

export interface HoursPreviewInput {
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number;
  hoursWorked: number | null;
  lineItems: ReadonlyArray<{ hours: number | null; rate: number | null }>;
  hourlyRate: number | null;
  isBillable: boolean;
}

export interface HoursPreview {
  hours: number;
  taskHours: number;
  amount: number;
  /** True when the hours come from the start/end span rather than typed in. */
  fromSpan: boolean;
}

/** Hours and amount exactly as the server will compute them. */
export const previewSheet = (input: HoursPreviewInput): HoursPreview => {
  const rate = input.hourlyRate ?? 0;
  const tasks = input.lineItems.filter((item) => (item.hours ?? 0) > 0);
  const taskHours = round2(tasks.reduce((sum, item) => sum + (item.hours ?? 0), 0));
  const span = hoursBetween(input.startTime, input.endTime, input.breakMinutes);
  const hours = span ?? (input.hoursWorked || taskHours);

  const taskAmount = tasks.reduce((sum, item) => sum + (item.hours ?? 0) * (item.rate ?? rate), 0);
  const amount = input.isBillable ? round2(taskAmount + Math.max(hours - taskHours, 0) * rate) : 0;

  return { hours: round2(hours), taskHours, amount, fromSpan: span !== null };
};

/** Local-time "YYYY-MM-DD", so day boundaries match what the user sees. */
export const todayKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** A "YYYY-MM-DD" key as a local Date at midnight. */
export const parseDayKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const isDayKey = (value: string | null | undefined): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDayKey(value).getTime());
