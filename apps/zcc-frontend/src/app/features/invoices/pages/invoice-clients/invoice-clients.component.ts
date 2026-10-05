import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ErrorBus } from '../../../../core/error/error-bus';
import { AppDialogService } from '../../../../shared/components/dialog';
import { SheetRequestError } from '../../../freelancer-sheets/sheets.models';
import { InvoicesApi } from '../../invoices.api';
import { InvoiceClient, InvoiceClientInput } from '../../invoices.models';

const GSTIN = /^\d{2}[A-Za-z]{5}\d{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]$/;

@Component({
  selector: 'app-invoice-clients',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-clients.component.html',
  styleUrls: ['../../../freelancer-sheets/styles/sheets-theme.scss', '../../styles/invoices.scss'],
})
export class InvoiceClientsComponent implements OnInit {
  private readonly api = inject(InvoicesApi);
  private readonly bus = inject(ErrorBus);
  private readonly dialog = inject(AppDialogService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Shown inside the settings page, without the page header and back link. */
  public readonly embedded = input(false);

  protected readonly clients = signal<InvoiceClient[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  /** `null` = form closed, `''` = adding, otherwise the client being edited. */
  protected readonly editingId = signal<string | null>(null);

  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    addressLines: ['', Validators.required],
    gstin: ['', Validators.pattern(GSTIN)],
    attnName: [''],
    attnDesignation: [''],
    email: ['', Validators.email],
  });

  public async ngOnInit(): Promise<void> {
    try {
      this.clients.set(await this.api.listClients());
    } catch (error) {
      this.report(error);
    } finally {
      this.loading.set(false);
    }
  }

  protected startAdd(): void {
    this.form.reset();
    this.editingId.set('');
  }

  protected startEdit(client: InvoiceClient): void {
    this.form.reset({
      name: client.name,
      addressLines: client.addressLines,
      gstin: client.gstin ?? '',
      attnName: client.attnName ?? '',
      attnDesignation: client.attnDesignation ?? '',
      email: client.email ?? '',
    });
    this.editingId.set(client.id);
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const input: InvoiceClientInput = {
      name: value.name,
      addressLines: value.addressLines,
      gstin: value.gstin || null,
      attnName: value.attnName || null,
      attnDesignation: value.attnDesignation || null,
      email: value.email || null,
    };
    const id = this.editingId();
    this.saving.set(true);
    try {
      const saved = id
        ? await this.api.updateClient(id, input)
        : await this.api.createClient(input);
      this.clients.update((list) =>
        [...list.filter((client) => client.id !== saved.id), saved].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      this.editingId.set(null);
      this.bus.push({ kind: 'info', message: 'Company saved', ttl: 3000 });
    } catch (error) {
      this.report(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(client: InvoiceClient): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog.confirm({
        title: `Remove ${client.name}?`,
        message: 'Issued invoices keep the client details printed on them.',
        confirmText: 'Remove',
        variant: 'danger',
      })
    );
    if (!ok) return;
    try {
      await this.api.deleteClient(client.id);
      this.clients.update((list) => list.filter((item) => item.id !== client.id));
    } catch (error) {
      this.report(error);
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
