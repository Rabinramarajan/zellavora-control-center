import { ENTRY_STATUS_OPTIONS, DayStatusPipe } from './day-status.pipe';
import { ENTRY_STATUSES, EntryStatus } from '../data/timesheet.model';

describe('DayStatusPipe', () => {
  const pipe = new DayStatusPipe();

  it('returns the whole style object without a field', () => {
    const style = pipe.transform('LEAVE');
    expect(style.label).toBe('Leave');
    expect(style.badgeClass).toContain('amber');
    expect(style.rowClass).not.toBe('');
  });

  it('returns a single field when asked', () => {
    expect(pipe.transform('WORKING', 'label')).toBe('Working');
  });

  it('leaves ordinary working rows unshaded', () => {
    expect(pipe.transform('WORKING', 'rowClass')).toBe('');
  });

  ENTRY_STATUSES.forEach((status: EntryStatus) => {
    it(`has a label for ${status}`, () => {
      expect(pipe.transform(status, 'label')).toBeTruthy();
    });
  });

  it('offers every status in the dropdown', () => {
    expect(ENTRY_STATUS_OPTIONS.map((option) => option.value)).toEqual([...ENTRY_STATUSES]);
  });
});
