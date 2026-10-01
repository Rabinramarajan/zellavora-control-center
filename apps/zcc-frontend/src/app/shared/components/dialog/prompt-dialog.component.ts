import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { DialogShellComponent } from './dialog-shell.component';
import { injectDialogData, injectDialogRef } from './dialog.inject';
import { PromptDialogData } from './dialog.types';

let localId = 0;

@Component({
  selector: 'app-prompt-dialog',
  imports: [DialogShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './prompt-dialog.component.html',
  styleUrl: './prompt-dialog.component.scss',
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
