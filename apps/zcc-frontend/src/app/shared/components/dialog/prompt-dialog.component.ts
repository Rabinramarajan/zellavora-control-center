import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { DialogShellComponent } from './dialog-shell.component';
import { injectDialogData, injectDialogRef } from './dialog.inject';
import { PromptDialogData } from './dialog.types';

let localId = 0;

@Component({
  selector: 'app-prompt-dialog',
  imports: [DialogShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-dialog-shell [title]="data.title" [closeResult]="null">
      <form [id]="formId" (submit)="submit($event)">
        @if (data.message) {
          <p class="app-prompt__message">{{ data.message }}</p>
        }
        <label class="app-prompt__label" [for]="inputId">{{ data.label ?? data.title }}</label>
        <input
          class="app-prompt__input"
          cdkFocusInitial
          autocomplete="off"
          [id]="inputId"
          [type]="data.inputType ?? 'text'"
          [placeholder]="data.placeholder ?? ''"
          [value]="value()"
          (input)="value.set($any($event.target).value)"
        />
      </form>

      <button
        dialogActions
        type="button"
        class="app-dialog-btn app-dialog-btn--ghost"
        (click)="ref.close(null)"
      >
        {{ data.cancelText ?? 'Cancel' }}
      </button>
      <button
        dialogActions
        type="submit"
        [attr.form]="formId"
        [class]="'app-dialog-btn app-dialog-btn--' + (data.variant ?? 'primary')"
        [disabled]="!canSubmit()"
      >
        {{ data.confirmText ?? 'OK' }}
      </button>
    </app-dialog-shell>
  `,
  styles: `
    .app-prompt__message {
      margin: 0 0 12px;
      white-space: pre-line;
    }
    .app-prompt__label {
      display: block;
      margin-bottom: 6px;
      font-size: 0.875rem;
      color: var(--app-dialog-on-surface-variant);
    }
    .app-prompt__input {
      width: 100%;
      min-height: 44px;
      padding: 0 12px;
      border-radius: 10px;
      border: 1px solid color-mix(in srgb, var(--app-dialog-on-surface) 20%, transparent);
      background: transparent;
      color: var(--app-dialog-on-surface);
      font: inherit;
    }
    .app-prompt__input:focus {
      outline: none;
      border-color: var(--app-dialog-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--app-dialog-primary) 25%, transparent);
    }
  `,
})
export class PromptDialogComponent {
  protected readonly data = injectDialogData<PromptDialogData>();
  protected readonly ref = injectDialogRef<string | null>();

  protected readonly formId = `app-prompt-form-${localId}`;
  protected readonly inputId = `app-prompt-input-${localId++}`;
  protected readonly value = signal(this.data.initialValue ?? '');
  protected readonly canSubmit = computed(() => !this.data.required || !!this.value().trim());

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.canSubmit()) this.ref.close(this.value().trim());
  }
}
