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
type FieldIcon = 'mail' | 'lock' | 'user';

/**
 * Text / email / password input bound with `[formField]`.
 * Owns the accessibility wiring the auth pages need: visible label, hint and
 * error linked through aria-describedby, aria-invalid, autocomplete hints for
 * password managers, and a keyboard-reachable show/hide toggle for passwords.
 */
@Component({
  selector: 'app-auth-field',
  standalone: true,
  templateUrl: './auth-field.component.html',
  styleUrl: './auth-field.component.scss',
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
