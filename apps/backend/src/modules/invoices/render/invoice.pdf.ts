import pdfmake from 'pdfmake';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { InvoiceViewModel } from './invoice.viewmodel';

/*
 * pdfmake rather than a headless browser: the API runs on serverless hosts
 * without Chromium. The layout mirrors invoice.html.ts. PDFKit's built-in
 * Helvetica needs no font files; it has no ₹ glyph, so amounts stay plain.
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

const BORDER = '#222222';

const textLines = (values: (string | undefined)[]): string =>
  values.filter((value): value is string => Boolean(value)).join('\n');

const itemCell = (vm: InvoiceViewModel, item: InvoiceViewModel['items'][number]): TableCell => ({
  stack: [
    { text: item.description },
    ...(item.note ? [{ text: item.note, color: '#555555' }] : []),
    ...(vm.periodLabel && item.slNo === 1 ? [{ text: vm.periodLabel, color: '#555555' }] : []),
  ],
});

const totalRow = (label: string, value: string, bold = false): Content => ({
  columns: [
    { text: label, bold },
    { text: value, alignment: 'right', bold },
  ],
  margin: [0, 2, 0, 2],
});

const box = (title: string, body: string): Content => ({
  table: {
    widths: ['*'],
    body: [[{ stack: [{ text: title, bold: true }, { text: body }], margin: [4, 4, 4, 4] }]],
  },
  layout: { hLineColor: () => BORDER, vLineColor: () => BORDER },
  margin: [0, 18, 0, 0],
  unbreakable: true,
});

export const buildPdfDefinition = (vm: InvoiceViewModel): TDocumentDefinitions => {
  const header = ['Sl.No', 'Description Of Service', 'Qty', 'Rate', 'Value'].map(
    (text, index): TableCell => ({
      text,
      bold: true,
      fillColor: '#f2f2f2',
      alignment: index >= 2 ? 'right' : 'left',
    })
  );
  const rows: TableCell[][] = vm.items.map((item) => [
    { text: String(item.slNo) },
    itemCell(vm, item),
    { text: item.qty, alignment: 'right' },
    { text: item.rate, alignment: 'right' },
    { text: item.value, alignment: 'right' },
  ]);

  const stampText = vm.isDraft ? 'DRAFT' : vm.isCancelled ? 'CANCELLED' : undefined;

  return {
    pageSize: 'A4',
    pageMargins: [42, 45, 42, 45],
    defaultStyle: { font: 'Helvetica', fontSize: 10, lineHeight: 1.25, color: '#111111' },
    info: { title: `Invoice ${vm.number ?? 'Draft'}` },
    watermark: stampText ? { text: stampText, opacity: 0.08, bold: true } : undefined,
    content: [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'To,', bold: true },
              {
                text: textLines([
                  vm.client.name,
                  ...vm.client.addressLines,
                  vm.client.gstin && `GST No: ${vm.client.gstin}`,
                ]),
              },
            ],
          },
          {
            width: 'auto',
            alignment: 'right',
            stack: [
              { text: [{ text: 'Bill No: ', bold: true }, vm.number ?? 'DRAFT'] },
              { text: [{ text: 'Date: ', bold: true }, vm.dateText] },
              ...(vm.dueDateText
                ? [{ text: [{ text: 'Due: ', bold: true }, vm.dueDateText] }]
                : []),
            ],
          },
        ],
        columnGap: 30,
      },
      {
        margin: [0, 16, 0, 0],
        stack: [
          { text: vm.seller.name, bold: true },
          {
            text: textLines([
              ...vm.seller.addressLines,
              vm.seller.pan && `PAN No: ${vm.seller.pan}`,
              vm.seller.gstin && `GST No: ${vm.seller.gstin}`,
              vm.client.attn && `Attn: ${vm.client.attn}`,
            ]),
          },
        ],
      },
      {
        margin: [0, 20, 0, 0],
        table: {
          headerRows: 1,
          widths: [34, '*', 45, 72, 80],
          body: [header, ...rows],
          dontBreakRows: true,
        },
        layout: {
          hLineColor: () => BORDER,
          vLineColor: () => BORDER,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 4,
          paddingBottom: () => 4,
        },
      },
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 200,
            margin: [0, 10, 0, 0],
            stack: [
              totalRow('Total', vm.totals.subtotal),
              ...(vm.totals.tax ? [totalRow(vm.totals.tax.label, vm.totals.tax.amount)] : []),
              totalRow('Advance', vm.totals.advance),
              {
                canvas: [
                  { type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 1, lineColor: BORDER },
                ],
              },
              totalRow('Grand Total', vm.totals.grand, true),
            ],
          },
        ],
      },
      {
        margin: [0, 14, 0, 0],
        text: [{ text: 'Amount In Rupees: ', bold: true }, vm.amountInWords],
      },
      ...(vm.footerNote
        ? [{ margin: [0, 8, 0, 0], text: vm.footerNote, color: '#555555' } as Content]
        : []),
      ...(vm.bank
        ? [
            box(
              'Bank Details',
              textLines([
                `Account Name: ${vm.bank.accountName}`,
                `Bank: ${vm.bank.bank}`,
                vm.bank.branch && `Branch: ${vm.bank.branch}`,
                `Account Number: ${vm.bank.accountNumber}`,
                `IFSC Code: ${vm.bank.ifsc}`,
              ])
            ),
          ]
        : []),
      ...(vm.terms ? [box('Terms & Conditions:', vm.terms)] : []),
    ],
  };
};

export const renderInvoicePdf = async (vm: InvoiceViewModel): Promise<Buffer> =>
  pdfmake.createPdf(buildPdfDefinition(vm)).getBuffer();
