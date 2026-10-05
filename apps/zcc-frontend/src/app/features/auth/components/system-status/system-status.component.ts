import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Platform health line shown beside the auth navigation. */
@Component({
  selector: 'app-system-status',
  standalone: true,
  template: `
    <span class="nx-status__dot" aria-hidden="true"></span>
    <span class="nx-status__label">{{ label() }}</span>
  `,
  styleUrl: './system-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'status' },
})
export class SystemStatusComponent {
  readonly label = input('All systems operational');
}
