import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ErrorBus } from '../../../../core/error/error-bus';
import { AppDialogService } from '../../../../shared/components/dialog';
import { SheetRequestError } from '../../../freelancer-sheets/sheets.models';
import { InvoicesApi, saveBlob } from '../../invoices.api';
import { Invoice, InvoiceClient, InvoiceQuery, InvoiceStatus } from '../../invoices.models';
import {
  formatDateKey,
  formatRupees,
  invoiceStatusLabel,
  invoiceStatusPill,
  isOverdue,
} from '../../invoices.presentation';

const STATUS_FILTERS: { value: InvoiceStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'Drafts' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'PAID', label: 'Paid' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-list.component.html',
  styleUrls: ['../../../freelancer-sheets/styles/sheets-theme.scss', '../../styles/invoices.scss'],
})
export class InvoiceListComponent implements OnInit {
  private readonly api = inject(InvoicesApi);
  private readonly bus = inject(ErrorBus);
  private readonly dialog = inject(AppDialogService);

  protected readonly statusFilters = STATUS_FILTERS;
  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly clients = signal<InvoiceClient[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly totalPages = signal(1);
  protected readonly loading = signal(true);
  protected readonly busyId = signal<string | null>(null);
  /** Selection for the ZIP export; cleared whenever the page of rows changes. */
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly zipping = signal(false);
  protected readonly allSelected = computed(
    () => this.invoices().length > 0 && this.invoices().every((inv) => this.selected().has(inv.id))
  );

  protected status: InvoiceStatus | '' = '';
  protected clientId = '';
  protected from = '';
  protected to = '';

  protected readonly statusLabel = invoiceStatusLabel;
  protected readonly statusPill = invoiceStatusPill;
  protected readonly isOverdue = isOverdue;
  protected readonly rupees = formatRupees;
  protected readonly date = formatDateKey;

  public async ngOnInit(): Promise<void> {
    void this.api
      .listClients()
      .then((clients) => this.clients.set(clients))
      .catch(() => undefined);
    await this.load();
  }

  protected setStatus(value: InvoiceStatus | ''): void {
    this.status = value;
    void this.load(1);
  }

  protected applyFilters(): void {
    void this.load(1);
  }

  protected async load(page = this.page()): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.api.list({ ...this.query(), page, pageSize: 25 });
      this.invoices.set(result.data);
      this.selected.set(new Set());
      this.total.set(result.total);
      this.page.set(result.page);
      this.totalPages.set(result.totalPages);
    } catch (error) {
      this.report(error);
    } finally {
      this.loading.set(false);
    }
  }

  protected toggle(id: string): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected toggleAll(): void {
    this.selected.set(
      this.allSelected() ? new Set() : new Set(this.invoices().map((inv) => inv.id))
    );
  }

  protected async downloadZip(): Promise<void> {
    this.zipping.set(true);
    try {
      saveBlob(await this.api.bulkPdf([...this.selected()]), 'Invoices.zip');
    } catch (error) {
      this.report(error);
    } finally {
      this.zipping.set(false);
    }
  }

  protected async issue(invoice: Invoice): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog.confirm({
        title: 'Issue this invoice?',
        message:
          'It gets the next bill number and is locked. Corrections afterwards mean cancelling and issuing a new one.',
        confirmText: 'Issue',
      })
    );
    if (ok) await this.run(invoice, () => this.api.issue(invoice.id), 'Invoice issued');
  }

  protected async markPaid(invoice: Invoice): Promise<void> {
    await this.run(invoice, () => this.api.markPaid(invoice.id), 'Marked as paid');
  }

  protected async cancel(invoice: Invoice): Promise<void> {
    const reason = await firstValueFrom(
      this.dialog.prompt({
        title: `Cancel ${invoice.invoiceNumber ?? 'invoice'}?`,
        message: 'The bill number stays used. Issue a new invoice for any correction.',
        label: 'Reason',
        required: true,
        confirmText: 'Cancel invoice',
        variant: 'danger',
      })
    );
    if (reason)
      await this.run(invoice, () => this.api.cancel(invoice.id, reason), 'Invoice cancelled');
  }

  protected async remove(invoice: Invoice): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog.confirm({
        title:
          invoice.status === 'DRAFT'
            ? 'Delete this draft?'
            : `Delete ${invoice.invoiceNumber ?? 'this invoice'}?`,
        message:
          invoice.status === 'DRAFT'
            ? 'The draft is removed. No bill number was used.'
            : 'The cancelled invoice is removed and its bill number is freed, so a corrected copy can be imported under it.',
        confirmText: 'Delete',
        variant: 'danger',
      })
    );
    if (!ok) return;
    this.busyId.set(invoice.id);
    try {
      await this.api.delete(invoice.id);
      this.bus.push({ kind: 'info', message: 'Invoice deleted', ttl: 3000 });
      await this.load();
    } catch (error) {
      this.report(error);
    } finally {
      this.busyId.set(null);
    }
  }

  protected async exportRegister(): Promise<void> {
    try {
      saveBlob(await this.api.register(this.query()), 'Invoice_Register.csv');
    } catch (error) {
      this.report(error);
    }
  }

  private query(): InvoiceQuery {
    return {
      status: this.status || undefined,
      clientId: this.clientId || undefined,
      from: this.from || undefined,
      to: this.to || undefined,
    };
  }

  private async run(
    invoice: Invoice,
    call: () => Promise<Invoice>,
    message: string
  ): Promise<void> {
    this.busyId.set(invoice.id);
    try {
      const updated = await call();
      this.invoices.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      this.bus.push({ kind: 'info', message, ttl: 3000 });
    } catch (error) {
      this.report(error);
    } finally {
      this.busyId.set(null);
    }
  }

  private report(error: unknown): void {
    const failure = error as SheetRequestError;
    // 0, 403 and 5xx are already toasted by the global error interceptor.
    if (failure.status >= 400 && failure.status < 500 && failure.status !== 403) {
      this.bus.push({ kind: 'error', message: failure.message });
    }
  }
}
