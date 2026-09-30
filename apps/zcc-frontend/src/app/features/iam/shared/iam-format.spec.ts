import { formatDate, initials, relativeTime } from './iam-format';

describe('iam-format', () => {
  it('builds initials from up to two words', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('  grace  brewster murray hopper ')).toBe('GB');
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
  });

  it('renders relative times in both directions', () => {
    const now = Date.parse('2026-09-30T12:00:00Z');
    expect(relativeTime('2026-09-30T11:59:40Z', now)).toBe('just now');
    expect(relativeTime('2026-09-30T09:00:00Z', now)).toContain('3 hours');
    expect(relativeTime('2026-10-02T12:00:00Z', now)).toContain('2 days');
    expect(relativeTime(null, now)).toBe('—');
  });

  it('shows a dash for missing dates', () => {
    expect(formatDate(null)).toBe('—');
  });
});
