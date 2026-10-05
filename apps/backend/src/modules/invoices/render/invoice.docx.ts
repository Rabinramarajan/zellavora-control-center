import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { InvoiceViewModel } from './invoice.viewmodel';

/** Word output is built from the view-model directly; HTML-to-Word conversion renders poorly. */

type Align = (typeof AlignmentType)[keyof typeof AlignmentType];

const p = (
  text: string,
  options: { bold?: boolean; align?: Align; color?: string } = {}
): Paragraph =>
  new Paragraph({
    alignment: options.align,
    children: [new TextRun({ text, bold: options.bold, color: options.color })],
  });

const labelled = (label: string, value: string, align?: Align): Paragraph =>
  new Paragraph({
    alignment: align,
    children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(value)],
  });

const cell = (
  paragraphs: Paragraph[],
  options: { width?: number; header?: boolean } = {}
): TableCell =>
  new TableCell({
    children: paragraphs,
    width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    shading: options.header
      ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' }
      : undefined,
  });

const spacer = (): Paragraph => new Paragraph({ text: '' });

const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const boxed = (title: string, lines: string[]): Table =>
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [cell([p(title, { bold: true }), ...lines.map((line) => p(line))])],
      }),
    ],
  });

export const renderInvoiceDocx = async (vm: InvoiceViewModel): Promise<Buffer> => {
  const right = AlignmentType.RIGHT;
  const headerCells = ['Sl.No', 'Description Of Service', 'Qty', 'Rate', 'Value'];
  const widths = [8, 50, 10, 15, 17];

  const itemTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headerCells.map((text, index) =>
          cell([p(text, { bold: true, align: index >= 2 ? right : undefined })], {
            width: widths[index],
            header: true,
          })
        ),
      }),
      ...vm.items.map(
        (item) =>
          new TableRow({
            cantSplit: true,
            children: [
              cell([p(String(item.slNo))]),
              cell([
                p(item.description),
                ...(item.note ? [p(item.note, { color: '555555' })] : []),
                ...(vm.periodLabel && item.slNo === 1
                  ? [p(vm.periodLabel, { color: '555555' })]
                  : []),
              ]),
              cell([p(item.qty, { align: right })]),
              cell([p(item.rate, { align: right })]),
              cell([p(item.value, { align: right })]),
            ],
          })
      ),
    ],
  });

  const heading = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: NO_BORDERS,
    rows: [
      new TableRow({
        children: [
          cell(
            [
              p('To,', { bold: true }),
              p(vm.client.name),
              ...vm.client.addressLines.map((line) => p(line)),
              ...(vm.client.gstin ? [p(`GST No: ${vm.client.gstin}`)] : []),
            ],
            { width: 60 }
          ),
          cell(
            [
              labelled('Bill No', vm.number ?? 'DRAFT', right),
              labelled('Date', vm.dateText, right),
              ...(vm.dueDateText ? [labelled('Due', vm.dueDateText, right)] : []),
            ],
            { width: 40 }
          ),
        ],
      }),
    ],
  });

  const stamp = vm.isDraft ? 'DRAFT' : vm.isCancelled ? 'CANCELLED' : null;

  const doc = new Document({
    title: `Invoice ${vm.number ?? 'Draft'}`,
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [
      {
        children: [
          ...(stamp
            ? [p(stamp, { bold: true, align: AlignmentType.CENTER, color: 'AAAAAA' })]
            : []),
          heading,
          spacer(),
          p(vm.seller.name, { bold: true }),
          ...vm.seller.addressLines.map((line) => p(line)),
          ...(vm.seller.pan ? [p(`PAN No: ${vm.seller.pan}`)] : []),
          ...(vm.seller.gstin ? [p(`GST No: ${vm.seller.gstin}`)] : []),
          ...(vm.client.attn ? [p(`Attn: ${vm.client.attn}`)] : []),
          spacer(),
          itemTable,
          spacer(),
          labelled('Total', vm.totals.subtotal, right),
          ...(vm.totals.tax ? [labelled(vm.totals.tax.label, vm.totals.tax.amount, right)] : []),
          labelled('Advance', vm.totals.advance, right),
          labelled('Grand Total', vm.totals.grand, right),
          spacer(),
          labelled('Amount In Rupees', vm.amountInWords),
          ...(vm.footerNote ? [p(vm.footerNote, { color: '555555' })] : []),
          ...(vm.bank
            ? [
                spacer(),
                boxed('Bank Details', [
                  `Account Name: ${vm.bank.accountName}`,
                  `Bank: ${vm.bank.bank}`,
                  ...(vm.bank.branch ? [`Branch: ${vm.bank.branch}`] : []),
                  `Account Number: ${vm.bank.accountNumber}`,
                  `IFSC Code: ${vm.bank.ifsc}`,
                ]),
              ]
            : []),
          ...(vm.terms ? [spacer(), boxed('Terms & Conditions:', vm.terms.split(/\r?\n/))] : []),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
};
