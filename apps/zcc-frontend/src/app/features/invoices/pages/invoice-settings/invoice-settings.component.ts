import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ErrorBus } from '../../../../core/error/error-bus';
import { SheetRequestError } from '../../../freelancer-sheets/sheets.models';
import { InvoicesApi } from '../../invoices.api';
import { InvoiceProfileInput } from '../../invoices.models';
import { InvoiceClientsComponent } from '../invoice-clients/invoice-clients.component';

const PAN = /^[A-Za-z]{5}\d{4}[A-Za-z]$/;
const GSTIN = /^\d{2}[A-Za-z]{5}\d{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]$/;
const IFSC = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;

/** Seller details, bank account and default terms used when an invoice is issued. */
@Component({
  selector: 'app-invoice-settings',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, InvoiceClientsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './invoice-settings.component.html',
  styleUrls: ['../../../freelancer-sheets/styles/sheets-theme.scss', '../../styles/invoices.scss'],
})
export class InvoiceSettingsComponent implements OnInit {
  private readonly api = inject(InvoicesApi);
  private readonly bus = inject(ErrorBus);
  private readonly fb = inject(NonNullableFormBuilder);

  /** `?tab=company` opens the companies you bill directly. */
  protected readonly tab = signal<'you' | 'company'>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('tab') === 'company' ? 'company' : 'you'
  );
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly maskedAccount = signal<string | null>(null);
  protected readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly form = this.fb.group({
    legalName: ['', [Validators.required, Validators.maxLength(200)]],
    addressLines: ['', Validators.required],
    pan: ['', Validators.pattern(PAN)],
    gstin: ['', Validators.pattern(GSTIN)],
    email: ['', Validators.email],
    phone: [''],
    bankAccountName: ['', Validators.required],
    bankName: ['', Validators.required],
    bankBranch: [''],
    bankAccountNumber: ['', Validators.pattern(/^[0-9A-Za-z]{6,34}$/)],
    ifsc: ['', [Validators.required, Validators.pattern(IFSC)]],
    paymentTermsDays: [7, [Validators.required, Validators.min(0), Validators.max(365)]],
    defaultTerms: [''],
    footerNote: ['Electronic bill signature not required'],
  });

  public async ngOnInit(): Promise<void> {
    try {
      const profile = await this.api.getProfile();
      if (profile) {
        this.maskedAccount.set(profile.bankAccountNumberMasked);
        this.form.patchValue({
          ...profile,
          pan: profile.pan ?? '',
          gstin: profile.gstin ?? '',
          email: profile.email ?? '',
          phone: profile.phone ?? '',
          bankBranch: profile.bankBranch ?? '',
          defaultTerms: profile.defaultTerms ?? '',
          footerNote: profile.footerNote ?? '',
        });
      } else {
        // A first profile must carry the account number.
        this.form.controls.bankAccountNumber.addValidators(Validators.required);
      }
    } catch (error) {
      this.report(error);
    } finally {
      this.loading.set(false);
    }
  }

  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name];
    return (control.invalid && control.touched) || !!this.fieldErrors()[name];
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const input: InvoiceProfileInput = {
      legalName: value.legalName,
      addressLines: value.addressLines,
      pan: value.pan || null,
      gstin: value.gstin || null,
      email: value.email || null,
      phone: value.phone || null,
      bankAccountName: value.bankAccountName,
      bankName: value.bankName,
      bankBranch: value.bankBranch || null,
      ...(value.bankAccountNumber ? { bankAccountNumber: value.bankAccountNumber } : {}),
      ifsc: value.ifsc,
      paymentTermsDays: Number(value.paymentTermsDays),
      defaultTerms: value.defaultTerms || null,
      footerNote: value.footerNote || null,
    };

    this.saving.set(true);
    this.fieldErrors.set({});
    try {
      const saved = await this.api.saveProfile(input);
      this.maskedAccount.set(saved.bankAccountNumberMasked);
      this.form.controls.bankAccountNumber.reset('');
      this.form.controls.bankAccountNumber.removeValidators(Validators.required);
      this.form.controls.bankAccountNumber.updateValueAndValidity();
      this.bus.push({ kind: 'info', message: 'Invoice settings saved', ttl: 3000 });
    } catch (error) {
      this.fieldErrors.set((error as SheetRequestError).fields ?? {});
      this.report(error);
    } finally {
      this.saving.set(false);
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
