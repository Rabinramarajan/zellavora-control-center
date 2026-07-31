import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DoCheck,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NgControl, Validators } from '@angular/forms';
import {
  DEFAULT_VALIDATION_MESSAGES,
  INPUT_VALIDATION_MESSAGES,
  InputControlSize,
  InputControlType,
  ValidationMessageMap,
  resolveValidationMessage,
} from './input-control.types';

let nextUniqueId = 0;

/**
 * Shared text input.
 *
 * Works with every binding style because it registers itself as the
 * `valueAccessor` of whichever `NgControl` directive is on the host element:
 *
 *   Reactive:        <app-input-control formControlName="email" label="Email" />
 *   Template-driven: <app-input-control [(ngModel)]="email" name="email" required />
 *   Standalone:      <app-input-control [value]="q()" (valueChange)="q.set($event)" />
 *
 * Errors are only surfaced once the control has been touched (or the form was
 * submitted and the host re-renders), matching the rest of the auth shell.
 */
@Component({
  selector: 'app-input-control',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1.5" [class.opacity-60]="isDisabled()">
      @if (label()) {
        <label
          [attr.for]="inputId()"
          class="text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          {{ label() }}
          @if (showRequiredMarker()) {
            <span class="text-red-500 ml-0.5" aria-hidden="true">*</span>
          }
        </label>
      }

      <div class="relative flex items-center">
        @if (prefixIcon()) {
          <i
            [class]="'pi ' + prefixIcon() + ' absolute left-3 text-gray-400 pointer-events-none'"
            aria-hidden="true"
          ></i>
        }

        @if (type() === 'textarea') {
          <textarea
            #field
            [id]="inputId()"
            [attr.name]="name()"
            [attr.placeholder]="placeholder() || null"
            [attr.rows]="rows()"
            [attr.maxlength]="maxlength()"
            [attr.autocomplete]="autocomplete() || null"
            [attr.aria-describedby]="describedBy()"
            [attr.aria-invalid]="showError() ? 'true' : null"
            [attr.aria-required]="showRequiredMarker() ? 'true' : null"
            [disabled]="isDisabled()"
            [readOnly]="readonly()"
            [value]="displayValue()"
            [class]="fieldClasses()"
            (input)="onInput($event)"
            (blur)="onBlur()"
            (focus)="onFocus()"
          ></textarea>
        } @else {
          <input
            #field
            [id]="inputId()"
            [type]="resolvedType()"
            [attr.name]="name()"
            [attr.placeholder]="placeholder() || null"
            [attr.maxlength]="maxlength()"
            [attr.min]="min()"
            [attr.max]="max()"
            [attr.step]="step()"
            [attr.inputmode]="inputmode()"
            [attr.autocomplete]="autocomplete() || null"
            [attr.aria-describedby]="describedBy()"
            [attr.aria-invalid]="showError() ? 'true' : null"
            [attr.aria-required]="showRequiredMarker() ? 'true' : null"
            [disabled]="isDisabled()"
            [readOnly]="readonly()"
            [value]="displayValue()"
            [class]="fieldClasses()"
            (input)="onInput($event)"
            (blur)="onBlur()"
            (focus)="onFocus()"
            (keyup.enter)="enter.emit()"
          />
        }

        <div class="absolute right-2 flex items-center gap-1">
          @if (canClear()) {
            <button
              type="button"
              class="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              aria-label="Clear value"
              (click)="clear()"
            >
              <i class="pi pi-times text-xs" aria-hidden="true"></i>
            </button>
          }
          @if (type() === 'password' && togglePassword()) {
            <button
              type="button"
              class="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              [attr.aria-label]="passwordVisible() ? 'Hide password' : 'Show password'"
              [attr.aria-pressed]="passwordVisible()"
              (click)="togglePasswordVisibility()"
            >
              <i
                class="pi text-xs"
                [class.pi-eye]="!passwordVisible()"
                [class.pi-eye-slash]="passwordVisible()"
                aria-hidden="true"
              ></i>
            </button>
          }
          @if (suffixIcon()) {
            <i
              [class]="'pi ' + suffixIcon() + ' text-gray-400 mr-1'"
              aria-hidden="true"
            ></i>
          }
        </div>
      </div>

      @if (showError()) {
        <p [id]="errorId()" class="text-xs text-red-500" role="alert">
          {{ errorMessage() }}
        </p>
      } @else if (hint()) {
        <p [id]="hintId()" class="text-xs text-gray-500 dark:text-gray-400">{{ hint() }}</p>
      }

      @if (maxlength() && showCounter()) {
        <p class="text-[11px] text-gray-400 self-end tabular-nums">
          {{ characterCount() }} / {{ maxlength() }}
        </p>
      }
    </div>
  `,
})
export class InputControlComponent implements ControlValueAccessor, DoCheck {
  // --- Content -------------------------------------------------------------
  readonly label = input<string>('');
  readonly placeholder = input<string>('');
  readonly hint = input<string>('');
  readonly name = input<string | null>(null);
  readonly type = input<InputControlType>('text');
  readonly size = input<InputControlSize>('md');
  readonly prefixIcon = input<string>('');
  readonly suffixIcon = input<string>('');

  // --- Behaviour -----------------------------------------------------------
  readonly readonly = input(false);
  readonly required = input(false);
  readonly clearable = input(false);
  readonly togglePassword = input(true);
  readonly showCounter = input(false);
  readonly autocomplete = input<string>('');
  readonly inputmode = input<string | null>(null);
  readonly rows = input(4);
  readonly maxlength = input<number | null>(null);
  readonly min = input<number | string | null>(null);
  readonly max = input<number | string | null>(null);
  readonly step = input<number | string | null>(null);
  /** Trims the value before it reaches the model. Off for password fields. */
  readonly trim = input(false);
  /** Forces the error state on, e.g. while showing a server-side failure. */
  readonly errorText = input<string>('');
  /** Only used when the control is bound with `[disabled]` instead of a form. */
  readonly disabled = input(false);

  /** Standalone value binding — ignored when a form directive is present. */
  readonly value = input<any>(undefined);

  // --- Outputs -------------------------------------------------------------
  readonly valueChange = output<any>();
  readonly blurred = output<void>();
  readonly focused = output<void>();
  readonly enter = output<void>();

  private readonly fieldRef = viewChild<ElementRef<HTMLInputElement | HTMLTextAreaElement>>('field');
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly globalMessages = inject(INPUT_VALIDATION_MESSAGES);

  private readonly messages: ValidationMessageMap = {
    ...DEFAULT_VALIDATION_MESSAGES,
    ...this.globalMessages,
  };

  private readonly uid = `zc-input-${nextUniqueId++}`;
  readonly inputId = computed(() => this.uid);
  readonly errorId = computed(() => `${this.uid}-error`);
  readonly hintId = computed(() => `${this.uid}-hint`);

  // Internal reactive state. `_value` is the source of truth while a form
  // directive owns the control; `value()` covers the standalone case.
  private readonly _value = signal<any>('');
  private readonly _cvaDisabled = signal(false);
  private readonly _touched = signal(false);
  private readonly _invalid = signal(false);
  private readonly _controlError = signal<string | null>(null);
  private readonly _hasRequiredValidator = signal(false);
  readonly isFocused = signal(false);
  readonly passwordVisible = signal(false);

  private onChange: (value: any) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    // Registering here (instead of via NG_VALUE_ACCESSOR) avoids the circular
    // dependency and gives us access to the control for error reporting.
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }

    // Keep the standalone `[value]` binding in sync when no form is attached.
    effect(() => {
      const next = this.value();
      if (!this.ngControl && next !== undefined) {
        this._value.set(next);
      }
    });
  }

  /**
   * Form directives mutate control state imperatively, so mirror the parts we
   * render into signals on every check. `signal.set` with an equal value is a
   * no-op, so this does not cause extra change detection work.
   */
  ngDoCheck(): void {
    const control = this.ngControl?.control;
    if (!control) return;

    this._touched.set(control.touched);
    this._invalid.set(control.invalid);
    this._controlError.set(
      resolveValidationMessage(control.errors, this.label() || 'This field', this.messages)
    );

    this._hasRequiredValidator.set(control.hasValidator?.(Validators.required) ?? false);
  }

  // --- ControlValueAccessor ------------------------------------------------
  writeValue(value: any): void {
    this._value.set(value ?? '');
  }

  registerOnChange(fn: (value: any) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._cvaDisabled.set(isDisabled);
  }

  // --- Derived view state --------------------------------------------------
  readonly isDisabled = computed(() => this._cvaDisabled() || this.disabled());

  readonly displayValue = computed(() => {
    const raw = this._value();
    return raw === null || raw === undefined ? '' : String(raw);
  });

  readonly characterCount = computed(() => this.displayValue().length);

  readonly resolvedType = computed(() =>
    this.type() === 'password' && this.passwordVisible() ? 'text' : this.type()
  );

  readonly showRequiredMarker = computed(() => this.required() || this._hasRequiredValidator());

  readonly errorMessage = computed(() => this.errorText() || this._controlError());

  readonly showError = computed(() => {
    if (this.errorText()) return true;
    return this._invalid() && this._touched() && !!this._controlError();
  });

  readonly canClear = computed(
    () => this.clearable() && !!this.displayValue() && !this.isDisabled() && !this.readonly()
  );

  readonly describedBy = computed(() => {
    if (this.showError()) return this.errorId();
    if (this.hint()) return this.hintId();
    return null;
  });

  readonly fieldClasses = computed(() => {
    const sizeClass = {
      sm: 'py-1.5 text-sm',
      md: 'py-2.5 text-sm',
      lg: 'py-3 text-base',
    }[this.size()];

    const paddingLeft = this.prefixIcon() ? 'pl-10' : 'pl-3';
    const trailingCount =
      (this.canClear() ? 1 : 0) +
      (this.type() === 'password' && this.togglePassword() ? 1 : 0) +
      (this.suffixIcon() ? 1 : 0);
    const paddingRight = trailingCount > 1 ? 'pr-16' : trailingCount === 1 ? 'pr-10' : 'pr-3';

    const stateClass = this.showError()
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
      : 'border-gray-300 dark:border-white/10 focus:border-indigo-500 focus:ring-indigo-500/20';

    return [
      'w-full rounded-lg border bg-white/10 dark:bg-black/20',
      'text-gray-900 dark:text-white placeholder:text-gray-400',
      'outline-none transition-all focus:ring-2',
      'disabled:cursor-not-allowed read-only:cursor-default',
      this.type() === 'textarea' ? 'resize-y' : '',
      sizeClass,
      paddingLeft,
      paddingRight,
      stateClass,
    ]
      .filter(Boolean)
      .join(' ');
  });

  // --- Event handlers ------------------------------------------------------
  onInput(event: Event): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const next = this.parse(target.value);
    this._value.set(next);
    this.onChange(next);
    this.valueChange.emit(next);
  }

  onBlur(): void {
    this.isFocused.set(false);
    this._touched.set(true);
    this.onTouched();

    // Trim on blur so the caret is not disturbed mid-typing.
    if (this.trim() && this.type() !== 'password') {
      const trimmed = this.displayValue().trim();
      if (trimmed !== this.displayValue()) {
        this._value.set(trimmed);
        this.onChange(trimmed);
        this.valueChange.emit(trimmed);
      }
    }

    this.blurred.emit();
  }

  onFocus(): void {
    this.isFocused.set(true);
    this.focused.emit();
  }

  clear(): void {
    const empty = this.type() === 'number' ? null : '';
    this._value.set(empty);
    this.onChange(empty);
    this.valueChange.emit(empty);
    this.onTouched();
    this.focus();
  }

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
    this.focus();
  }

  /** Focuses the underlying native element — useful from a parent via `viewChild`. */
  focus(): void {
    this.fieldRef()?.nativeElement.focus();
  }

  private parse(raw: string): any {
    if (this.type() !== 'number') return raw;
    if (raw === '') return null;
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? raw : parsed;
  }
}
