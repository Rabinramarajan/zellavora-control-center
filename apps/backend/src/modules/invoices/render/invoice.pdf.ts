import pdfmake from 'pdfmake';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  InvoiceViewModel,
  ITEM_AREA_ROWS,
  TRAILING_BLANK_ROWS,
  footerText,
} from './invoice.viewmodel';

/*
 * pdfmake rather than a headless browser: the API runs on serverless hosts
 * without Chromium. The grid mirrors invoice.html.ts row for row. PDFKit's
 * built-in Helvetica needs no font files.
 */
const HELVETICA = {
  normal: 'Helvetica',
  bold: 'Helvetica-Bold',
  italics: 'Helvetica-Oblique',
  bolditalics: 'Helvetica-BoldOblique',
};
const BUILT_IN_FONTS = new Set(Object.values(HELVETICA));

pdfmake.setFonts({ Helvetica: HELVETICA });
// Invoices embed no images or files; the policy also sees PDFKit's built-in font names.
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((path) => BUILT_IN_FONTS.has(path));

/** Column shares of the paper bill: Sl.No, Description, Qty, Rate, Value. */
const WIDTHS = ['8.3%', '43.6%', '14.8%', '16.6%', '16.7%'];
/** Height a blank row keeps, in points (≈ 34px on the HTML bill). */
const BLANK_ROW_HEIGHT = 18;

type Line = { text: string; bold?: boolean; fontSize?: number };

const stack = (items: (Line | null)[]): TableCell => ({
  stack: items.filter((item): item is Line => item !== null),
});

/** pdfmake wants a placeholder for every cell a span covers. */
const span = (cell: TableCell, count: number): TableCell[] => [
  { ...(cell as object), colSpan: count } as TableCell,
  ...Array.from({ length: count - 1 }, () => ({}) as TableCell),
];

const empty = (): TableCell => ({ text: '' });
const blank = (): TableCell[] => [empty(), empty(), empty(), empty(), empty()];

const amountRow = (label: string, value: string, bold: boolean, words?: string): TableCell[] => [
  empty(),
  ...span({ text: words ?? '' }, 2),
  { text: label, alignment: 'right', bold },
  { text: value, alignment: 'right', bold: true },
];

export const buildPdfDefinition = (vm: InvoiceViewModel): TDocumentDefinitions => {
  const body: TableCell[][] = [];
  const blankIndexes = new Set<number>();
  const addBlank = (): void => {
    blankIndexes.add(body.length);
    body.push(blank());
  };

  body.push([
    ...span(
      stack([
        { text: 'To,' },
        { text: vm.client.name, bold: true },
        ...vm.client.addressLines.map((text) => ({ text })),
        vm.client.gstin ? { text: `GST No: ${vm.client.gstin}`, bold: true } : null,
      ]),
      2
    ),
    ...span(
      stack([
        { text: `Bill No: ${vm.number ?? 'DRAFT'}`, bold: true },
        { text: `Date: ${vm.dateText}`, bold: true },
        { text: vm.seller.name, bold: true, fontSize: 11 },
        ...vm.seller.addressLines.map((text) => ({ text })),
        vm.seller.pan ? { text: `PAN No: ${vm.seller.pan}`, bold: true } : null,
        vm.seller.gstin ? { text: `GST No: ${vm.seller.gstin}`, bold: true } : null,
      ]),
      3
    ),
  ]);
  body.push([
    ...span({ text: vm.client.attn ? `Attn: ${vm.client.attn}` : ' ', bold: true }, 2),
    ...span(empty(), 3),
  ]);
  body.push([
    { text: 'Sl.No', bold: true, alignment: 'center' },
    { text: 'Description Of Service', bold: true },
    { text: 'Qty', bold: true, alignment: 'center' },
    { text: 'Rate', bold: true, alignment: 'center' },
    { text: 'Value', bold: true, alignment: 'center' },
  ]);
  for (const item of vm.items) {
    body.push([
      { text: String(item.slNo), alignment: 'center' },
      stack([{ text: item.description, bold: true }, item.note ? { text: item.note } : null]),
      { text: item.qty, alignment: 'center' },
      { text: item.rate, alignment: 'center' },
      { text: item.value, alignment: 'center', bold: true },
    ]);
  }
  for (let i = vm.items.length; i < ITEM_AREA_ROWS; i++) addBlank();
  blankIndexes.add(body.length);
  body.push([empty(), { text: vm.periodLabel ?? '', bold: true }, empty(), empty(), empty()]);
  addBlank();
  body.push(amountRow('Total', vm.totals.subtotal, true));
  if (vm.totals.tax) body.push(amountRow(vm.totals.tax.label, vm.totals.tax.amount, false));
  body.push(
    amountRow('Advance', vm.totals.advance, false, `Amount In Rupees: ${vm.amountInWords}`)
  );
  body.push(amountRow('Grand Total', vm.totals.grand, true));
  for (let i = 0; i < TRAILING_BLANK_ROWS; i++) addBlank();
  body.push([empty(), ...span({ text: footerText(vm), alignment: 'right' }, 4)]);
  body.push([
    empty(),
    vm.bank
      ? stack([
          { text: 'Bank Details', bold: true },
          { text: `Account Name: ${vm.bank.accountName}`, bold: true },
          { text: `Bank: ${vm.bank.bank}` },
          vm.bank.branch ? { text: `Branch: ${vm.bank.branch}` } : null,
          { text: `Account Number: ${vm.bank.accountNumber}` },
          { text: `IFSC Code: ${vm.bank.ifsc}` },
        ])
      : empty(),
    ...span(
      vm.terms
        ? stack([
            { text: 'Terms & Conditions:', bold: true },
            ...vm.terms.split(/\r?\n/).map((text) => ({ text })),
          ])
        : empty(),
      3
    ),
  ]);

  const stampText = vm.isDraft ? 'DRAFT' : vm.isCancelled ? 'CANCELLED' : undefined;
  const table: Content = {
    table: {
      widths: WIDTHS,
      body,
      heights: (row: number) => (blankIndexes.has(row) ? BLANK_ROW_HEIGHT : 'auto'),
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: () => 0.75,
      vLineWidth: () => 0.75,
      hLineColor: () => '#000000',
      vLineColor: () => '#000000',
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  };

  return {
    pageSize: 'A4',
    pageMargins: [42, 85, 42, 42],
    defaultStyle: { font: 'Helvetica', fontSize: 9.5, lineHeight: 1.15, color: '#000000' },
    info: { title: `Invoice ${vm.number ?? 'Draft'}` },
    watermark: stampText ? { text: stampText, opacity: 0.08, bold: true } : undefined,
    content: [table],
  };
};

export const renderInvoicePdf = async (vm: InvoiceViewModel): Promise<Buffer> =>
  pdfmake.createPdf(buildPdfDefinition(vm)).getBuffer();
