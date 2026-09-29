import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { AuthAlertComponent } from '../../auth/ui/auth-alert.component';

/**
 * One-time display of freshly issued recovery codes with copy and download.
 * Codes live only in component memory and are dropped when dismissed.
 */
@Component({
  selector: 'app-recovery-codes',
  standalone: true,
  imports: [AuthAlertComponent],
  template: `
    <div class="codes">
      <app-auth-alert tone="warning" heading="Save these codes now">
        Each code signs you in once if you lose your authenticator. They won't be shown again, and
        generating new codes invalidates this set.
      </app-auth-alert>

      <ol class="codes__grid" aria-label="Recovery codes">
        @for (code of codes(); track code) {
          <li><code>{{ code }}</code></li>
        }
      </ol>

      <div class="codes__actions">
        <button type="button" class="auth-btn auth-btn--secondary auth-btn--inline" (click)="copy()">
          {{ copied() ? 'Copied' : 'Copy codes' }}
        </button>
        <button type="button" class="auth-btn auth-btn--secondary auth-btn--inline" (click)="download()">
          Download .txt
        </button>
      </div>
      <p class="sr-only" role="status">{{ copied() ? 'Recovery codes copied to clipboard.' : '' }}</p>

      <label class="auth-check">
        <input type="checkbox" [checked]="acknowledged()" (change)="acknowledged.set(!acknowledged())" />
        <span>I've saved my recovery codes somewhere safe.</span>
      </label>
      <button
        type="button"
        class="auth-btn auth-btn--primary"
        [disabled]="!acknowledged()"
        (click)="done.emit()"
      >
        Done
      </button>
    </div>
  `,
  styles: `
    :host { display: block; }
    .codes { display: flex; flex-direction: column; gap: 1rem; }
    .codes__grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.5rem;
      margin: 0;
      padding: 1rem;
      list-style: none;
      border-radius: 0.8rem;
      border: 1px dashed var(--auth-border-strong);
      background: rgba(0, 0, 0, 0.25);
    }
    .codes__grid code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.95rem;
      letter-spacing: 0.06em;
      color: var(--auth-text-strong);
    }
    .codes__actions { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoveryCodesComponent {
  readonly codes = input.required<readonly string[]>();
  readonly done = output<void>();

  protected readonly copied = signal(false);
  protected readonly acknowledged = signal(false);

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.codes().join('\n'));
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  protected download(): void {
    const body = [
      'Zellavora Control Center — recovery codes',
      `Generated ${new Date().toISOString()}`,
      'Each code can be used once. Keep this file somewhere safe.',
      '',
      ...this.codes(),
      '',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zcc-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  }
}
