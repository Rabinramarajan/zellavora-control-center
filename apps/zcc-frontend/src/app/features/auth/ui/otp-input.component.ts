import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  model,
  output,
  viewChildren,
} from '@angular/core';
import type {
  FormValueControl,
  ValidationError,
  WithOptionalFieldTree,
} from '@angular/forms/signals';

let nextId = 0;
const LENGTH = 6;

/**
 * Six-box one-time-code input bound with `[formField]`. Typing advances,
 * Backspace steps back, arrows move, and pasting (or OS autofill into the
 * first box) spreads a full code across the boxes.
 */
@Component({
  selector: 'app-otp-input',
  standalone: true,
  templateUrl: './otp-input.component.html',
  styleUrl: './otp-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtpInputComponent implements FormValueControl<string> {
  readonly value = model('');
  readonly label = input('Verification code');

  readonly errors = input<readonly WithOptionalFieldTree<ValidationError>[]>([]);
  readonly invalid = input(false);
  readonly touched = input(false);
  readonly disabled = input(false);
  readonly touch = output<void>();
  /** Emitted once all six digits are present, so the parent can auto-submit. */
  readonly completed = output<string>();

  protected readonly id = `otp-${nextId++}`;
  protected readonly length = LENGTH;
  protected readonly slots = Array.from({ length: LENGTH }, (_, i) => i);
  protected readonly digits = computed(() =>
    Array.from({ length: LENGTH }, (_, i) => this.value()[i] ?? '')
  );
  protected readonly showError = computed(
    () => this.touched() && this.invalid() && this.errors().length > 0
  );
  private readonly boxes = viewChildren<ElementRef<HTMLInputElement>>('box');

  focus(): void {
    this.boxes()[Math.min(this.value().length, LENGTH - 1)]?.nativeElement.focus();
  }

  protected onInput(index: number, event: Event): void {
    const el = event.target as HTMLInputElement;
    const typed = el.value.replace(/\D/g, '');
    if (typed.length > 1) {
      // Autofill or fast typing into one box: treat as a paste from here.
      this.fill(index, typed);
      return;
    }
    this.setDigit(index, typed);
    el.value = typed;
    if (typed && index < LENGTH - 1) this.focusBox(index + 1);
  }

  protected onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.digits()[index] && index > 0) {
      event.preventDefault();
      this.setDigit(index - 1, '');
      this.focusBox(index - 1);
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      this.focusBox(index - 1);
    } else if (event.key === 'ArrowRight' && index < LENGTH - 1) {
      event.preventDefault();
      this.focusBox(index + 1);
    }
  }

  protected onPaste(index: number, event: ClipboardEvent): void {
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    this.fill(index, pasted);
  }

  protected select(event: FocusEvent): void {
    (event.target as HTMLInputElement).select();
  }

  private fill(start: number, digits: string): void {
    const chars = this.padded();
    for (let i = 0; i < digits.length && start + i < LENGTH; i++) chars[start + i] = digits[i];
    this.commit(chars);
    this.focusBox(Math.min(start + digits.length, LENGTH - 1));
  }

  private setDigit(index: number, digit: string): void {
    const chars = this.padded();
    chars[index] = digit;
    this.commit(chars);
  }

  private padded(): string[] {
    return [...this.digits()];
  }

  private commit(chars: string[]): void {
    // Keep only the contiguous prefix so the model never holds gaps.
    const firstGap = chars.indexOf('');
    const code = (firstGap === -1 ? chars : chars.slice(0, firstGap)).join('');
    this.value.set(code);
    if (code.length === LENGTH) this.completed.emit(code);
  }

  private focusBox(index: number): void {
    queueMicrotask(() => this.boxes()[index]?.nativeElement.focus());
  }
}
