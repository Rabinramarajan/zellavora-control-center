/**
 * Country and time-zone options for organization registration, with detection
 * from the browser. Two searchable dropdowns with no default are the most
 * abandoned part of a sign-up form, so both start pre-filled and the form says
 * they were detected.
 *
 * Both lists use the platform's own ICU data where available, so they stay
 * current and localised without a bundled table to maintain.
 */
import type { SelectOption } from '@zellavoras/ui';

const REGION_CODE = /^[A-Z]{2}$/;

/** ISO 3166-1 alpha-2 regions, named in the user's own locale. */
function buildCountries(): SelectOption[] {
  const names = new Intl.DisplayNames(undefined, { type: 'region' });

  // `region` is not a valid Intl.supportedValuesOf key. Generate the small
  // alpha-2 space instead and let DisplayNames discard unknown region codes.
  return allAlpha2()
    .filter((code) => REGION_CODE.test(code))
    .map((code) => ({ value: code, label: names.of(code) ?? code }))
    .filter((o) => o.label !== o.value)
    .sort((a, b) => a.label.localeCompare(b.label));
}

function allAlpha2(): string[] {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  return letters.flatMap((a) => letters.map((b) => a + b));
}

function buildTimeZones(): SelectOption[] {
  const zones = supportedValuesOf('timeZone');
  const list = zones.length ? zones : [detectTimeZone()].filter(Boolean);
  return list.map((zone) => {
    const offset = offsetLabel(zone);
    // The offset goes in the label rather than a second line: the control's
    // options carry one string, and it is also what makes similarly named
    // zones distinguishable when searching.
    return {
      value: zone,
      label: offset ? `${zone.replace(/_/g, ' ')} (${offset})` : zone.replace(/_/g, ' '),
    };
  });
}

function supportedValuesOf(key: string): string[] {
  try {
    const getSupportedValues = (Intl as { supportedValuesOf?: (value: string) => string[] })
      .supportedValuesOf;
    return getSupportedValues?.(key) ?? [];
  } catch {
    return [];
  }
}

/** e.g. "GMT+5:30", for telling apart zones with similar names. */
function offsetLabel(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

export function detectTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}

/**
 * The browser exposes no country, only a locale. Its region subtag is the best
 * available guess, which is why the field is labelled as detected and stays
 * editable.
 */
export function detectCountry(): string {
  try {
    const region = new Intl.Locale(navigator.language).region ?? '';
    return REGION_CODE.test(region) ? region : '';
  } catch {
    return '';
  }
}

export const COUNTRIES: readonly SelectOption[] = buildCountries();
export const TIME_ZONES: readonly SelectOption[] = buildTimeZones();
