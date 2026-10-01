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
  templateUrl: './recovery-codes.component.html',
  styleUrl: './recovery-codes.component.scss',
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
