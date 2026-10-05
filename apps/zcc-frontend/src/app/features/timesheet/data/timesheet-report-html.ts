/**
 * The report as a self-contained HTML document. The preview shows it in a
 * sandboxed iframe and Print prints that same frame, so what is printed is
 * exactly what was previewed and nothing else on the page leaks in.
 * Every value is escaped; the document contains no script.
 */
import { REPORT_ROW_FILL } from './timesheet-export.service';
import { TimesheetReport, joinDates } from './timesheet-report';

const escape = (value: string | number | null | undefined): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const rowStyles = Object.entries(REPORT_ROW_FILL)
  .filter(([, fill]) => fill)
  .map(([kind, fill]) => `tr.${kind} td { background: #${fill}; }`)
  .join('\n  ');

export function reportToHtml(report: TimesheetReport): string {
  const { summary } = report;
  const rows = report.rows
    .map(
      (row) => `<tr class="${row.kind}">
        <td>${escape(row.dateLabel)}</td>
        <td>${escape(row.day)}</td>
        <td>${escape(row.start)}</td>
        <td>${escape(row.end)}</td>
        <td>${escape(row.hours)}</td>
        <td class="notes">${escape(row.statusNotes)}</td>
      </tr>`
    )
    .join('\n');

  const summaryRows: [string, string][] = [
    ['Working days', String(summary.workingDays)],
    [
      'Leave days',
      summary.leaveDates.length
        ? `${summary.leaveDates.length} (${joinDates(summary.leaveDates)})`
        : '0',
    ],
    ...(summary.holidayDates.length
      ? ([['Holidays', `${summary.holidayDates.length} (${joinDates(summary.holidayDates)})`]] as [
          string,
          string,
        ][])
      : []),
    ['Total hours', `${summary.totalHours} hours`],
  ];

  const generated = report.generatedAt.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escape(report.fileBaseName)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 28px; color: #17211d; background: #fff;
         font: 12px/1.45 "Segoe UI", Calibri, Arial, sans-serif; }
  .page { max-width: 760px; margin: 0 auto; }
  h1 { margin: 0 0 18px; text-align: center; font-size: 22px; letter-spacing: 0.08em; }
  h2 { margin: 22px 0 8px; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #d0d9d4; padding: 5px 7px; }
  .info th { width: 15%; text-align: left; color: #5f6b65; background: #eef4f1; }
  .info td { width: 35%; }
  .daily { margin-top: 14px; }
  .daily th { color: #fff; background: #1d5946; }
  .daily td { text-align: center; font-variant-numeric: tabular-nums; }
  .daily td.notes { text-align: left; }
  tr.leave td:nth-child(n+5), tr.holiday td:nth-child(n+5) { font-weight: 700; }
  ${rowStyles}
  .summary th { width: 25%; text-align: left; color: #5f6b65; background: #eef4f1; }
  .summary caption { padding: 6px 8px; color: #fff; background: #1d5946; font-weight: 700; text-align: left; }
  ul { margin: 0; padding-left: 18px; color: #5f6b65; }
  li { margin: 2px 0; }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 46px; }
  .signatures div { padding-top: 6px; border-top: 1px solid #17211d; }
  .signatures strong { display: block; }
  .signatures span { display: block; color: #5f6b65; }
  footer { margin-top: 28px; color: #5f6b65; font-size: 10px; text-align: right; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .keep { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<main class="page">
  <h1>${escape(report.title)}</h1>

  <table class="info">
    <tr><th>Employee</th><td>${escape(report.employee)}</td>
        <th>Department</th><td>${escape(report.department)}</td></tr>
    <tr><th>Period</th><td>${escape(report.periodRange)}</td>
        <th>Total Hours</th><td>${escape(summary.totalHours)} hours</td></tr>
  </table>

  <table class="daily">
    <thead><tr><th>Date</th><th>Day</th><th>Start Time</th><th>End Time</th><th>Hours</th><th>Status/Notes</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>

  <section class="keep">
    <h2>Summary</h2>
    <table class="summary">
      ${summaryRows.map(([name, value]) => `<tr><th>${escape(name)}</th><td>${escape(value)}</td></tr>`).join('\n      ')}
    </table>
  </section>

  <section class="keep">
    <h2>Work Schedule Notes</h2>
    <ul>
      ${report.scheduleNotes.map((note) => `<li>${escape(note)}</li>`).join('\n      ')}
    </ul>
  </section>

  <section class="keep">
    <h2>Approvals</h2>
    <div class="signatures">
      <div><strong>Employee signature</strong><span>${escape(report.employee)}</span><span>Date: ____________________</span></div>
      <div><strong>Manager signature</strong><span>${escape(report.approverName ?? '')}&nbsp;</span><span>Date: ____________________</span></div>
    </div>
  </section>

  <footer>Generated ${escape(generated)}</footer>
</main>
</body>
</html>`;
}
