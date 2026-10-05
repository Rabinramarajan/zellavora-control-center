import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ErrorBus } from '../../../../core/error/error-bus';
import { AppDialogService } from '../../../../shared/components/dialog';
import { SheetRequestError } from '../../../freelancer-sheets/sheets.models';
import { DownloadFormat, InvoicesApi, saveBlob } from '../../invoices.api';
import { Invoice } from '../../invoices.models';
import {
  formatDateKey,
  invoiceStatusLabel,
  invoiceStatusPill,
  isOverdue,
} from '../../invoices.presentation';

/**
 * The server renders the bill; it is shown in an iframe without
 * `allow-scripts`, so nothing in it can run even if escaping ever slipped.
 */
@Component({
  selector: 'app-invoice-preview',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-preview.component.html',
  styleUrls: [
    '../../../freelancer-sheets/styles/sheets-theme.scss',
    '../../styles/invoices.scss',
    './invoice-preview.component.scss',
  ],
})
export class InvoicePreviewComponent implements OnInit {
  private readonly api = inject(InvoicesApi);
  private readonly bus = inject(ErrorBus);
  private readonly dialog = inject(AppDialogService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
  private objectUrl: string | null = null;
  private readonly destroyRef = inject(DestroyRef);

  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly src = signal<SafeResourceUrl | null>(null);
  protected readonly busy = signal(false);

  protected readonly statusLabel = invoiceStatusLabel;
  protected readonly statusPill = invoiceStatusPill;
  protected readonly isOverdue = isOverdue;
  protected readonly date = formatDateKey;

  public constructor() {
    this.destroyRef.onDestroy(() => this.revoke());
  }

  public ngOnInit(): void {
    // Re-render when navigating between invoices without leaving the page.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id) void this.load(id);
    });
  }

  protected print(): void {
    const view = this.frame()?.nativeElement.contentWindow;
    view?.focus();
    view?.print();
  }

  protected async download(format: DownloadFormat): Promise<void> {
    const invoice = this.invoice();
    if (!invoice) return;
    this.busy.set(true);
    try {
      saveBlob(await this.api.download(invoice.id, format), `invoice.${format}`);
    } catch (error) {
      this.report(error);
    } finally {
      this.busy.set(false);
    }
  }

  protected async issue(): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog.confirm({
        title: 'Issue this invoice?',
        message:
          'It gets the next bill number and is locked. Corrections afterwards mean cancelling and issuing a new one.',
        confirmText: 'Issue',
      })
    );
    if (ok) await this.act((id) => this.api.issue(id), 'Invoice issued');
  }

  protected async markPaid(): Promise<void> {
    await this.act((id) => this.api.markPaid(id), 'Marked as paid');
  }

  protected async cancel(): Promise<void> {
    const reason = await firstValueFrom(
      this.dialog.prompt({
        title: 'Cancel this invoice?',
        message: 'The bill number stays used. Issue a new invoice for any correction.',
        label: 'Reason',
        required: true,
        confirmText: 'Cancel invoice',
        variant: 'danger',
      })
    );
    if (reason) await this.act((id) => this.api.cancel(id, reason), 'Invoice cancelled');
  }

  protected async remove(): Promise<void> {
    const invoice = this.invoice();
    if (!invoice) return;
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
    try {
      await this.api.delete(invoice.id);
      this.bus.push({ kind: 'info', message: 'Invoice deleted', ttl: 3000 });
      await this.router.navigate(['/invoices']);
    } catch (error) {
      this.report(error);
    }
  }

  private async load(id: string): Promise<void> {
    try {
      const [invoice, html] = await Promise.all([this.api.get(id), this.api.previewHtml(id)]);
      this.invoice.set(invoice);
      this.show(html);
    } catch (error) {
      this.report(error);
    }
  }

  private show(html: string): void {
    this.revoke();
    this.objectUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    this.src.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl));
  }

  private revoke(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }

  private async act(call: (id: string) => Promise<Invoice>, message: string): Promise<void> {
    const invoice = this.invoice();
    if (!invoice) return;
    this.busy.set(true);
    try {
      await call(invoice.id);
      this.bus.push({ kind: 'info', message, ttl: 3000 });
      await this.load(invoice.id);
    } catch (error) {
      this.report(error);
    } finally {
      this.busy.set(false);
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
