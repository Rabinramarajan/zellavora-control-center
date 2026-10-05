export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';

export interface InvoiceProfile {
  id: string;
  legalName: string;
  addressLines: string;
  pan: string | null;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  bankAccountName: string;
  bankName: string;
  bankBranch: string | null;
  /** Only the last four digits are ever sent back. */
  bankAccountNumberMasked: string;
  ifsc: string;
  paymentTermsDays: number;
  defaultTerms: string | null;
  footerNote: string | null;
}

export interface InvoiceProfileInput {
  legalName: string;
  addressLines: string;
  pan: string | null;
  gstin: string | null;
  email: string | null;
  phone: string | null;
  bankAccountName: string;
  bankName: string;
  bankBranch: string | null;
  /** Omit to keep the stored number. */
  bankAccountNumber?: string;
  ifsc: string;
  paymentTermsDays: number;
  defaultTerms: string | null;
  footerNote: string | null;
}

export interface InvoiceClient {
  id: string;
  name: string;
  addressLines: string;
  gstin: string | null;
  attnName: string | null;
  attnDesignation: string | null;
  email: string | null;
}

export type InvoiceClientInput = Omit<InvoiceClient, 'id'>;

export interface InvoiceItem {
  id?: string;
  slNo?: number;
  description: string;
  note: string | null;
  qty: number;
  rate: number;
  amount?: number;
}

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  monthlySheetId: string | null;
  invoiceNumber: string | null;
  invoiceDate: string;
  dueDate: string | null;
  periodLabel: string | null;
  currency: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  advance: number;
  grandTotal: number;
  amountInWords: string;
  status: InvoiceStatus;
  terms: string | null;
  footerNote: string | null;
  issuedAt: string | null;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceInput {
  clientId: string;
  invoiceDate: string;
  dueDate: string | null;
  periodLabel: string | null;
  taxRate: number;
  advance: number;
  terms: string | null;
  footerNote: string | null;
  items: { description: string; note: string | null; qty: number; rate: number }[];
}

export interface InvoiceQuery {
  status?: InvoiceStatus;
  clientId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface FromMonthlySheetInput {
  clientId: string;
  billing: 'hourly' | 'retainer';
  description: string;
  invoiceDate?: string;
}
