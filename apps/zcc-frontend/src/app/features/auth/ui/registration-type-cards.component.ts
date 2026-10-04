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
import type { RegistrationType } from '../../../shared/models/auth.model';
import type { RegistrationTypeMeta } from '../pages/register/registration-types';

let nextId = 0;

/**
 * The registration-type chooser: a native radio group styled as cards.
 *
 * Native `<input type="radio">` inside `<label>` rather than a hand-rolled
 * `role="radiogroup"`: arrow-key selection, the checked state and group
 * semantics come from the platform, and the visible card is the label, so the
 * whole card is the hit target with no extra wiring.
 */
@Component({
  selector: 'app-registration-type-cards',
  standalone: true,
  templateUrl: './registration-type-cards.component.html',
  styleUrl: './registration-type-cards.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationTypeCardsComponent implements FormValueControl<RegistrationType | ''> {
  readonly value = model<RegistrationType | ''>('');

  readonly options = input.required<readonly RegistrationTypeMeta[]>();
  readonly legend = input('How will you use Zellavora?');

  // Bound automatically by [formField].
  readonly errors = input<readonly WithOptionalFieldTree<ValidationError>[]>([]);
  readonly invalid = input(false);
  readonly touched = input(false);
  readonly disabled = input(false);
  readonly touch = output<void>();

  /** Emitted on a real user choice, so the page can advance and sync the URL. */
  readonly chosen = output<RegistrationType>();

  protected readonly groupName = `registration-type-${nextId++}`;
  protected readonly id = this.groupName;
  private readonly inputs = viewChildren<ElementRef<HTMLInputElement>>('radio');

  protected readonly showError = computed(
    () => this.touched() && this.invalid() && this.errors().length > 0
  );
  protected readonly errorText = computed(
    () => this.errors()[0]?.message ?? 'Choose how you will use Zellavora.'
  );

  /** Focuses the selected card, or the first one when nothing is selected yet. */
  focus(options?: FocusOptions): void {
    const els = this.inputs();
    if (!els.length) return;
    const selected = els.find((el) => el.nativeElement.value === this.value());
    (selected ?? els[0]).nativeElement.focus(options);
  }

  protected select(type: RegistrationType): void {
    this.value.set(type);
    this.touch.emit();
    this.chosen.emit(type);
  }
}
