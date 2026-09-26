const LAST_RATE_KEY = 'zcc.sheets.lastHourlyRate';

/** The hourly rate last saved on a sheet, used to prefill new ones. */
export const rememberedRate = (): number | null => {
  try {
    const stored = Number(localStorage.getItem(LAST_RATE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch {
    return null;
  }
};

export const rememberRate = (rate: number): void => {
  try {
    localStorage.setItem(LAST_RATE_KEY, String(rate));
  } catch {
    // Storage can be unavailable (private mode); the default is a convenience only.
  }
};
