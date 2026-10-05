import { formatTime, hoursBetween, parseTime, timeSlots } from './time-picker.utils';

describe('time picker utils', () => {
  it('reads the ways people type a time', () => {
    const cases: [string, number | null][] = [
      ['10:00 AM', 600],
      ['10am', 600],
      ['9', 540],
      ['930', 570],
      ['9.30pm', 1290],
      ['8:00 PM', 1200],
      ['21:30', 1290],
      ['12am', 0],
      ['12 PM', 720],
      ['0:15', 15],
      ['13pm', null],
      ['25:00', null],
      ['9:75', null],
      ['soon', null],
      ['', null],
    ];
    for (const [text, minutes] of cases) {
      expect(parseTime(text)).withContext(text).toBe(minutes);
    }
  });

  it('formats in 12- and 24-hour styles', () => {
    expect(formatTime(600)).toBe('10:00 AM');
    expect(formatTime(1200)).toBe('8:00 PM');
    expect(formatTime(0)).toBe('12:00 AM');
    expect(formatTime(1290, '24h')).toBe('21:30');
  });

  it('builds a day of slots at the step', () => {
    expect(timeSlots(15).length).toBe(96);
    expect(timeSlots(30).slice(0, 3)).toEqual([0, 30, 60]);
  });

  it('counts hours across midnight', () => {
    expect(hoursBetween(600, 1200)).toBe(10);
    expect(hoursBetween(1320, 120)).toBe(4);
  });
});
