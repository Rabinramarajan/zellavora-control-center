import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { AuthStat } from '../../models/nexus.models';

/** Understated figures under the network graphic. Separators, not cards. */
@Component({
  selector: 'app-auth-stats',
  standalone: true,
  templateUrl: './auth-stats.component.html',
  styleUrl: './auth-stats.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthStatsComponent {
  protected readonly stats: readonly AuthStat[] = [
    { icon: 'teams', value: '200+', label: 'Happy Teams' },
    { icon: 'uptime', value: '99.9%', label: 'Uptime' },
    { icon: 'globe', value: 'Global Access', label: '' },
  ];
}
