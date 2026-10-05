import { parseInvoiceLines } from './invoice-import';

/** Lines as pdf.js groups them: the right-hand column shares a row with the left. */
const SAMPLE = [
  'To, Bill No: FY26-27/04',
  'Acme Technologies Pvt Ltd Date: 05/10/2026',
  '12, Anna Salai',
  'Chennai 600002',
  'GST No: 33ABCDE1234F1Z5',
  'Rabin R',
  '45 Lake View Road, Chennai',
  'PAN No: ABCDE1234F',
  'Attn: Mr. Kumar, Director',
  'Sl.No Description Of Service Qty Rate Value',
  '1 Software development services 1 60,000 60,000',
  "For the month of September '26",
  'Total 60,000',
  'Advance 0',
  'Grand Total 60,000',
  'Amount In Rupees: Sixty Thousand Only',
  'Electronic bill signature not required',
];

describe('parseInvoiceLines', () => {
  it('reads the sample bill', () => {
    const parsed = parseInvoiceLines(SAMPLE);
    expect(parsed.invoiceNumber).toBe('FY26-27/04');
    expect(parsed.invoiceDate).toBe('2026-10-05');
    expect(parsed.client).toEqual({
      name: 'Acme Technologies Pvt Ltd',
      addressLines: ['12, Anna Salai', 'Chennai 600002'],
      gstin: '33ABCDE1234F1Z5',
      attnName: 'Mr. Kumar',
      attnDesignation: 'Director',
    });
    expect(parsed.periodLabel).toBe("For the month of September '26");
    expect(parsed.items).toEqual([
      {
        description: 'Software development services',
        note: null,
        qty: 1,
        rate: 60000,
        amount: 60000,
      },
    ]);
    expect(parsed.subtotal).toBe(60000);
    expect(parsed.advance).toBe(0);
    expect(parsed.grandTotal).toBe(60000);
    expect(parsed.warnings).toEqual([]);
  });

  it('reads Word table rows joined by two spaces and dates in words', () => {
    const parsed = parseInvoiceLines([
      'Bill No: FY25-26/11',
      'Date: 3 March 2026',
      'Sl.No  Description  Qty  Rate  Value',
      '1  Consulting  10  1,500.50  15,005',
      '2  Support  1  ₹2,000  ₹2,000',
      'Total  17,005',
      'Advance  5,000',
      'Grand Total  12,005',
    ]);
    expect(parsed.invoiceDate).toBe('2026-03-03');
    expect(parsed.items.map((item) => item.amount)).toEqual([15005, 2000]);
    expect(parsed.advance).toBe(5000);
    expect(parsed.warnings).toContain('No client ("To,") block found.');
  });

  it('falls back to one line from the total and says so', () => {
    const parsed = parseInvoiceLines(['Bill No: X-1', 'Total: Rs. 25,000']);
    expect(parsed.items).toEqual([
      { description: 'Professional services', note: null, qty: 1, rate: 25000, amount: 25000 },
    ]);
    expect(parsed.warnings[0]).toContain('No item rows');
  });

  it('flags totals that do not add up', () => {
    const parsed = parseInvoiceLines([
      'Sl.No Description Qty Rate Value',
      '1 Work 2 100 250',
      'Total 250',
    ]);
    expect(parsed.warnings.some((warning) => warning.includes('qty × rate'))).toBeTrue();
  });

  it('rejects impossible dates', () => {
    expect(parseInvoiceLines(['Date: 31/02/2026']).invoiceDate).toBeNull();
  });
});
