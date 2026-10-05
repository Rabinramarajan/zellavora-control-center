import {
  InvoiceViewModel,
  ITEM_AREA_ROWS,
  TRAILING_BLANK_ROWS,
  footerText,
} from './invoice.viewmodel';

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Every dynamic value goes through this; the preview iframe also runs without scripts. */
export const escapeHtml = (value: string | number = ''): string =>
  String(value).replace(/[&<>"']/g, (char) => ESCAPES[char]);

const lines = (values: readonly string[]): string => values.map(escapeHtml).join('<br>');

const blankRow = '<tr class="blank"><td></td><td></td><td></td><td></td><td></td></tr>';
const blankRows = (count: number): string => blankRow.repeat(Math.max(0, count));

const stamp = (vm: InvoiceViewModel): string => {
  if (vm.isDraft) return '<div class="watermark">DRAFT</div>';
  if (vm.isCancelled) return '<div class="watermark">CANCELLED</div>';
  return '';
};

const headerRow = (vm: InvoiceViewModel): string => {
  const client = [
    'To,',
    `<b>${escapeHtml(vm.client.name)}</b>`,
    ...vm.client.addressLines.map(escapeHtml),
    ...(vm.client.gstin ? [`<b>GST No: ${escapeHtml(vm.client.gstin)}</b>`] : []),
  ].join('<br>');
  const seller = [
    `<b>Bill No: ${escapeHtml(vm.number ?? 'DRAFT')}</b>`,
    `<b>Date: ${escapeHtml(vm.dateText)}</b>`,
    `<b class="seller">${escapeHtml(vm.seller.name)}</b>`,
    ...vm.seller.addressLines.map(escapeHtml),
    ...(vm.seller.pan ? [`<b>PAN No: ${escapeHtml(vm.seller.pan)}</b>`] : []),
    ...(vm.seller.gstin ? [`<b>GST No: ${escapeHtml(vm.seller.gstin)}</b>`] : []),
  ].join('<br>');
  return `<tr><td colspan="2" class="block">${client}</td><td colspan="3" class="block">${seller}</td></tr>`;
};

const itemRows = (vm: InvoiceViewModel): string =>
  vm.items
    .map(
      (item) => `<tr>
<td class="c">${item.slNo}</td>
<td><b>${escapeHtml(item.description)}</b>${item.note ? `<br>${escapeHtml(item.note)}` : ''}</td>
<td class="c">${escapeHtml(item.qty)}</td>
<td class="c">${escapeHtml(item.rate)}</td>
<td class="c"><b>${escapeHtml(item.value)}</b></td>
</tr>`
    )
    .join('');

const totalRows = (vm: InvoiceViewModel): string => {
  const tax = vm.totals.tax
    ? `<tr><td></td><td colspan="2"></td><td class="r">${escapeHtml(vm.totals.tax.label)}</td><td class="r">${escapeHtml(vm.totals.tax.amount)}</td></tr>`
    : '';
  return `<tr><td></td><td colspan="2"></td><td class="r"><b>Total</b></td><td class="r"><b>${escapeHtml(vm.totals.subtotal)}</b></td></tr>
${tax}<tr><td></td><td colspan="2">Amount In Rupees: ${escapeHtml(vm.amountInWords)}</td><td class="r">Advance</td><td class="r"><b>${escapeHtml(vm.totals.advance)}</b></td></tr>
<tr><td></td><td colspan="2"></td><td class="r"><b>Grand Total</b></td><td class="r"><b>${escapeHtml(vm.totals.grand)}</b></td></tr>`;
};

const bankCell = (vm: InvoiceViewModel): string => {
  if (!vm.bank) return '';
  return [
    '<b>Bank Details</b>',
    `<b>Account Name: ${escapeHtml(vm.bank.accountName)}</b>`,
    `Bank: ${escapeHtml(vm.bank.bank)}`,
    ...(vm.bank.branch ? [`Branch: ${escapeHtml(vm.bank.branch)}`] : []),
    `Account Number: ${escapeHtml(vm.bank.accountNumber)}`,
    `IFSC Code: ${escapeHtml(vm.bank.ifsc)}`,
  ].join('<br>');
};

const termsCell = (vm: InvoiceViewModel): string =>
  vm.terms ? `<b>Terms &amp; Conditions:</b><br>${lines(vm.terms.split(/\r?\n/))}` : '';

/**
 * The bill as one bordered grid, matching the paper template: party blocks,
 * Attn, five item columns padded with blank rows, totals, then bank and terms.
 * Used for the preview, the browser's print, and as the layout PDF and Word follow.
 */
export const renderInvoiceHtml = (vm: InvoiceViewModel): string => {
  const footer = footerText(vm);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice ${escapeHtml(vm.number ?? 'Draft')}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: #fff; }
  body { font: 10.5pt/1.25 Arial, "Helvetica Neue", Helvetica, sans-serif; color: #000; }
  .page { width: 210mm; min-height: 297mm; padding: 30mm 15mm 15mm; margin: 0 auto; position: relative; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td { border: 1px solid #000; padding: 6px 7px; vertical-align: middle; }
  td.block { vertical-align: top; padding-top: 4px; padding-bottom: 6px; }
  tr.blank td, tr.spacer td { height: 34px; }
  .c { text-align: center; }
  .r { text-align: right; }
  thead td { font-weight: 700; }
  .seller { font-size: 11.5pt; }
  .watermark { position: absolute; top: 40%; left: 12%; font-size: 96px; font-weight: 700;
    color: rgba(0, 0, 0, 0.07); transform: rotate(-25deg); pointer-events: none; }
  tr { break-inside: avoid; }
</style></head><body><div class="page">
${stamp(vm)}
<table>
  <colgroup><col style="width:8.3%"><col style="width:43.6%"><col style="width:14.8%"><col style="width:16.6%"><col style="width:16.7%"></colgroup>
  <tbody>
    ${headerRow(vm)}
    <tr><td colspan="2"><b>${vm.client.attn ? `Attn: ${escapeHtml(vm.client.attn)}` : '&nbsp;'}</b></td><td colspan="3"></td></tr>
    <tr><td class="c"><b>Sl.No</b></td><td><b>Description Of Service</b></td><td class="c"><b>Qty</b></td><td class="c"><b>Rate</b></td><td class="c"><b>Value</b></td></tr>
    ${itemRows(vm)}
    ${blankRows(ITEM_AREA_ROWS - vm.items.length)}
    <tr class="spacer"><td></td><td><b>${escapeHtml(vm.periodLabel ?? '')}</b></td><td></td><td></td><td></td></tr>
    ${blankRow}
    ${totalRows(vm)}
    ${blankRows(TRAILING_BLANK_ROWS)}
    <tr><td></td><td colspan="4" class="r">${escapeHtml(footer)}</td></tr>
    <tr><td></td><td class="block">${bankCell(vm)}</td><td colspan="3" class="block">${termsCell(vm)}</td></tr>
  </tbody>
</table>
</div></body></html>`;
};
