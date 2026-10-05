import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { requestContext } from '../daily-sheets/sheets.shared';
import JSZip from 'jszip';
import {
  BulkExportSchema,
  CancelInvoiceSchema,
  parse,
  ExportQuerySchema,
  FromMonthlySheetSchema,
  ImportInvoiceSchema,
  InvoiceClientSchema,
  InvoiceQuerySchema,
  MarkPaidSchema,
  RegisterQuerySchema,
  SaveInvoiceSchema,
  UpsertInvoiceProfileSchema,
} from './invoices.dto';
import { InvoiceActor, InvoicesService } from './invoices.service';
import { buildInvoiceViewModel, invoiceFileName } from './render/invoice.viewmodel';
import { renderInvoiceHtml } from './render/invoice.html';
import { renderInvoicePdf } from './render/invoice.pdf';
import { renderInvoiceDocx } from './render/invoice.docx';

const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const actorOf = (req: AuthRequest): InvoiceActor => requestContext(req);

const attachment = (res: Response, type: string, fileName: string): Response =>
  res.set({
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Cache-Control': 'no-store',
  });

export class InvoicesController {
  private readonly service = new InvoicesService();

  public async getProfile(req: AuthRequest, res: Response): Promise<void> {
    res.json({ success: true, data: await this.service.getProfile(actorOf(req)) });
  }

  public async upsertProfile(req: AuthRequest, res: Response): Promise<void> {
    const dto = parse(UpsertInvoiceProfileSchema, req.body);
    res.json({ success: true, data: await this.service.upsertProfile(dto, actorOf(req)) });
  }

  public async listClients(req: AuthRequest, res: Response): Promise<void> {
    res.json({ success: true, data: await this.service.listClients(actorOf(req)) });
  }

  public async createClient(req: AuthRequest, res: Response): Promise<void> {
    const dto = parse(InvoiceClientSchema, req.body);
    res
      .status(201)
      .json({ success: true, data: await this.service.createClient(dto, actorOf(req)) });
  }

  public async updateClient(req: AuthRequest, res: Response): Promise<void> {
    const dto = parse(InvoiceClientSchema, req.body);
    res.json({
      success: true,
      data: await this.service.updateClient(req.params.id, dto, actorOf(req)),
    });
  }

  public async deleteClient(req: AuthRequest, res: Response): Promise<void> {
    res.json({ success: true, data: await this.service.deleteClient(req.params.id, actorOf(req)) });
  }

  public async list(req: AuthRequest, res: Response): Promise<void> {
    const query = parse(InvoiceQuerySchema, req.query);
    res.json({ success: true, data: await this.service.list(query, actorOf(req)) });
  }

  public async get(req: AuthRequest, res: Response): Promise<void> {
    res.json({ success: true, data: await this.service.get(req.params.id, actorOf(req)) });
  }

  public async create(req: AuthRequest, res: Response): Promise<void> {
    const dto = parse(SaveInvoiceSchema, req.body);
    res.status(201).json({ success: true, data: await this.service.create(dto, actorOf(req)) });
  }

  public async update(req: AuthRequest, res: Response): Promise<void> {
    const dto = parse(SaveInvoiceSchema, req.body);
    res.json({ success: true, data: await this.service.update(req.params.id, dto, actorOf(req)) });
  }

  public async delete(req: AuthRequest, res: Response): Promise<void> {
    res.json({ success: true, data: await this.service.delete(req.params.id, actorOf(req)) });
  }

  public async fromMonthlySheet(req: AuthRequest, res: Response): Promise<void> {
    const dto = parse(FromMonthlySheetSchema, req.body);
    const invoice = await this.service.fromMonthlySheet(req.params.sheetId, dto, actorOf(req));
    res.status(201).json({ success: true, data: invoice });
  }

  public async issue(req: AuthRequest, res: Response): Promise<void> {
    res.json({ success: true, data: await this.service.issue(req.params.id, actorOf(req)) });
  }

  public async import(req: AuthRequest, res: Response): Promise<void> {
    const dto = parse(ImportInvoiceSchema, req.body);
    res.status(201).json({ success: true, data: await this.service.import(dto, actorOf(req)) });
  }

  public async markPaid(req: AuthRequest, res: Response): Promise<void> {
    const dto = parse(MarkPaidSchema, req.body ?? {});
    res.json({
      success: true,
      data: await this.service.markPaid(req.params.id, dto, actorOf(req)),
    });
  }

  public async cancel(req: AuthRequest, res: Response): Promise<void> {
    const dto = parse(CancelInvoiceSchema, req.body);
    res.json({ success: true, data: await this.service.cancel(req.params.id, dto, actorOf(req)) });
  }

  public async export(req: AuthRequest, res: Response): Promise<void> {
    const { format } = parse(ExportQuerySchema, req.query);
    const vm = buildInvoiceViewModel(await this.service.renderSource(req.params.id, actorOf(req)));
    const base = invoiceFileName(vm);

    switch (format) {
      case 'html':
        res.set('Cache-Control', 'no-store').type('html').send(renderInvoiceHtml(vm));
        return;
      case 'pdf':
        attachment(res, 'application/pdf', `${base}.pdf`).send(await renderInvoicePdf(vm));
        return;
      case 'docx':
        attachment(res, DOCX_TYPE, `${base}.docx`).send(await renderInvoiceDocx(vm));
        return;
      case 'json':
        res.set('Cache-Control', 'no-store').json({ success: true, data: vm });
        return;
    }
  }

  /**
   * PDFs are rendered one at a time to keep memory flat. Ids the caller does
   * not own fail the whole request as 404, like a single export would.
   */
  public async bulk(req: AuthRequest, res: Response): Promise<void> {
    const { ids } = parse(BulkExportSchema, req.body);
    const actor = actorOf(req);
    const zip = new JSZip();
    const used = new Set<string>();

    for (const id of new Set(ids)) {
      const vm = buildInvoiceViewModel(await this.service.renderSource(id, actor));
      let name = invoiceFileName(vm);
      // Several drafts share a date, so their names would collide.
      for (let n = 2; used.has(name); n++) name = `${invoiceFileName(vm)}_${n}`;
      used.add(name);
      zip.file(`${name}.pdf`, await renderInvoicePdf(vm));
    }

    const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const today = new Date().toISOString().slice(0, 10);
    attachment(res, 'application/zip', `Invoices_${today}.zip`).send(archive);
  }

  public async register(req: AuthRequest, res: Response): Promise<void> {
    const query = parse(RegisterQuerySchema, req.query);
    const csv = await this.service.register(query, actorOf(req));
    const today = new Date().toISOString().slice(0, 10);
    // The BOM lets Excel read the file as UTF-8.
    attachment(res, 'text/csv; charset=utf-8', `Invoice_Register_${today}.csv`).send(`﻿${csv}`);
  }
}
