import { InvoiceViewModel } from './invoice.viewmodel';

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

const optionalLine = (label: string, value: string | undefined): string =>
  value ? `<br>${label}: ${escapeHtml(value)}` : '';

const stamp = (vm: InvoiceViewModel): string => {
  if (vm.isDraft) return '<div class="watermark">DRAFT</div>';
  if (vm.isCancelled) return '<div class="watermark">CANCELLED</div>';
  return '';
};

const itemRows = (vm: InvoiceViewModel): string =>
  vm.items
    .map((item) => {
      const period =
        vm.periodLabel && item.slNo === 1
          ? `<br><span class="muted">${escapeHtml(vm.periodLabel)}</span>`
          : '';
      const note = item.note ? `<br><span class="muted">${escapeHtml(item.note)}</span>` : '';
      return `<tr><td>${item.slNo}</td><td>${escapeHtml(item.description)}${note}${period}</td>
<td class="num">${escapeHtml(item.qty)}</td><td class="num">${escapeHtml(item.rate)}</td><td class="num">${escapeHtml(item.value)}</td></tr>`;
    })
    .join('');

const bankBox = (vm: InvoiceViewModel): string => {
  if (!vm.bank) return '';
  return `<div class="box"><strong>Bank Details</strong><br>
Account Name: ${escapeHtml(vm.bank.accountName)}<br>Bank: ${escapeHtml(vm.bank.bank)}${optionalLine('Branch', vm.bank.branch)}<br>
Account Number: ${escapeHtml(vm.bank.accountNumber)}<br>IFSC Code: ${escapeHtml(vm.bank.ifsc)}</div>`;
};

/** One A4 page used for the preview, the browser's print and as the reference layout for PDF and Word. */
export const renderInvoiceHtml = (vm: InvoiceViewModel): string => `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice ${escapeHtml(vm.number ?? 'Draft')}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html { background: #fff; }
  body { margin: 0; font: 12px/1.5 "Helvetica Neue", Arial, sans-serif; color: #111; background: #fff; }
  .page { width: 210mm; min-height: 297mm; padding: 16mm 15mm; position: relative; margin: 0 auto; }
  .row { display: flex; justify-content: space-between; gap: 12mm; }
  .muted { color: #555; }
  .right { text-align: right; }
  h4 { margin: 0 0 2px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8mm; }
  th, td { border: 1px solid #222; padding: 6px 8px; vertical-align: top; }
  th { background: #f2f2f2; text-align: left; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .totals { margin-left: auto; width: 70mm; margin-top: 4mm; }
  .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
  .grand { border-top: 1px solid #222; font-weight: 700; }
  .box { margin-top: 8mm; border: 1px solid #222; padding: 8px 10px; }
  .watermark { position: absolute; top: 40%; left: 15%; font-size: 90px; font-weight: 700;
    color: rgba(0, 0, 0, 0.07); transform: rotate(-25deg); pointer-events: none; }
  tr, .box { break-inside: avoid; }
  @media print { th { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head><body><div class="page">
${stamp(vm)}
<div class="row">
  <div><h4>To,</h4>${escapeHtml(vm.client.name)}<br>${lines(vm.client.addressLines)}${optionalLine('GST No', vm.client.gstin)}</div>
  <div class="right"><strong>Bill No:</strong> ${escapeHtml(vm.number ?? 'DRAFT')}<br><strong>Date:</strong> ${escapeHtml(vm.dateText)}${
    vm.dueDateText ? `<br><strong>Due:</strong> ${escapeHtml(vm.dueDateText)}` : ''
  }</div>
</div>
<div style="margin-top:6mm"><strong>${escapeHtml(vm.seller.name)}</strong><br>${lines(vm.seller.addressLines)}${optionalLine('PAN No', vm.seller.pan)}${optionalLine('GST No', vm.seller.gstin)}${optionalLine('Attn', vm.client.attn)}</div>
<table>
  <thead><tr><th style="width:12mm">Sl.No</th><th>Description Of Service</th>
  <th class="num" style="width:16mm">Qty</th><th class="num" style="width:26mm">Rate</th>
  <th class="num" style="width:28mm">Value</th></tr></thead>
  <tbody>${itemRows(vm)}</tbody>
</table>
<div class="totals">
  <div><span>Total</span><span>${escapeHtml(vm.totals.subtotal)}</span></div>
  ${vm.totals.tax ? `<div><span>${escapeHtml(vm.totals.tax.label)}</span><span>${escapeHtml(vm.totals.tax.amount)}</span></div>` : ''}
  <div><span>Advance</span><span>${escapeHtml(vm.totals.advance)}</span></div>
  <div class="grand"><span>Grand Total</span><span>${escapeHtml(vm.totals.grand)}</span></div>
</div>
<p><strong>Amount In Rupees:</strong> ${escapeHtml(vm.amountInWords)}</p>
${vm.footerNote ? `<p class="muted">${escapeHtml(vm.footerNote)}</p>` : ''}
${bankBox(vm)}
${vm.terms ? `<div class="box"><strong>Terms &amp; Conditions:</strong><br>${lines(vm.terms.split(/\r?\n/))}</div>` : ''}
</div></body></html>`;
