/**
 * Timesheet exports.
 *
 * Three formats share one shape so the printed sheet, the spreadsheet and
 * the integration payload never disagree:
 *   json — the sheet and its entries, for backup and integrations
 *   csv  — the grid, for spreadsheets
 *   html — a print-ready document (info header, table, summary, signature
 *          blocks) that reproduces the Word layout; "Print to PDF" in the
 *          browser produces the PDF.
 *
 * There is no server-side PDF renderer in this repo yet. When a reporting
 * service is added, it should render from `buildExportModel` rather than
 * re-deriving any of these figures.
 */
import { TimesheetWithEntries } from './timesheets.repository';
import { computeTotals, TimesheetTotals } from './timesheets.service';
import { dateKey } from './timesheets.calendar';

export interface ExportRow {
  date: string;
  dayOfWeek: string;
  startTime: string | null;
  endTime: string | null;
  hours: number | null;
  status: string;
  notes: string | null;
}

export interface ExportModel {
  id: string;
  period: string;
  status: string;
  employee: { id: string; name: string; email: string; jobTitle: string | null };
  approver: { id: string; name: string } | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  totals: TimesheetTotals;
  rows: ExportRow[];
}

const STATUS_LABELS: Record<string, string> = {
  EMPTY: '—',
  WORKING: 'Working',
  EXTENDED: 'Extended',
  WEEKEND_WORK: 'Weekend work',
  LEAVE: 'Leave',
  HOLIDAY: 'Holiday',
};

export const buildExportModel = (sheet: TimesheetWithEntries): ExportModel => ({
  id: sheet.id,
  period: sheet.period,
  status: sheet.status,
  employee: {
    id: sheet.user.id,
    name: sheet.user.fullName,
    email: sheet.user.email,
    jobTitle: sheet.user.jobTitle,
  },
  approver: sheet.approver ? { id: sheet.approver.id, name: sheet.approver.fullName } : null,
  submittedAt: sheet.submittedAt?.toISOString() ?? null,
  approvedAt: sheet.approvedAt?.toISOString() ?? null,
  rejectedAt: sheet.rejectedAt?.toISOString() ?? null,
  rejectionReason: sheet.rejectionReason,
  totals: computeTotals(sheet.entries),
  rows: sheet.entries.map((entry) => ({
    date: dateKey(entry.entryDate),
    dayOfWeek: entry.dayOfWeek,
    startTime: entry.startTime,
    endTime: entry.endTime,
    hours: entry.hours === null ? null : Number(entry.hours),
    status: entry.status,
    notes: entry.notes,
  })),
});

const csvCell = (value: string | number | null): string => {
  if (value === null) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (model: ExportModel): string => {
  const header = ['Date', 'Day', 'Start', 'End', 'Hours', 'Status', 'Notes'];
  const lines = [
    header.join(','),
    ...model.rows.map((row) =>
      [
        row.date,
        row.dayOfWeek,
        row.startTime,
        row.endTime,
        row.hours,
        STATUS_LABELS[row.status] ?? row.status,
        row.notes,
      ]
        .map(csvCell)
        .join(',')
    ),
  ];
  return lines.join('\r\n');
};

const escapeHtml = (value: string | null): string =>
  (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatDateTime = (iso: string | null): string =>
  iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) : '—';

export const toPrintableHtml = (model: ExportModel): string => {
  const rows = model.rows
    .map((row) => {
      const weekend = row.dayOfWeek === 'Saturday' || row.dayOfWeek === 'Sunday';
      const nonWorking = row.status === 'LEAVE' || row.status === 'HOLIDAY';
      const cls = nonWorking ? 'non-working' : weekend ? 'weekend' : '';
      return `<tr class="${cls}">
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.dayOfWeek)}</td>
        <td>${escapeHtml(row.startTime)}</td>
        <td>${escapeHtml(row.endTime)}</td>
        <td class="num">${row.hours === null ? '' : row.hours.toFixed(2)}</td>
        <td>${escapeHtml(STATUS_LABELS[row.status] ?? row.status)}</td>
        <td>${escapeHtml(row.notes)}</td>
      </tr>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Timesheet ${escapeHtml(model.period)} — ${escapeHtml(model.employee.name)}</title>
<style>
  :root { color-scheme: light; }
  body { font: 12px/1.5 "Segoe UI", Arial, sans-serif; color: #111; margin: 32px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #555; margin: 0 0 20px; }
  .info { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 24px; margin-bottom: 20px; }
  .info div { display: flex; gap: 8px; }
  .info span:first-child { color: #555; min-width: 110px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d0d0d0; padding: 5px 8px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.weekend td { background: #fafafa; }
  tr.non-working td { background: #fff7ed; }
  .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
  .summary div { border: 1px solid #d0d0d0; padding: 10px; }
  .summary strong { display: block; font-size: 18px; }
  .signatures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 48px; margin-top: 48px; }
  .signatures div { border-top: 1px solid #111; padding-top: 6px; color: #555; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>Timesheet — ${escapeHtml(model.period)}</h1>
  <p class="sub">Status: ${escapeHtml(model.status)}</p>

  <section class="info">
    <div><span>Employee</span><span>${escapeHtml(model.employee.name)}</span></div>
    <div><span>Email</span><span>${escapeHtml(model.employee.email)}</span></div>
    <div><span>Role</span><span>${escapeHtml(model.employee.jobTitle) || '—'}</span></div>
    <div><span>Period</span><span>${escapeHtml(model.period)}</span></div>
    <div><span>Submitted</span><span>${formatDateTime(model.submittedAt)}</span></div>
    <div><span>Approved</span><span>${formatDateTime(model.approvedAt)}</span></div>
  </section>

  <table>
    <thead>
      <tr><th>Date</th><th>Day</th><th>Start</th><th>End</th><th>Hours</th><th>Status</th><th>Notes</th></tr>
    </thead>
    <tbody>
${rows}
    </tbody>
  </table>

  <section class="summary">
    <div><span>Working days</span><strong>${model.totals.workingDays}</strong></div>
    <div><span>Leave days</span><strong>${model.totals.leaveDays}</strong></div>
    <div><span>Weekend / extended</span><strong>${
      model.totals.weekendWorkDays + model.totals.extendedDays
    }</strong></div>
    <div><span>Total hours</span><strong>${model.totals.totalHours.toFixed(2)}</strong></div>
  </section>

  ${
    model.rejectionReason
      ? `<p><strong>Rejection reason:</strong> ${escapeHtml(model.rejectionReason)}</p>`
      : ''
  }

  <section class="signatures">
    <div>Employee signature — ${escapeHtml(model.employee.name)}</div>
    <div>Approver signature${model.approver ? ` — ${escapeHtml(model.approver.name)}` : ''}</div>
  </section>
</body>
</html>`;
};
