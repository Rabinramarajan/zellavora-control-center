import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { ErrorBus } from '../../../../core/error/error-bus';
import { SheetRequestError } from '../../../freelancer-sheets/sheets.models';
import { InvoicesApi } from '../../invoices.api';
import { Invoice, InvoiceClient, InvoiceInput } from '../../invoices.models';
import { formatRupees, lineValue, todayKey } from '../../invoices.presentation';

type ItemForm = FormGroup<{
  description: FormControl<string>;
  note: FormControl<string>;
  qty: FormControl<number>;
  rate: FormControl<number>;
}>;

const emptyClient = { name: '', addressLines: '', gstin: '', attnName: '', attnDesignation: '' };

/**
 * /invoices/new                         → blank draft
 * /invoices/new?monthlySheetId=…        → draft from an approved month
 * /invoices/:id/edit                    → edit a draft (anything else is read-only)
 */
@Component({
  selector: 'app-invoice-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-form.component.html',
  styleUrls: ['../../../freelancer-sheets/styles/sheets-theme.scss', '../../styles/invoices.scss'],
})
export class InvoiceFormComponent implements OnInit {
  private readonly api = inject(InvoicesApi);
  private readonly bus = inject(ErrorBus);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly clients = signal<InvoiceClient[]>([]);
  protected readonly invoice = signal<Invoice | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly addingClient = signal(false);
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly monthlySheetId = signal<string | null>(null);
  protected readonly rupees = formatRupees;

  protected readonly form = this.fb.group({
    clientId: ['', Validators.required],
    invoiceDate: [todayKey(), Validators.required],
    dueDate: [''],
    periodLabel: [''],
    taxRate: [0, [Validators.min(0), Validators.max(100)]],
    advance: [0, Validators.min(0)],
    terms: [''],
    footerNote: [''],
    items: this.fb.array<ItemForm>([]),
  });

  protected readonly monthForm = this.fb.group({
    clientId: ['', Validators.required],
    billing: this.fb.control<'hourly' | 'retainer'>('retainer'),
    description: ['Professional services', Validators.required],
    invoiceDate: [todayKey(), Validators.required],
  });

  protected readonly clientForm = this.fb.group({
    name: ['', Validators.required],
    addressLines: ['', Validators.required],
    gstin: [''],
    attnName: [''],
    attnDesignation: [''],
  });

  private readonly values = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );

  /** Display-only; the server recomputes and stores the real totals. */
  protected readonly totals = computed(() => {
    const value = this.values();
    const subtotal = (value.items ?? []).reduce(
      (sum, item) => sum + lineValue(item?.qty ?? 0, item?.rate ?? 0),
      0
    );
    const tax = Math.round(subtotal * (Number(value.taxRate) || 0)) / 100;
    const advance = Number(value.advance) || 0;
    return { subtotal, tax, advance, grand: subtotal + tax - advance };
  });

  protected readonly locked = computed(() => {
    const invoice = this.invoice();
    return !!invoice && invoice.status !== 'DRAFT';
  });

  protected get items(): FormArray<ItemForm> {
    return this.form.controls.items;
  }

  protected lineValue(index: number): number {
    const item = this.items.at(index).getRawValue();
    return lineValue(item.qty, item.rate);
  }

  public async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    this.monthlySheetId.set(this.route.snapshot.queryParamMap.get('monthlySheetId'));
    try {
      this.clients.set(await this.api.listClients());
      if (id) {
        this.fill(await this.api.get(id));
      } else {
        this.addItem();
      }
    } catch (error) {
      this.report(error);
    } finally {
      this.loading.set(false);
    }
  }

  protected addItem(): void {
    this.items.push(
      this.fb.group({
        description: ['', [Validators.required, Validators.maxLength(500)]],
        note: [''],
        qty: [1, [Validators.required, Validators.min(0.01)]],
        rate: [0, [Validators.required, Validators.min(0)]],
      })
    );
  }

  protected removeItem(index: number): void {
    if (this.items.length > 1) this.items.removeAt(index);
  }

  protected async saveClient(target: 'form' | 'month'): Promise<void> {
    if (this.clientForm.invalid) {
      this.clientForm.markAllAsTouched();
      return;
    }
    const value = this.clientForm.getRawValue();
    try {
      const client = await this.api.createClient({
        name: value.name,
        addressLines: value.addressLines,
        gstin: value.gstin || null,
        attnName: value.attnName || null,
        attnDesignation: value.attnDesignation || null,
        email: null,
      });
      this.clients.update((list) => [...list, client].sort((a, b) => a.name.localeCompare(b.name)));
      (target === 'form' ? this.form : this.monthForm).controls.clientId.setValue(client.id);
      this.clientForm.reset(emptyClient);
      this.addingClient.set(false);
    } catch (error) {
      this.report(error);
    }
  }

  protected async createFromMonth(): Promise<void> {
    const sheetId = this.monthlySheetId();
    if (!sheetId || this.monthForm.invalid) {
      this.monthForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const invoice = await this.api.fromMonthlySheet(sheetId, this.monthForm.getRawValue());
      this.bus.push({ kind: 'info', message: 'Draft created from the month', ttl: 3000 });
      await this.router.navigate(['/invoices', invoice.id, 'edit']);
    } catch (error) {
      this.report(error);
    } finally {
      this.saving.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (this.form.invalid || this.locked()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.fieldErrors.set({});
    try {
      const existing = this.invoice();
      const saved = existing
        ? await this.api.update(existing.id, this.toInput())
        : await this.api.create(this.toInput());
      this.bus.push({ kind: 'info', message: 'Draft saved', ttl: 3000 });
      await this.router.navigate(['/invoices', saved.id]);
    } catch (error) {
      this.fieldErrors.set((error as SheetRequestError).fields ?? {});
      this.report(error);
    } finally {
      this.saving.set(false);
    }
  }

  private fill(invoice: Invoice): void {
    this.invoice.set(invoice);
    this.form.patchValue({
      clientId: invoice.clientId,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate ?? '',
      periodLabel: invoice.periodLabel ?? '',
      taxRate: invoice.taxRate,
      advance: invoice.advance,
      terms: invoice.terms ?? '',
      footerNote: invoice.footerNote ?? '',
    });
    this.items.clear();
    for (const item of invoice.items) {
      this.addItem();
      this.items.at(this.items.length - 1).setValue({
        description: item.description,
        note: item.note ?? '',
        qty: item.qty,
        rate: item.rate,
      });
    }
    if (invoice.status !== 'DRAFT') this.form.disable();
  }

  private toInput(): InvoiceInput {
    const value = this.form.getRawValue();
    return {
      clientId: value.clientId,
      invoiceDate: value.invoiceDate,
      dueDate: value.dueDate || null,
      periodLabel: value.periodLabel || null,
      taxRate: Number(value.taxRate) || 0,
      advance: Number(value.advance) || 0,
      terms: value.terms || null,
      footerNote: value.footerNote || null,
      items: value.items.map((item) => ({
        description: item.description,
        note: item.note || null,
        qty: Number(item.qty),
        rate: Number(item.rate),
      })),
    };
  }

  private report(error: unknown): void {
    const failure = error as SheetRequestError;
    // 0, 403 and 5xx are already toasted by the global error interceptor.
    if (failure.status >= 400 && failure.status < 500 && failure.status !== 403) {
      this.bus.push({ kind: 'error', message: failure.message });
    }
  }
}
