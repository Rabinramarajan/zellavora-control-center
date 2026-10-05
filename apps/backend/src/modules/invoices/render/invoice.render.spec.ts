import { Prisma } from '@prisma/client';
import { buildInvoiceViewModel, invoiceFileName, InvoiceRenderSource } from './invoice.viewmodel';
import { renderInvoiceHtml } from './invoice.html';
import { renderInvoicePdf } from './invoice.pdf';
import { renderInvoiceDocx } from './invoice.docx';

const D = (value: Prisma.Decimal.Value): Prisma.Decimal => new Prisma.Decimal(value);

const source = (overrides: Partial<InvoiceRenderSource> = {}): InvoiceRenderSource => ({
  invoiceNumber: 'FY26-27/04',
  status: 'ISSUED',
  invoiceDate: new Date('2026-10-05T00:00:00.000Z'),
  dueDate: new Date('2026-10-12T00:00:00.000Z'),
  periodLabel: "For the month of September '26",
  taxRate: D(0),
  taxAmount: D(0),
  subtotal: D(60000),
  advance: D(0),
  grandTotal: D(60000),
  amountInWords: 'Sixty Thousand Only',
  terms: 'Payment within 7 days\nElectronic bill',
  footerNote: 'Electronic bill signature not required',
  items: [
    { slNo: 1, description: 'Consulting', note: null, qty: D(1), rate: D(60000), amount: D(60000) },
  ],
  seller: {
    name: 'Rabin R',
    addressLines: ['12 Main Road', 'Chennai'],
    pan: 'ABCDE1234F',
    gstin: null,
    email: null,
    phone: null,
  },
  client: {
    name: 'Acme Pvt Ltd',
    addressLines: ['1 Park Street'],
    gstin: '33ABCDE1234F1Z5',
    attnName: 'Mr. Kumar',
    attnDesignation: 'Director',
  },
  bank: {
    accountName: 'Rabin R',
    bank: 'State Bank',
    branch: null,
    accountNumber: '1234567890',
    ifsc: 'SBIN0001234',
  },
  ...overrides,
});

describe('buildInvoiceViewModel', () => {
  it('formats Indian amounts and dd/MM/yyyy dates', () => {
    const vm = buildInvoiceViewModel(source());
    expect(vm.totals.grand).toBe('60,000');
    expect(vm.dateText).toBe('05/10/2026');
    expect(vm.client.attn).toBe('Mr. Kumar, Director');
    expect(vm.totals.tax).toBeUndefined();
  });

  it('shows a tax line only above zero', () => {
    const vm = buildInvoiceViewModel(source({ taxRate: D(18), taxAmount: D(10800) }));
    expect(vm.totals.tax).toEqual({ label: 'Tax @ 18%', amount: '10,800' });
  });

  it('names files without slashes', () => {
    expect(invoiceFileName(buildInvoiceViewModel(source()))).toBe('Invoice_FY26-27-04_2026-10-05');
    expect(
      invoiceFileName(buildInvoiceViewModel(source({ invoiceNumber: null, status: 'DRAFT' })))
    ).toBe('Invoice_Draft_2026-10-05');
  });
});

describe('renderInvoiceHtml', () => {
  it('escapes every free-text field', () => {
    const html = renderInvoiceHtml(
      buildInvoiceViewModel(
        source({
          items: [
            {
              slNo: 1,
              description: '<script>alert(1)</script>',
              note: '"x" & \'y\'',
              qty: D(1),
              rate: D(1),
              amount: D(1),
            },
          ],
        })
      )
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&quot;x&quot; &amp; &#39;y&#39;');
  });

  it('watermarks drafts', () => {
    const html = renderInvoiceHtml(
      buildInvoiceViewModel(source({ status: 'DRAFT', invoiceNumber: null }))
    );
    expect(html).toContain('class="watermark">DRAFT');
    expect(html).toContain('Bill No:</strong> DRAFT');
  });

  it('carries the sample bill content', () => {
    const html = renderInvoiceHtml(buildInvoiceViewModel(source()));
    for (const text of [
      'FY26-27/04',
      'Sixty Thousand Only',
      'PAN No: ABCDE1234F',
      'IFSC Code: SBIN0001234',
      "September '26",
    ]) {
      expect(html).toContain(text.replace("'", '&#39;'));
    }
  });
});

describe('binary exports', () => {
  it('produces a PDF', async () => {
    const pdf = await renderInvoicePdf(buildInvoiceViewModel(source()));
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('produces a Word document (a zip)', async () => {
    const docx = await renderInvoiceDocx(buildInvoiceViewModel(source({ status: 'DRAFT' })));
    expect(docx.subarray(0, 2).toString()).toBe('PK');
  });
});
