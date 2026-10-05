import {
  AlignmentType,
  Document,
  HeightRule,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import {
  InvoiceViewModel,
  ITEM_AREA_ROWS,
  TRAILING_BLANK_ROWS,
  footerText,
} from './invoice.viewmodel';

/** Word output follows the same grid as invoice.html.ts, built natively rather than converted. */

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

interface Run {
  text: string;
  bold?: boolean;
  size?: number;
}

/** A4 is 11906 twips wide; 850-twip (15 mm) margins leave this for the table. */
const CONTENT_WIDTH = 10206;
const COLUMN_SHARES = [0.083, 0.436, 0.148, 0.166, 0.167];
const COLUMN_WIDTHS = COLUMN_SHARES.map((share) => Math.round(CONTENT_WIDTH * share));
/** Blank rows keep the height they have on the paper bill (≈ 0.9 cm). */
const BLANK_ROW_TWIPS = 500;

const paragraph = (run: Run, align?: Align): Paragraph =>
  new Paragraph({
    alignment: align,
    children: [new TextRun({ text: run.text, bold: run.bold, size: run.size })],
  });

const cell = (
  runs: (Run | null)[],
  options: { align?: Align; span?: number; top?: boolean } = {}
): TableCell => {
  const present = runs.filter((run): run is Run => run !== null);
  const span = options.span ?? 1;
  return new TableCell({
    columnSpan: span > 1 ? span : undefined,
    verticalAlign: options.top ? VerticalAlign.TOP : VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: (present.length ? present : [{ text: '' }]).map((run) =>
      paragraph(run, options.align)
    ),
  });
};

const row = (cells: TableCell[], blank = false): TableRow =>
  new TableRow({
    cantSplit: true,
    children: cells,
    height: blank ? { value: BLANK_ROW_TWIPS, rule: HeightRule.ATLEAST } : undefined,
  });

const blankRow = (): TableRow => row([cell([]), cell([]), cell([]), cell([]), cell([])], true);

const amountRow = (label: string, value: string, bold: boolean, words?: string): TableRow =>
  row([
    cell([]),
    cell([words ? { text: words } : null], { span: 2 }),
    cell([{ text: label, bold }], { align: AlignmentType.RIGHT }),
    cell([{ text: value, bold: true }], { align: AlignmentType.RIGHT }),
  ]);

export const renderInvoiceDocx = async (vm: InvoiceViewModel): Promise<Buffer> => {
  const center = AlignmentType.CENTER;
  const rows: TableRow[] = [
    row([
      cell(
        [
          { text: 'To,' },
          { text: vm.client.name, bold: true },
          ...vm.client.addressLines.map((text) => ({ text })),
          vm.client.gstin ? { text: `GST No: ${vm.client.gstin}`, bold: true } : null,
        ],
        { span: 2, top: true }
      ),
      cell(
        [
          { text: `Bill No: ${vm.number ?? 'DRAFT'}`, bold: true },
          { text: `Date: ${vm.dateText}`, bold: true },
          { text: vm.seller.name, bold: true, size: 23 },
          ...vm.seller.addressLines.map((text) => ({ text })),
          vm.seller.pan ? { text: `PAN No: ${vm.seller.pan}`, bold: true } : null,
          vm.seller.gstin ? { text: `GST No: ${vm.seller.gstin}`, bold: true } : null,
        ],
        { span: 3, top: true }
      ),
    ]),
    row([
      cell([vm.client.attn ? { text: `Attn: ${vm.client.attn}`, bold: true } : null], { span: 2 }),
      cell([], { span: 3 }),
    ]),
    row([
      cell([{ text: 'Sl.No', bold: true }], { align: center }),
      cell([{ text: 'Description Of Service', bold: true }]),
      cell([{ text: 'Qty', bold: true }], { align: center }),
      cell([{ text: 'Rate', bold: true }], { align: center }),
      cell([{ text: 'Value', bold: true }], { align: center }),
    ]),
    ...vm.items.map((item) =>
      row([
        cell([{ text: String(item.slNo) }], { align: center }),
        cell([{ text: item.description, bold: true }, item.note ? { text: item.note } : null]),
        cell([{ text: item.qty }], { align: center }),
        cell([{ text: item.rate }], { align: center }),
        cell([{ text: item.value, bold: true }], { align: center }),
      ])
    ),
    ...Array.from({ length: Math.max(0, ITEM_AREA_ROWS - vm.items.length) }, blankRow),
    row(
      [cell([]), cell([{ text: vm.periodLabel ?? '', bold: true }]), cell([]), cell([]), cell([])],
      true
    ),
    blankRow(),
    amountRow('Total', vm.totals.subtotal, true),
    ...(vm.totals.tax ? [amountRow(vm.totals.tax.label, vm.totals.tax.amount, false)] : []),
    amountRow('Advance', vm.totals.advance, false, `Amount In Rupees: ${vm.amountInWords}`),
    amountRow('Grand Total', vm.totals.grand, true),
    ...Array.from({ length: TRAILING_BLANK_ROWS }, blankRow),
    row([cell([]), cell([{ text: footerText(vm) }], { span: 4, align: AlignmentType.RIGHT })]),
    row([
      cell([]),
      cell(
        vm.bank
          ? [
              { text: 'Bank Details', bold: true },
              { text: `Account Name: ${vm.bank.accountName}`, bold: true },
              { text: `Bank: ${vm.bank.bank}` },
              vm.bank.branch ? { text: `Branch: ${vm.bank.branch}` } : null,
              { text: `Account Number: ${vm.bank.accountNumber}` },
              { text: `IFSC Code: ${vm.bank.ifsc}` },
            ]
          : [],
        { top: true }
      ),
      cell(
        vm.terms
          ? [
              { text: 'Terms & Conditions:', bold: true },
              ...vm.terms.split(/\r?\n/).map((text) => ({ text })),
            ]
          : [],
        { span: 3, top: true }
      ),
    ]),
  ];

  const stamp = vm.isDraft ? 'DRAFT' : vm.isCancelled ? 'CANCELLED' : null;
  const doc = new Document({
    title: `Invoice ${vm.number ?? 'Draft'}`,
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [
      {
        properties: {
          page: { margin: { top: 1700, bottom: 850, left: 850, right: 850 } },
        },
        children: [
          ...(stamp
            ? [paragraph({ text: stamp, bold: true, size: 36 }, AlignmentType.CENTER)]
            : []),
          new Table({
            width: { size: CONTENT_WIDTH, type: WidthType.DXA },
            columnWidths: COLUMN_WIDTHS,
            layout: TableLayoutType.FIXED,
            rows,
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
};
