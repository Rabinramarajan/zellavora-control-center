import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl, ValidationError, WithOptionalFieldTree } from '@angular/forms/signals';

let nextId = 0;

type FieldType = 'text' | 'email' | 'password';
type FieldIcon = 'mail' | 'lock';

/**
 * Text / email / password input bound with `[formField]`.
 * Owns the accessibility wiring the auth pages need: visible label, hint and
 * error linked through aria-describedby, aria-invalid, autocomplete hints for
 * password managers, and a keyboard-reachable show/hide toggle for passwords.
 */
@Component({
  selector: 'app-auth-field',
  standalone: true,
  template: `
    <div class="auth-field" [class.auth-field--invalid]="showError()">
      <div class="auth-field__label-row">
        <label class="auth-field__label" [for]="id">
          {{ label() }}
          @if (required()) {
            <span class="auth-field__required" aria-hidden="true">*</span>
          }
        </label>
        <ng-content select="[fieldAction]" />
      </div>

      <div class="auth-field__control" [class.auth-field__control--icon]="icon()">
        @if (icon(); as glyph) {
          <svg class="auth-field__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            @if (glyph === 'mail') {
              <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" />
            } @else {
              <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15.5" r="1.2" />
            }
          </svg>
        }
        <input
          #input
          class="auth-field__input"
          [class.auth-field__input--toggle]="type() === 'password'"
          [id]="id"
          [attr.name]="name() || null"
          [type]="inputType()"
          [value]="value()"
          [attr.autocomplete]="autocomplete()"
          [attr.inputmode]="inputmode()"
          [attr.maxlength]="maxLength() ?? null"
          [attr.placeholder]="placeholder() || null"
          [attr.aria-invalid]="showError()"
          [attr.aria-required]="required()"
          [attr.aria-describedby]="describedBy()"
          [readOnly]="readonly()"
          [disabled]="disabled()"
          [attr.autocapitalize]="type() === 'text' ? null : 'none'"
          spellcheck="false"
          (input)="onInput($event)"
          (blur)="touch.emit()"
          (keyup)="onKeyup($event)"
        />
        @if (type() === 'password') {
          <button
            type="button"
            class="auth-field__toggle"
            [attr.aria-label]="revealed() ? 'Hide ' + label().toLowerCase() : 'Show ' + label().toLowerCase()"
            [attr.aria-pressed]="revealed()"
            [attr.aria-controls]="id"
            (click)="revealed.set(!revealed())"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">
              @if (revealed()) {
                <path stroke-linecap="round" stroke-linejoin="round" d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 9 7 9 7a20 20 0 0 1-3 3.8M6.2 6.2C4.2 7.8 3 10 3 12c0 0 4 7 9 7 1.5 0 2.9-.6 4.2-1.4" />
              } @else {
                <path stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
              }
            </svg>
          </button>
        }
      </div>

      @if (capsLock()) {
        <p class="auth-field__caps" [id]="id + '-caps'">Caps Lock is on.</p>
      }
      @if (showError()) {
        <p class="auth-field__error" [id]="id + '-error'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="9" /><path stroke-linecap="round" d="M12 8v5m0 3h.01" />
          </svg>
          <span>{{ errorText() }}</span>
        </p>
      } @else if (hint()) {
        <p class="auth-field__hint" [id]="id + '-hint'">{{ hint() }}</p>
      }
    </div>
  `,
  styleUrl: './auth-field.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthFieldComponent implements FormValueControl<string> {
  readonly value = model('');

  readonly label = input.required<string>();
  readonly type = input<FieldType>('text');
  readonly autocomplete = input<string>('off');
  readonly inputmode = input<string | null>(null);
  readonly placeholder = input('');
  readonly hint = input('');
  readonly icon = input<FieldIcon | null>(null);

  // Bound automatically by [formField].
  readonly errors = input<readonly WithOptionalFieldTree<ValidationError>[]>([]);
  readonly invalid = input(false);
  readonly touched = input(false);
  readonly disabled = input(false);
  readonly readonly = input(false);
  readonly required = input(false);
  readonly maxLength = input<number | undefined>(undefined);
  readonly name = input('');
  readonly touch = output<void>();

  protected readonly id = `auth-field-${nextId++}`;
  protected readonly revealed = signal(false);
  protected readonly capsLock = signal(false);
  private readonly inputEl = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected readonly inputType = computed(() =>
    this.type() === 'password' && this.revealed() ? 'text' : this.type()
  );
  protected readonly showError = computed(() => this.touched() && this.invalid() && this.errors().length > 0);
  protected readonly errorText = computed(() => this.errors()[0]?.message ?? 'This field is invalid.');
  protected readonly describedBy = computed(() => {
    const ids: string[] = [];
    if (this.showError()) ids.push(`${this.id}-error`);
    else if (this.hint()) ids.push(`${this.id}-hint`);
    if (this.capsLock()) ids.push(`${this.id}-caps`);
    return ids.length ? ids.join(' ') : null;
  });

  focus(options?: FocusOptions): void {
    this.inputEl().nativeElement.focus(options);
  }

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }

  protected onKeyup(event: KeyboardEvent): void {
    if (this.type() === 'password') this.capsLock.set(event.getModifierState?.('CapsLock') ?? false);
  }
}
