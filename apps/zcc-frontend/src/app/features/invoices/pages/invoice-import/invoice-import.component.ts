import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { startWith } from 'rxjs';
import { ErrorBus } from '../../../../core/error/error-bus';
import { SheetRequestError } from '../../../freelancer-sheets/sheets.models';
import { ParsedInvoice, invoiceFileKind, readInvoiceFile } from '../../import/invoice-import';
import { InvoicesApi } from '../../invoices.api';
import { InvoiceClient } from '../../invoices.models';
import { formatRupees, lineValue, todayKey } from '../../invoices.presentation';

/** A client from the bill rather than one already saved. */
const NEW_CLIENT = '__new';
const MAX_FILE_BYTES = 10 * 1024 * 1024;

type DraftState = 'reading' | 'ready' | 'saving' | 'saved' | 'failed';

interface ImportDraft {
  key: number;
  fileName: string;
  state: DraftState;
  parsed: ParsedInvoice | null;
  message: string | null;
  invoiceId: string | null;
}

type ItemForm = FormGroup<{
  description: FormControl<string>;
  note: FormControl<string>;
  qty: FormControl<number>;
  rate: FormControl<number>;
}>;

const normalize = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Bring in bills issued before this system. Each file is read in the
 * browser, shown for review, and saved as issued (or paid) under its own
 * number; nothing is stored until the reviewer saves.
 */
@Component({
  selector: 'app-invoice-import',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-import.component.html',
  styleUrls: ['../../../freelancer-sheets/styles/sheets-theme.scss', '../../styles/invoices.scss'],
})
export class InvoiceImportComponent implements OnInit {
  private readonly api = inject(InvoicesApi);
  private readonly bus = inject(ErrorBus);
  private readonly fb = inject(NonNullableFormBuilder);
  private nextKey = 1;

  protected readonly newClient = NEW_CLIENT;
  protected readonly rupees = formatRupees;
  protected readonly clients = signal<InvoiceClient[]>([]);
  protected readonly drafts = signal<ImportDraft[]>([]);
  protected readonly activeKey = signal<number | null>(null);
  protected readonly fieldErrors = signal<Record<string, string>>({});
  protected readonly dragging = signal(false);
  /** Imports print the seller and bank details, so saving waits for a profile. */
  protected readonly hasProfile = signal<boolean | null>(null);

  protected readonly active = computed(
    () => this.drafts().find((draft) => draft.key === this.activeKey()) ?? null
  );
  protected readonly savedCount = computed(
    () => this.drafts().filter((draft) => draft.state === 'saved').length
  );

  protected readonly form = this.fb.group({
    invoiceNumber: ['', [Validators.required, Validators.maxLength(32)]],
    invoiceDate: [todayKey(), Validators.required],
    status: this.fb.control<'ISSUED' | 'PAID'>('PAID'),
    paidOn: [''],
    clientId: ['', Validators.required],
    clientName: [''],
    clientAddress: [''],
    clientGstin: [''],
    attnName: [''],
    attnDesignation: [''],
    periodLabel: [''],
    advance: [0, Validators.min(0)],
    items: this.fb.array<ItemForm>([]),
  });

  private readonly values = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() }
  );

  protected readonly totals = computed(() => {
    const value = this.values();
    const subtotal = (value.items ?? []).reduce(
      (sum, item) => sum + lineValue(item?.qty ?? 0, item?.rate ?? 0),
      0
    );
    const advance = Number(value.advance) || 0;
    return { subtotal, advance, grand: subtotal - advance };
  });

  protected readonly creatingClient = computed(() => this.values().clientId === NEW_CLIENT);

  protected get items(): FormArray<ItemForm> {
    return this.form.controls.items;
  }

  public async ngOnInit(): Promise<void> {
    try {
      const [clients, profile] = await Promise.all([this.api.listClients(), this.api.getProfile()]);
      this.clients.set(clients);
      this.hasProfile.set(profile !== null);
    } catch (error) {
      this.report(error);
    }
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected select(draft: ImportDraft): void {
    if (draft.state !== 'ready' && draft.state !== 'failed') return;
    if (!draft.parsed) return;
    this.activeKey.set(draft.key);
    this.fill(draft.parsed);
  }

  protected discard(draft: ImportDraft): void {
    this.drafts.update((list) => list.filter((item) => item.key !== draft.key));
    if (this.activeKey() === draft.key) this.openNext();
  }

  protected addItem(): void {
    this.items.push(this.itemGroup({ description: '', note: null, qty: 1, rate: 0 }));
  }

  protected removeItem(index: number): void {
    if (this.items.length > 1) this.items.removeAt(index);
  }

  protected lineValue(index: number): number {
    const item = this.items.at(index).getRawValue();
    return lineValue(item.qty, item.rate);
  }

  protected async save(): Promise<void> {
    const draft = this.active();
    if (!draft) return;
    if (
      this.form.invalid ||
      (this.creatingClient() && !this.form.controls.clientName.value.trim())
    ) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.patch(draft.key, { state: 'saving', message: null });
    this.fieldErrors.set({});
    try {
      const clientId = value.clientId === NEW_CLIENT ? await this.createClient() : value.clientId;
      const invoice = await this.api.importInvoice({
        invoiceNumber: value.invoiceNumber.trim(),
        invoiceDate: value.invoiceDate,
        status: value.status,
        paidOn: value.status === 'PAID' && value.paidOn ? value.paidOn : null,
        clientId,
        dueDate: null,
        periodLabel: value.periodLabel || null,
        taxRate: 0,
        advance: Number(value.advance) || 0,
        terms: null,
        footerNote: null,
        items: value.items.map((item) => ({
          description: item.description,
          note: item.note || null,
          qty: Number(item.qty),
          rate: Number(item.rate),
        })),
      });
      this.patch(draft.key, { state: 'saved', invoiceId: invoice.id, message: null });
      this.bus.push({ kind: 'info', message: `Saved ${invoice.invoiceNumber}`, ttl: 3000 });
      this.openNext();
    } catch (error) {
      const failure = error as SheetRequestError;
      this.fieldErrors.set(failure.fields ?? {});
      this.patch(draft.key, { state: 'ready', message: failure.message });
      this.report(error);
    }
  }

  private addFiles(files: File[]): void {
    for (const file of files) {
      const key = this.nextKey++;
      const draft: ImportDraft = {
        key,
        fileName: file.name,
        state: 'reading',
        parsed: null,
        message: null,
        invoiceId: null,
      };
      this.drafts.update((list) => [...list, draft]);

      if (!invoiceFileKind(file)) {
        this.patch(key, { state: 'failed', message: 'Only PDF and Word (.docx) files.' });
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        this.patch(key, { state: 'failed', message: 'Larger than 10 MB.' });
        continue;
      }
      void readInvoiceFile(file)
        .then((parsed) => {
          this.patch(key, { state: 'ready', parsed });
          if (this.activeKey() === null) this.select({ ...draft, state: 'ready', parsed });
        })
        .catch((error: unknown) =>
          this.patch(key, {
            state: 'failed',
            message: error instanceof Error ? error.message : 'The file could not be read.',
          })
        );
    }
  }

  private openNext(): void {
    const next = this.drafts().find((draft) => draft.state === 'ready');
    if (next) this.select(next);
    else this.activeKey.set(null);
  }

  private fill(parsed: ParsedInvoice): void {
    const match = parsed.client.name
      ? this.clients().find((client) => normalize(client.name) === normalize(parsed.client.name!))
      : undefined;

    this.form.reset({
      invoiceNumber: parsed.invoiceNumber ?? '',
      invoiceDate: parsed.invoiceDate ?? todayKey(),
      status: 'PAID',
      paidOn: '',
      clientId: match?.id ?? (parsed.client.name ? NEW_CLIENT : ''),
      clientName: parsed.client.name ?? '',
      clientAddress: parsed.client.addressLines.join('\n'),
      clientGstin: parsed.client.gstin ?? '',
      attnName: parsed.client.attnName ?? '',
      attnDesignation: parsed.client.attnDesignation ?? '',
      periodLabel: parsed.periodLabel ?? '',
      advance: parsed.advance,
    });
    this.items.clear();
    const items = parsed.items.length
      ? parsed.items
      : [{ description: '', note: null, qty: 1, rate: 0 }];
    for (const item of items) this.items.push(this.itemGroup(item));
    this.fieldErrors.set({});
  }

  private itemGroup(item: {
    description: string;
    note: string | null;
    qty: number;
    rate: number;
  }): ItemForm {
    return this.fb.group({
      description: [item.description, [Validators.required, Validators.maxLength(500)]],
      note: [item.note ?? ''],
      qty: [item.qty, [Validators.required, Validators.min(0.01)]],
      rate: [item.rate, [Validators.required, Validators.min(0)]],
    });
  }

  /** The bill's "To," block becomes a saved client, reused by later files. */
  private async createClient(): Promise<string> {
    const value = this.form.getRawValue();
    const client = await this.api.createClient({
      name: value.clientName.trim(),
      addressLines: value.clientAddress.trim() || value.clientName.trim(),
      gstin: value.clientGstin.trim() || null,
      attnName: value.attnName.trim() || null,
      attnDesignation: value.attnDesignation.trim() || null,
      email: null,
    });
    this.clients.update((list) => [...list, client].sort((a, b) => a.name.localeCompare(b.name)));
    this.form.controls.clientId.setValue(client.id);
    return client.id;
  }

  private patch(key: number, changes: Partial<ImportDraft>): void {
    this.drafts.update((list) =>
      list.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft))
    );
  }

  private report(error: unknown): void {
    const failure = error as SheetRequestError;
    // 0, 403 and 5xx are already toasted by the global error interceptor.
    if (failure.status >= 400 && failure.status < 500 && failure.status !== 403) {
      this.bus.push({ kind: 'error', message: failure.message });
    }
  }
}
