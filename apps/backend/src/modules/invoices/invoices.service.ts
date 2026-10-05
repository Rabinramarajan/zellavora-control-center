import { InvoiceProfile, InvoiceClient, Prisma } from '@prisma/client';
import { prisma, type TxClient } from '../../infrastructure/prisma';
import { AuditService } from '../../infrastructure/audit';
import { AppError } from '../../middleware/error';
import { EncryptionService } from '../../services/auth/encryption.service';
import { Paged } from '../daily-sheets/sheets.shared';
import {
  CancelInvoiceDTO,
  FromMonthlySheetDTO,
  ImportInvoiceDTO,
  InvoiceClientDTO,
  InvoiceQueryDTO,
  MarkPaidDTO,
  RegisterQueryDTO,
  SaveInvoiceDTO,
  UpsertInvoiceProfileDTO,
} from './invoices.dto';
import {
  addDays,
  amountInWordsINR,
  assertDraft,
  computeTotals,
  financialYearLabel,
  formatInvoiceNumber,
  parseInvoiceNumber,
  monthPeriodLabel,
  parseDateKey,
  Totals,
} from './invoices.rules';
import {
  BankSnapshot,
  ClientSnapshot,
  InvoiceRenderSource,
  SellerSnapshot,
  splitLines,
} from './render/invoice.viewmodel';

/** Invoices belong to one person: every query is scoped to the caller and tenant. */
export interface InvoiceActor {
  userId: string;
  organizationId: string;
}

const invoiceInclude = {
  items: { orderBy: { slNo: 'asc' } },
  client: { select: { id: true, name: true } },
} satisfies Prisma.InvoiceInclude;

type InvoiceRecord = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export interface InvoiceItemView {
  id: string;
  slNo: number;
  description: string;
  note: string | null;
  qty: number;
  rate: number;
  amount: number;
}

export interface InvoiceView {
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
  status: string;
  terms: string | null;
  footerNote: string | null;
  issuedAt: Date | null;
  paidAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  items: InvoiceItemView[];
  createdAt: Date;
  updatedAt: Date;
}

/** The profile as the settings screen sees it: the account number only masked. */
export interface InvoiceProfileView extends Omit<InvoiceProfile, 'bankAccountNumberEnc'> {
  bankAccountNumberMasked: string;
}

const dateKey = (date: Date): string => date.toISOString().slice(0, 10);

const maskAccount = (encrypted: string): string => {
  const plain = EncryptionService.decrypt(encrypted);
  return `${'•'.repeat(Math.max(plain.length - 4, 0))}${plain.slice(-4)}`;
};

const toView = (invoice: InvoiceRecord): InvoiceView => ({
  id: invoice.id,
  clientId: invoice.clientId,
  clientName:
    (invoice.clientSnapshot as unknown as ClientSnapshot | null)?.name ?? invoice.client.name,
  monthlySheetId: invoice.monthlySheetId,
  invoiceNumber: invoice.invoiceNumber,
  invoiceDate: dateKey(invoice.invoiceDate),
  dueDate: invoice.dueDate ? dateKey(invoice.dueDate) : null,
  periodLabel: invoice.periodLabel,
  currency: invoice.currency,
  subtotal: invoice.subtotal.toNumber(),
  taxRate: invoice.taxRate.toNumber(),
  taxAmount: invoice.taxAmount.toNumber(),
  advance: invoice.advance.toNumber(),
  grandTotal: invoice.grandTotal.toNumber(),
  amountInWords: invoice.amountInWords,
  status: invoice.status,
  terms: invoice.terms,
  footerNote: invoice.footerNote,
  issuedAt: invoice.issuedAt,
  paidAt: invoice.paidAt,
  cancelledAt: invoice.cancelledAt,
  cancelReason: invoice.cancelReason,
  items: invoice.items.map((item) => ({
    id: item.id,
    slNo: item.slNo,
    description: item.description,
    note: item.note,
    qty: item.qty.toNumber(),
    rate: item.rate.toNumber(),
    amount: item.amount.toNumber(),
  })),
  createdAt: invoice.createdAt,
  updatedAt: invoice.updatedAt,
});

const sellerOf = (profile: InvoiceProfile): SellerSnapshot => ({
  name: profile.legalName,
  addressLines: splitLines(profile.addressLines),
  pan: profile.pan,
  gstin: profile.gstin,
  email: profile.email,
  phone: profile.phone,
});

const clientOf = (client: InvoiceClient): ClientSnapshot => ({
  name: client.name,
  addressLines: splitLines(client.addressLines),
  gstin: client.gstin,
  attnName: client.attnName,
  attnDesignation: client.attnDesignation,
});

const bankOf = (profile: InvoiceProfile): BankSnapshot => ({
  accountName: profile.bankAccountName,
  bank: profile.bankName,
  branch: profile.bankBranch,
  accountNumber: EncryptionService.decrypt(profile.bankAccountNumberEnc),
  ifsc: profile.ifsc,
});

/** Line amounts, totals and words, recomputed on the server whatever the client sent. */
interface Priced {
  totals: Totals;
  items: Prisma.InvoiceItemCreateWithoutInvoiceInput[];
  money: {
    subtotal: Prisma.Decimal;
    taxRate: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    advance: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
    amountInWords: string;
  };
}

const priced = (dto: Pick<SaveInvoiceDTO, 'items' | 'taxRate' | 'advance'>): Priced => {
  const totals = computeTotals(dto.items, dto.taxRate, dto.advance);
  return {
    totals,
    items: dto.items.map((item, index) => ({
      slNo: index + 1,
      description: item.description,
      note: item.note,
      qty: new Prisma.Decimal(item.qty),
      rate: new Prisma.Decimal(item.rate),
      amount: totals.lines[index],
    })),
    money: {
      subtotal: totals.subtotal,
      taxRate: new Prisma.Decimal(dto.taxRate),
      taxAmount: totals.taxAmount,
      advance: new Prisma.Decimal(dto.advance),
      grandTotal: totals.grandTotal,
      amountInWords: amountInWordsINR(totals.grandTotal),
    },
  };
};

const csvCell = (value: string | number | null): string => {
  const text = value === null ? '' : String(value);
  // A leading formula character would run as a formula when opened in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export class InvoicesService {
  // ── Profile ────────────────────────────────────────────────────────────

  public async getProfile(actor: InvoiceActor): Promise<InvoiceProfileView | null> {
    const profile = await prisma.invoiceProfile.findUnique({
      where: {
        organizationId_userId: { organizationId: actor.organizationId, userId: actor.userId },
      },
    });
    return profile ? this.presentProfile(profile) : null;
  }

  public async upsertProfile(
    dto: UpsertInvoiceProfileDTO,
    actor: InvoiceActor
  ): Promise<InvoiceProfileView> {
    const where = {
      organizationId_userId: { organizationId: actor.organizationId, userId: actor.userId },
    };
    const existing = await prisma.invoiceProfile.findUnique({ where, select: { id: true } });
    if (!existing && !dto.bankAccountNumber) {
      throw new AppError('bankAccountNumber: required', 400, 'VALIDATION_ERROR', {
        fields: [{ path: 'bankAccountNumber', message: 'required' }],
      });
    }

    const { bankAccountNumber, ...fields } = dto;
    const encrypted = bankAccountNumber ? EncryptionService.encrypt(bankAccountNumber) : undefined;

    const profile = existing
      ? await prisma.invoiceProfile.update({
          where,
          data: {
            ...fields,
            ...(encrypted ? { bankAccountNumberEnc: encrypted } : {}),
            updatedBy: actor.userId,
          },
        })
      : await prisma.invoiceProfile.create({
          data: {
            ...fields,
            bankAccountNumberEnc: encrypted as string,
            organizationId: actor.organizationId,
            userId: actor.userId,
            createdBy: actor.userId,
          },
        });
    return this.presentProfile(profile);
  }

  // ── Clients ────────────────────────────────────────────────────────────

  public listClients(actor: InvoiceActor): Promise<InvoiceClient[]> {
    return prisma.invoiceClient.findMany({
      where: { ...this.owned(actor), deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  public createClient(dto: InvoiceClientDTO, actor: InvoiceActor): Promise<InvoiceClient> {
    return prisma.invoiceClient.create({
      data: { ...dto, ...this.owned(actor), createdBy: actor.userId },
    });
  }

  public async updateClient(
    id: string,
    dto: InvoiceClientDTO,
    actor: InvoiceActor
  ): Promise<InvoiceClient> {
    await this.findClient(id, actor);
    return prisma.invoiceClient.update({
      where: { id },
      data: { ...dto, updatedBy: actor.userId },
    });
  }

  /** Soft delete: issued invoices keep their snapshot, and drafts still resolve the name. */
  public async deleteClient(id: string, actor: InvoiceActor): Promise<{ id: string }> {
    await this.findClient(id, actor);
    await prisma.invoiceClient.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actor.userId },
    });
    return { id };
  }

  // ── Invoices ───────────────────────────────────────────────────────────

  public async list(query: InvoiceQueryDTO, actor: InvoiceActor): Promise<Paged<InvoiceView>> {
    const where = this.listWhere(query, actor);
    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: invoiceInclude,
        orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);
    return {
      data: rows.map(toView),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  public async get(id: string, actor: InvoiceActor): Promise<InvoiceView> {
    return toView(await this.find(id, actor));
  }

  public async create(
    dto: SaveInvoiceDTO,
    actor: InvoiceActor,
    monthlySheetId: string | null = null
  ): Promise<InvoiceView> {
    await this.findClient(dto.clientId, actor);
    const { items, money } = priced(dto);
    const invoice = await prisma.invoice.create({
      data: {
        ...this.owned(actor),
        clientId: dto.clientId,
        monthlySheetId,
        invoiceDate: parseDateKey(dto.invoiceDate),
        dueDate: dto.dueDate ? parseDateKey(dto.dueDate) : null,
        periodLabel: dto.periodLabel,
        terms: dto.terms,
        footerNote: dto.footerNote,
        ...money,
        createdBy: actor.userId,
        items: { create: items },
      },
      include: invoiceInclude,
    });
    return toView(invoice);
  }

  public async update(id: string, dto: SaveInvoiceDTO, actor: InvoiceActor): Promise<InvoiceView> {
    const current = await this.find(id, actor);
    assertDraft(current);
    await this.findClient(dto.clientId, actor);
    const { items, money } = priced(dto);

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          clientId: dto.clientId,
          invoiceDate: parseDateKey(dto.invoiceDate),
          dueDate: dto.dueDate ? parseDateKey(dto.dueDate) : null,
          periodLabel: dto.periodLabel,
          terms: dto.terms,
          footerNote: dto.footerNote,
          ...money,
          updatedBy: actor.userId,
          items: { create: items },
        },
        include: invoiceInclude,
      });
    });
    return toView(invoice);
  }

  /**
   * Soft delete a draft or a cancelled invoice. Issued and paid bills must be
   * cancelled first. A cancelled bill's number is released (and kept in the
   * audit log) so a corrected copy can be imported under it again.
   */
  public async delete(id: string, actor: InvoiceActor): Promise<{ id: string }> {
    const invoice = await this.find(id, actor);
    if (invoice.status !== 'DRAFT' && invoice.status !== 'CANCELLED') {
      throw new AppError('Cancel this invoice before deleting it', 409, 'INVOICE_LOCKED');
    }
    const deleted = await prisma.invoice.update({
      where: { id },
      data: { deletedAt: new Date(), invoiceNumber: null, updatedBy: actor.userId },
      include: invoiceInclude,
    });
    if (invoice.status === 'CANCELLED') {
      await this.audit('invoice.deleted', deleted, actor, {
        invoiceNumber: invoice.invoiceNumber,
      });
    }
    return { id };
  }

  /** A draft from a signed-off month: hours × average rate, or the month's amount once. */
  public async fromMonthlySheet(
    sheetId: string,
    dto: FromMonthlySheetDTO,
    actor: InvoiceActor
  ): Promise<InvoiceView> {
    const sheet = await prisma.monthlySheet.findFirst({
      where: { id: sheetId, ...this.owned(actor), deletedAt: null },
    });
    if (!sheet) throw new AppError('Monthly sheet not found', 404, 'SHEET_NOT_FOUND');
    if (sheet.status !== 'approved' && sheet.status !== 'paid') {
      throw new AppError('Only approved or paid months can be invoiced', 409, 'SHEET_NOT_APPROVED');
    }

    const live = await prisma.invoice.findFirst({
      where: { monthlySheetId: sheetId, deletedAt: null, status: { not: 'CANCELLED' } },
      select: { id: true },
    });
    if (live) {
      throw new AppError('This month already has an invoice', 409, 'MONTH_ALREADY_INVOICED', {
        id: live.id,
      });
    }

    const profile = await this.findProfile(actor);

    const item =
      dto.billing === 'hourly'
        ? {
            description: dto.description,
            note: null,
            qty: sheet.totalHours.toNumber(),
            rate: sheet.averageHourlyRate.toNumber(),
          }
        : { description: dto.description, note: null, qty: 1, rate: sheet.totalAmount.toNumber() };
    if (item.qty <= 0) {
      throw new AppError('The month has no billable hours', 422, 'NO_ITEMS');
    }

    const invoiceDate = dto.invoiceDate ?? dateKey(new Date());
    const draft: SaveInvoiceDTO = {
      clientId: dto.clientId,
      invoiceDate,
      dueDate: dateKey(addDays(parseDateKey(invoiceDate), profile?.paymentTermsDays ?? 7)),
      periodLabel: monthPeriodLabel(sheet.year, sheet.month),
      taxRate: 0,
      advance: 0,
      terms: null,
      footerNote: null,
      items: [item],
    };

    try {
      return await this.create(draft, actor, sheetId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError('This month already has an invoice', 409, 'MONTH_ALREADY_INVOICED');
      }
      throw error;
    }
  }

  /**
   * Assign the next number for the invoice date's financial year, freeze the
   * seller, client and bank details, and lock the invoice. Numbering happens
   * here rather than at draft time so deleted drafts leave no gaps.
   */
  public async issue(id: string, actor: InvoiceActor): Promise<InvoiceView> {
    const issued = await prisma.$transaction(async (tx) => {
      const invoice = await this.find(id, actor, tx);
      assertDraft(invoice);
      if (invoice.items.length === 0) {
        throw new AppError('Add at least one item', 422, 'NO_ITEMS');
      }
      const profile = await this.findProfile(actor, tx);
      if (!profile) {
        throw new AppError(
          'Set up your invoice profile and bank details before issuing',
          422,
          'INVOICE_PROFILE_MISSING'
        );
      }
      const client = await tx.invoiceClient.findFirst({
        where: { id: invoice.clientId, ...this.owned(actor) },
      });
      if (!client) throw new AppError('Client not found', 404, 'CLIENT_NOT_FOUND');

      const fyLabel = financialYearLabel(invoice.invoiceDate);
      const sequenceNo = await this.nextSequence(tx, actor, fyLabel);
      const { grandTotal } = computeTotals(invoice.items, invoice.taxRate, invoice.advance);

      return tx.invoice.update({
        where: { id },
        data: {
          status: 'ISSUED',
          issuedAt: new Date(),
          fyLabel,
          sequenceNo,
          invoiceNumber: formatInvoiceNumber(fyLabel, sequenceNo),
          dueDate: invoice.dueDate ?? addDays(invoice.invoiceDate, profile.paymentTermsDays),
          amountInWords: amountInWordsINR(grandTotal),
          sellerSnapshot: sellerOf(profile) as unknown as Prisma.InputJsonValue,
          clientSnapshot: clientOf(client) as unknown as Prisma.InputJsonValue,
          bankSnapshot: bankOf(profile) as unknown as Prisma.InputJsonValue,
          terms: invoice.terms ?? profile.defaultTerms,
          footerNote: invoice.footerNote ?? profile.footerNote,
          updatedBy: actor.userId,
        },
        include: invoiceInclude,
      });
    });

    await this.audit('invoice.issued', issued, actor, { invoiceNumber: issued.invoiceNumber });
    return toView(issued);
  }

  /**
   * Record a bill issued outside the system under its own number. When the
   * number follows the FYxx-yy/NN series, the counter is moved past it so the
   * next issued invoice continues the sequence instead of reusing the number.
   */
  public async import(dto: ImportInvoiceDTO, actor: InvoiceActor): Promise<InvoiceView> {
    const client = await this.findClient(dto.clientId, actor);
    const profile = await this.findProfile(actor);
    if (!profile) {
      throw new AppError(
        'Set up your invoice profile and bank details before importing',
        422,
        'INVOICE_PROFILE_MISSING'
      );
    }
    const invoiceNumber = dto.invoiceNumber.toUpperCase();
    const taken = await prisma.invoice.findFirst({
      where: { ...this.owned(actor), invoiceNumber },
      select: { id: true },
    });
    if (taken) {
      throw new AppError(
        `Bill number ${invoiceNumber} already exists`,
        409,
        'INVOICE_NUMBER_TAKEN',
        {
          id: taken.id,
        }
      );
    }

    const { items, money } = priced(dto);
    const invoiceDate = parseDateKey(dto.invoiceDate);
    const series = parseInvoiceNumber(invoiceNumber);
    const now = new Date();

    try {
      const imported = await prisma.$transaction(async (tx) => {
        if (series) await this.advanceSequence(tx, actor, series.fyLabel, series.sequenceNo);
        return tx.invoice.create({
          data: {
            ...this.owned(actor),
            clientId: dto.clientId,
            invoiceNumber,
            fyLabel: series?.fyLabel ?? financialYearLabel(invoiceDate),
            sequenceNo: series?.sequenceNo ?? null,
            invoiceDate,
            dueDate: dto.dueDate
              ? parseDateKey(dto.dueDate)
              : addDays(invoiceDate, profile.paymentTermsDays),
            periodLabel: dto.periodLabel,
            ...money,
            status: dto.status,
            issuedAt: invoiceDate,
            paidAt: dto.status === 'PAID' ? (dto.paidOn ? parseDateKey(dto.paidOn) : now) : null,
            sellerSnapshot: sellerOf(profile) as unknown as Prisma.InputJsonValue,
            clientSnapshot: clientOf(client) as unknown as Prisma.InputJsonValue,
            bankSnapshot: bankOf(profile) as unknown as Prisma.InputJsonValue,
            terms: dto.terms ?? profile.defaultTerms,
            footerNote: dto.footerNote ?? profile.footerNote,
            createdBy: actor.userId,
            items: { create: items },
          },
          include: invoiceInclude,
        });
      });
      await this.audit('invoice.imported', imported, actor, { invoiceNumber });
      return toView(imported);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(
          `Bill number ${invoiceNumber} already exists`,
          409,
          'INVOICE_NUMBER_TAKEN'
        );
      }
      throw error;
    }
  }

  public async markPaid(id: string, dto: MarkPaidDTO, actor: InvoiceActor): Promise<InvoiceView> {
    const invoice = await this.find(id, actor);
    if (invoice.status !== 'ISSUED') {
      throw new AppError('Only issued invoices can be marked paid', 409, 'INVOICE_NOT_ISSUED');
    }
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        updatedBy: actor.userId,
      },
      include: invoiceInclude,
    });
    await this.audit('invoice.paid', updated, actor);
    return toView(updated);
  }

  /** The number stays used; a correction is a new invoice. */
  public async cancel(
    id: string,
    dto: CancelInvoiceDTO,
    actor: InvoiceActor
  ): Promise<InvoiceView> {
    const invoice = await this.find(id, actor);
    if (invoice.status !== 'ISSUED' && invoice.status !== 'PAID') {
      throw new AppError(
        'Only issued or paid invoices can be cancelled; delete a draft instead',
        409,
        'INVOICE_NOT_ISSUED'
      );
    }
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: dto.reason,
        updatedBy: actor.userId,
      },
      include: invoiceInclude,
    });
    await this.audit('invoice.cancelled', updated, actor, { reason: dto.reason });
    return toView(updated);
  }

  /** Issued invoices render from their snapshots; drafts from the current profile and client. */
  public async renderSource(id: string, actor: InvoiceActor): Promise<InvoiceRenderSource> {
    const invoice = await this.find(id, actor);
    const frozen = invoice.status !== 'DRAFT';

    let seller = invoice.sellerSnapshot as unknown as SellerSnapshot | null;
    let client = invoice.clientSnapshot as unknown as ClientSnapshot | null;
    let bank = invoice.bankSnapshot as unknown as BankSnapshot | null;
    let terms = invoice.terms;
    let footerNote = invoice.footerNote;
    if (!frozen) {
      const profile = await this.findProfile(actor);
      terms ??= profile?.defaultTerms ?? null;
      footerNote ??= profile?.footerNote ?? null;
      const liveClient = await prisma.invoiceClient.findFirst({
        where: { id: invoice.clientId, ...this.owned(actor) },
      });
      seller = profile ? sellerOf(profile) : null;
      bank = profile ? bankOf(profile) : null;
      client = liveClient ? clientOf(liveClient) : null;
    }

    return {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      periodLabel: invoice.periodLabel,
      taxRate: invoice.taxRate,
      taxAmount: invoice.taxAmount,
      subtotal: invoice.subtotal,
      advance: invoice.advance,
      grandTotal: invoice.grandTotal,
      amountInWords: invoice.amountInWords,
      terms,
      footerNote,
      items: invoice.items,
      seller,
      client: client ?? {
        name: invoice.client.name,
        addressLines: [],
        gstin: null,
        attnName: null,
        attnDesignation: null,
      },
      bank,
    };
  }

  /** CSV register of invoices matching the filters, newest first. */
  public async register(query: RegisterQueryDTO, actor: InvoiceActor): Promise<string> {
    const rows = await prisma.invoice.findMany({
      where: this.listWhere(query, actor),
      include: invoiceInclude,
      orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
      take: 5000,
    });
    const header = [
      'Bill No',
      'Date',
      'Due Date',
      'Client',
      'Period',
      'Subtotal',
      'Tax',
      'Advance',
      'Grand Total',
      'Status',
      'Paid At',
    ];
    const lines = rows
      .map(toView)
      .map((row) =>
        [
          row.invoiceNumber,
          row.invoiceDate,
          row.dueDate,
          row.clientName,
          row.periodLabel,
          row.subtotal.toFixed(2),
          row.taxAmount.toFixed(2),
          row.advance.toFixed(2),
          row.grandTotal.toFixed(2),
          row.status,
          row.paidAt ? row.paidAt.toISOString().slice(0, 10) : null,
        ]
          .map(csvCell)
          .join(',')
      );
    return [header.join(','), ...lines].join('\r\n');
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private owned(actor: InvoiceActor): { organizationId: string; userId: string } {
    return { organizationId: actor.organizationId, userId: actor.userId };
  }

  private listWhere(
    query: Pick<InvoiceQueryDTO, 'status' | 'clientId' | 'from' | 'to'>,
    actor: InvoiceActor
  ): Prisma.InvoiceWhereInput {
    return {
      ...this.owned(actor),
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.from || query.to
        ? {
            invoiceDate: {
              ...(query.from ? { gte: parseDateKey(query.from) } : {}),
              ...(query.to ? { lte: parseDateKey(query.to) } : {}),
            },
          }
        : {}),
    };
  }

  /** Another person's invoice reads as missing, so ids cannot be probed. */
  private async find(
    id: string,
    actor: InvoiceActor,
    tx: TxClient = prisma
  ): Promise<InvoiceRecord> {
    const invoice = await tx.invoice.findFirst({
      where: { id, ...this.owned(actor), deletedAt: null },
      include: invoiceInclude,
    });
    if (!invoice) throw new AppError('Invoice not found', 404, 'INVOICE_NOT_FOUND');
    return invoice;
  }

  private async findClient(id: string, actor: InvoiceActor): Promise<InvoiceClient> {
    const client = await prisma.invoiceClient.findFirst({
      where: { id, ...this.owned(actor), deletedAt: null },
    });
    if (!client) throw new AppError('Client not found', 404, 'CLIENT_NOT_FOUND');
    return client;
  }

  private findProfile(actor: InvoiceActor, tx: TxClient = prisma): Promise<InvoiceProfile | null> {
    return tx.invoiceProfile.findUnique({
      where: {
        organizationId_userId: { organizationId: actor.organizationId, userId: actor.userId },
      },
    });
  }

  /**
   * One statement that creates or bumps the counter. Postgres takes a row lock
   * on conflict, so parallel issues get distinct numbers and the first issue
   * of a year cannot race into a duplicate-key error.
   */
  private async nextSequence(tx: TxClient, actor: InvoiceActor, fyLabel: string): Promise<number> {
    const [row] = await tx.$queryRaw<{ last_number: number }[]>`
      INSERT INTO "invoice_sequences" ("id", "organization_id", "user_id", "fy_label", "last_number", "updated_at")
      VALUES (gen_random_uuid(), ${actor.organizationId}::uuid, ${actor.userId}::uuid, ${fyLabel}, 1, now())
      ON CONFLICT ("organization_id", "user_id", "fy_label")
      DO UPDATE SET "last_number" = "invoice_sequences"."last_number" + 1, "updated_at" = now()
      RETURNING "last_number"`;
    return Number(row.last_number);
  }

  /** Move the counter up to an imported number; never down, so issued numbers stay unique. */
  private async advanceSequence(
    tx: TxClient,
    actor: InvoiceActor,
    fyLabel: string,
    sequenceNo: number
  ): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO "invoice_sequences" ("id", "organization_id", "user_id", "fy_label", "last_number", "updated_at")
      VALUES (gen_random_uuid(), ${actor.organizationId}::uuid, ${actor.userId}::uuid, ${fyLabel}, ${sequenceNo}, now())
      ON CONFLICT ("organization_id", "user_id", "fy_label")
      DO UPDATE SET "last_number" = GREATEST("invoice_sequences"."last_number", ${sequenceNo}), "updated_at" = now()`;
  }

  private presentProfile(profile: InvoiceProfile): InvoiceProfileView {
    const { bankAccountNumberEnc, ...rest } = profile;
    return { ...rest, bankAccountNumberMasked: maskAccount(bankAccountNumberEnc) };
  }

  private audit(
    action: string,
    invoice: InvoiceRecord,
    actor: InvoiceActor,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    return AuditService.log({
      action,
      resource: 'invoice',
      resourceId: invoice.id,
      organizationId: actor.organizationId,
      actorId: actor.userId,
      metadata: { status: invoice.status, ...metadata },
    });
  }
}
