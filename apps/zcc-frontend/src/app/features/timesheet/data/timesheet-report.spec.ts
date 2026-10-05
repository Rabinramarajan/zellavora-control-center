import { TestBed } from '@angular/core/testing';
import { EntryStatus, Timesheet, TimesheetEntry } from './timesheet.model';
import { buildTimesheetReport } from './timesheet-report';
import { reportToHtml } from './timesheet-report-html';
import { TimesheetExportService } from './timesheet-export.service';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** September 2026 laid out like the sample: weekdays 10:00–20:00, leave on 2, 8 and 29. */
function septemberSheet(overrides: Partial<Timesheet> = {}): Timesheet {
  const entries: TimesheetEntry[] = Array.from({ length: 30 }, (_, index) => {
    const date = `2026-09-${String(index + 1).padStart(2, '0')}`;
    const dayOfWeek = DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];
    const weekend = dayOfWeek === 'Saturday' || dayOfWeek === 'Sunday';
    const leave = [2, 8, 29].includes(index + 1);
    const status: EntryStatus = weekend ? 'EMPTY' : leave ? 'LEAVE' : 'WORKING';
    const worked = status === 'WORKING';
    return {
      id: `e${index}`,
      timesheetId: 'sheet-1',
      entryDate: date,
      dayOfWeek,
      startTime: worked ? '10:00 AM' : null,
      endTime: worked ? '8:00 PM' : null,
      hours: worked ? 10 : null,
      status,
      notes: null,
    };
  });

  return {
    id: 'sheet-1',
    organizationId: 'org',
    userId: 'u1',
    period: '2026-09',
    status: 'DRAFT',
    employeeName: 'Rabin R',
    department: 'Engineering',
    totalHours: 210,
    submittedAt: null,
    approvedAt: null,
    approvedById: null,
    rejectedAt: null,
    rejectionReason: null,
    createdAt: '',
    updatedAt: '',
    entries,
    user: { id: 'u1', fullName: 'Rabin', email: 'r@example.com' },
    approver: null,
    ...overrides,
  };
}

describe('buildTimesheetReport', () => {
  it('derives every figure from the entries', () => {
    const report = buildTimesheetReport(septemberSheet());

    expect(report.employee).toBe('Rabin R');
    expect(report.department).toBe('Engineering');
    expect(report.periodRange).toBe('Sep 1 – Sep 30, 2026');
    expect(report.summary.workingDays).toBe(19);
    expect(report.summary.totalHours).toBe(190);
    expect(report.summary.leaveDates).toEqual(['2026-09-02', '2026-09-08', '2026-09-29']);
    expect(report.fileBaseName).toBe('Timesheet_RabinR_2026-09');
  });

  it('prints rows the way the template does', () => {
    const report = buildTimesheetReport(septemberSheet());
    const [first, leave] = report.rows;

    expect(first).toEqual({
      date: '2026-09-01',
      dateLabel: 'Sep 1',
      day: 'Tue',
      start: '10:00 AM',
      end: '8:00 PM',
      hours: '10',
      statusNotes: 'Working',
      kind: 'work',
    });
    expect(leave).toEqual(
      jasmine.objectContaining({
        start: '-',
        end: '-',
        hours: 'LEAVE',
        statusNotes: 'LEAVE',
        kind: 'leave',
      })
    );
    expect(report.rows[4].kind).toBe('weekend');
  });

  it('writes schedule notes and flags overtime from the threshold', () => {
    const report = buildTimesheetReport(septemberSheet(), { overtimeThreshold: 9 });

    expect(report.scheduleNotes[0]).toBe(
      'Regular hours: 10:00 AM – 8:00 PM (10 h average per working day)'
    );
    expect(report.summary.overtimeDates.length).toBe(19);
    expect(report.scheduleNotes).toContain('Leave days: Sep 2, Sep 8 and Sep 29.');
    expect(report.scheduleNotes).toContain('Weekend work: none.');
  });

  it('warns about missing times and a stale total', () => {
    const sheet = septemberSheet();
    sheet.entries[0] = { ...sheet.entries[0], endTime: null };

    const report = buildTimesheetReport(sheet);

    expect(report.warnings).toContain('Sep 1: end time is missing.');
    expect(report.warnings.some((w) => w.startsWith('Saved total (210 h)'))).toBeTrue();
  });

  it('falls back to the profile when the sheet fields are empty', () => {
    const report = buildTimesheetReport(
      septemberSheet({
        employeeName: null,
        department: null,
        user: { id: 'u1', fullName: 'Ada Lovelace', email: 'a@example.com', department: 'R&D' },
      })
    );
    expect(report.employee).toBe('Ada Lovelace');
    expect(report.department).toBe('R&D');
  });
});

describe('reportToHtml', () => {
  it('escapes user text so it cannot inject markup', () => {
    const html = reportToHtml(
      buildTimesheetReport(septemberSheet({ employeeName: '<img src=x onerror=alert(1)>' }))
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<script');
  });
});

describe('TimesheetExportService', () => {
  const report = buildTimesheetReport(septemberSheet());
  let service: TimesheetExportService;

  beforeEach(() => {
    service = TestBed.inject(TimesheetExportService);
  });

  it('builds a real PDF', async () => {
    const blob = await service.buildPdf(report);
    const head = new TextDecoder().decode(new Uint8Array(await blob.slice(0, 5).arrayBuffer()));
    expect(head).toBe('%PDF-');
    expect(blob.size).toBeGreaterThan(2000);
  });

  it('builds a real Word document', async () => {
    const blob = await service.buildDocx(report);
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    // .docx is a zip archive: "PK".
    expect(String.fromCharCode(...head)).toBe('PK');
    expect(blob.size).toBeGreaterThan(2000);
  });
});
