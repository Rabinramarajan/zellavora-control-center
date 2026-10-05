import { Injectable } from '@angular/core';
import { ReportRowKind, TimesheetReport, joinDates } from './timesheet-report';

type Rgb = [number, number, number];

/** Shared palette so the PDF, the Word file and the preview shade rows alike. */
export const REPORT_ROW_FILL: Record<ReportRowKind, string | null> = {
  work: null,
  'weekend-work': 'FFF6DA',
  leave: 'FDE8E8',
  holiday: 'E3F1FA',
  weekend: 'F1F3F2',
  blank: null,
};
const HEADER_FILL = '1D5946';
const LABEL_FILL = 'EEF4F1';
const TEXT = '17211D';
const MUTED = '5F6B65';

const rgb = (hex: string): Rgb => [
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
];

const formatGenerated = (date: Date): string =>
  date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const summaryRows = (report: TimesheetReport): [string, string][] => {
  const { summary } = report;
  return [
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
};

/**
 * Builds the timesheet as a PDF or a Word document in the browser. jsPDF and
 * docx are imported on first use, so they never weigh on page load.
 */
@Injectable({ providedIn: 'root' })
export class TimesheetExportService {
  public async exportPdf(report: TimesheetReport): Promise<void> {
    this.download(await this.buildPdf(report), `${report.fileBaseName}.pdf`);
  }

  public async exportDocx(report: TimesheetReport): Promise<void> {
    this.download(await this.buildDocx(report), `${report.fileBaseName}.docx`);
  }

  public async buildPdf(report: TimesheetReport): Promise<Blob> {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 40;
    const lastY = (): number =>
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    doc.setProperties({
      title: `${report.title} — ${report.employee} — ${report.periodLabel}`,
      author: report.employee,
      creator: 'Zellavora Control Center',
    });

    doc
      .setFont('helvetica', 'bold')
      .setFontSize(18)
      .setTextColor(...rgb(TEXT));
    doc.text(report.title, pageWidth / 2, 48, { align: 'center' });

    const label = { fillColor: rgb(LABEL_FILL), fontStyle: 'bold' as const, textColor: rgb(MUTED) };
    autoTable(doc, {
      startY: 64,
      margin: { left: margin, right: margin },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 5, lineColor: rgb('D0D9D4'), textColor: rgb(TEXT) },
      body: [
        [
          { content: 'Employee', styles: label },
          report.employee,
          { content: 'Department', styles: label },
          report.department,
        ],
        [
          { content: 'Period', styles: label },
          report.periodRange,
          { content: 'Total Hours', styles: label },
          `${report.summary.totalHours} hours`,
        ],
      ],
      columnStyles: { 0: { cellWidth: 72 }, 2: { cellWidth: 78 } },
    });

    autoTable(doc, {
      startY: lastY() + 14,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [['Date', 'Day', 'Start Time', 'End Time', 'Hours', 'Status/Notes']],
      body: report.rows.map((row) => [
        row.dateLabel,
        row.day,
        row.start,
        row.end,
        row.hours,
        row.statusNotes,
      ]),
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
        halign: 'center',
        lineColor: rgb('D0D9D4'),
        textColor: rgb(TEXT),
      },
      headStyles: { fillColor: rgb(HEADER_FILL), textColor: 255, fontStyle: 'bold' },
      columnStyles: { 5: { halign: 'left', cellWidth: 170 } },
      didParseCell: (cell) => {
        if (cell.section !== 'body') return;
        const row = report.rows[cell.row.index];
        const fill = REPORT_ROW_FILL[row.kind];
        if (fill) cell.cell.styles.fillColor = rgb(fill);
        if ((row.kind === 'leave' || row.kind === 'holiday') && cell.column.index >= 4) {
          cell.cell.styles.fontStyle = 'bold';
        }
      },
    });

    autoTable(doc, {
      startY: lastY() + 18,
      margin: { left: margin, right: margin },
      theme: 'grid',
      head: [[{ content: 'Summary', colSpan: 2 }]],
      body: summaryRows(report).map(([name, value]) => [{ content: name, styles: label }, value]),
      styles: { fontSize: 9, cellPadding: 5, lineColor: rgb('D0D9D4'), textColor: rgb(TEXT) },
      headStyles: { fillColor: rgb(HEADER_FILL), textColor: 255 },
      columnStyles: { 0: { cellWidth: 110 } },
      rowPageBreak: 'avoid',
    });

    let y = lastY() + 24;
    const ensureSpace = (needed: number): void => {
      if (y + needed > doc.internal.pageSize.getHeight() - 50) {
        doc.addPage();
        y = 50;
      }
    };

    ensureSpace(30 + report.scheduleNotes.length * 14);
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(11)
      .setTextColor(...rgb(TEXT));
    doc.text('Work Schedule Notes', margin, y);
    y += 16;
    doc
      .setFont('helvetica', 'normal')
      .setFontSize(9)
      .setTextColor(...rgb(MUTED));
    for (const note of report.scheduleNotes) {
      const lines = doc.splitTextToSize(`•  ${note}`, pageWidth - margin * 2);
      ensureSpace(lines.length * 12);
      doc.text(lines, margin, y);
      y += lines.length * 12 + 2;
    }

    ensureSpace(110);
    y += 22;
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(11)
      .setTextColor(...rgb(TEXT));
    doc.text('Approvals', margin, y);
    y += 46;
    const columnWidth = (pageWidth - margin * 2 - 40) / 2;
    const signatures: [string, string][] = [
      ['Employee signature', report.employee],
      ['Manager signature', report.approverName ?? ''],
    ];
    signatures.forEach(([title, name], index) => {
      const x = margin + index * (columnWidth + 40);
      doc.setDrawColor(...rgb(TEXT)).setLineWidth(0.7);
      doc.line(x, y, x + columnWidth, y);
      doc
        .setFont('helvetica', 'bold')
        .setFontSize(9)
        .setTextColor(...rgb(TEXT));
      doc.text(title, x, y + 13);
      doc.setFont('helvetica', 'normal').setTextColor(...rgb(MUTED));
      if (name) doc.text(name, x, y + 26);
      doc.text('Date: ____________________', x, y + 40);
    });

    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page++) {
      doc.setPage(page);
      doc
        .setFont('helvetica', 'normal')
        .setFontSize(7.5)
        .setTextColor(...rgb(MUTED));
      const footerY = doc.internal.pageSize.getHeight() - 24;
      doc.text(`Generated ${formatGenerated(report.generatedAt)}`, margin, footerY);
      doc.text(`Page ${page} of ${pages}`, pageWidth - margin, footerY, { align: 'right' });
    }

    return doc.output('blob');
  }

  public async buildDocx(report: TimesheetReport): Promise<Blob> {
    const {
      AlignmentType,
      BorderStyle,
      Document,
      Footer,
      Packer,
      PageNumber,
      Paragraph,
      ShadingType,
      Table,
      TableCell,
      TableRow,
      TextRun,
      WidthType,
    } = await import('docx');

    const font = 'Calibri';
    const run = (text: string, options: { bold?: boolean; color?: string; size?: number } = {}) =>
      new TextRun({
        text,
        font,
        size: options.size ?? 18,
        bold: options.bold,
        color: options.color ?? TEXT,
      });
    const cell = (
      text: string,
      options: {
        bold?: boolean;
        fill?: string | null;
        color?: string;
        align?: (typeof AlignmentType)[keyof typeof AlignmentType];
        width?: number;
        columnSpan?: number;
      } = {}
    ) =>
      new TableCell({
        children: [
          new Paragraph({
            alignment: options.align ?? AlignmentType.CENTER,
            children: [run(text, { bold: options.bold, color: options.color })],
          }),
        ],
        columnSpan: options.columnSpan,
        width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
        margins: { top: 50, bottom: 50, left: 90, right: 90 },
        shading: options.fill
          ? { type: ShadingType.CLEAR, color: 'auto', fill: options.fill }
          : undefined,
      });
    const fullWidth = { size: 100, type: WidthType.PERCENTAGE };
    const heading = (text: string) =>
      new Paragraph({
        spacing: { before: 280, after: 120 },
        children: [run(text, { bold: true, size: 22 })],
      });

    const info = new Table({
      width: fullWidth,
      rows: [
        new TableRow({
          children: [
            cell('Employee', { bold: true, fill: LABEL_FILL, color: MUTED, width: 15 }),
            cell(report.employee, { align: AlignmentType.LEFT, width: 35 }),
            cell('Department', { bold: true, fill: LABEL_FILL, color: MUTED, width: 15 }),
            cell(report.department, { align: AlignmentType.LEFT, width: 35 }),
          ],
        }),
        new TableRow({
          children: [
            cell('Period', { bold: true, fill: LABEL_FILL, color: MUTED }),
            cell(report.periodRange, { align: AlignmentType.LEFT }),
            cell('Total Hours', { bold: true, fill: LABEL_FILL, color: MUTED }),
            cell(`${report.summary.totalHours} hours`, { align: AlignmentType.LEFT }),
          ],
        }),
      ],
    });

    const headers = ['Date', 'Day', 'Start Time', 'End Time', 'Hours', 'Status/Notes'];
    const widths = [11, 9, 16, 16, 11, 37];
    const daily = new Table({
      width: fullWidth,
      rows: [
        new TableRow({
          tableHeader: true,
          children: headers.map((text, index) =>
            cell(text, { bold: true, fill: HEADER_FILL, color: 'FFFFFF', width: widths[index] })
          ),
        }),
        ...report.rows.map((row) => {
          const fill = REPORT_ROW_FILL[row.kind];
          const strong = row.kind === 'leave' || row.kind === 'holiday';
          return new TableRow({
            cantSplit: true,
            children: [
              cell(row.dateLabel, { fill }),
              cell(row.day, { fill }),
              cell(row.start, { fill }),
              cell(row.end, { fill }),
              cell(row.hours, { fill, bold: strong }),
              cell(row.statusNotes, { fill, bold: strong, align: AlignmentType.LEFT }),
            ],
          });
        }),
      ],
    });

    const summary = new Table({
      width: fullWidth,
      rows: summaryRows(report).map(
        ([name, value]) =>
          new TableRow({
            children: [
              cell(name, {
                bold: true,
                fill: LABEL_FILL,
                color: MUTED,
                width: 25,
                align: AlignmentType.LEFT,
              }),
              cell(value, { width: 75, align: AlignmentType.LEFT }),
            ],
          })
      ),
    });

    const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    const signatureCell = (title: string, name: string) =>
      new TableCell({
        width: { size: 50, type: WidthType.PERCENTAGE },
        borders: { top: none, bottom: none, left: none, right: none },
        margins: { right: 400 },
        children: [
          new Paragraph({ spacing: { before: 600 }, children: [run('')] }),
          new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 6, color: TEXT, space: 4 } },
            children: [run(title, { bold: true })],
          }),
          new Paragraph({ children: [run(name, { color: MUTED })] }),
          new Paragraph({ children: [run('Date: ____________________', { color: MUTED })] }),
        ],
      });

    const document = new Document({
      creator: 'Zellavora Control Center',
      title: `${report.title} — ${report.employee} — ${report.periodLabel}`,
      sections: [
        {
          properties: { page: { margin: { top: 900, bottom: 900, left: 900, right: 900 } } },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    run(`Generated ${formatGenerated(report.generatedAt)} · Page `, {
                      color: MUTED,
                      size: 15,
                    }),
                    new TextRun({ children: [PageNumber.CURRENT], font, size: 15, color: MUTED }),
                    run(' of ', { color: MUTED, size: 15 }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      font,
                      size: 15,
                      color: MUTED,
                    }),
                  ],
                }),
              ],
            }),
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 240 },
              children: [run(report.title, { bold: true, size: 36 })],
            }),
            info,
            new Paragraph({ spacing: { after: 200 }, children: [] }),
            daily,
            heading('Summary'),
            summary,
            heading('Work Schedule Notes'),
            ...report.scheduleNotes.map(
              (note) =>
                new Paragraph({ bullet: { level: 0 }, children: [run(note, { color: MUTED })] })
            ),
            heading('Approvals'),
            new Table({
              width: fullWidth,
              borders: {
                top: none,
                bottom: none,
                left: none,
                right: none,
                insideHorizontal: none,
                insideVertical: none,
              },
              rows: [
                new TableRow({
                  children: [
                    signatureCell('Employee signature', report.employee),
                    signatureCell('Manager signature', report.approverName ?? ''),
                  ],
                }),
              ],
            }),
          ],
        },
      ],
    });

    return Packer.toBlob(document);
  }

  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
