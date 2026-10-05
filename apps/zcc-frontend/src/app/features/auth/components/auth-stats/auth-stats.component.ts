import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { AuthStat } from '../../models/nexus.models';

/**
 * The figures closing the Nexus stage, as a slow marquee ticker.
 *
 * The track holds the same group twice and animates to -50%, which is what
 * makes the loop seamless; the duplicate is aria-hidden so the figures are
 * announced once. Hovering pauses it, and reduced motion drops the duplicate
 * and leaves a static row.
 */
@Component({
  selector: 'app-auth-stats',
  standalone: true,
  templateUrl: './auth-stats.component.html',
  styleUrl: './auth-stats.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthStatsComponent {
  protected readonly stats: readonly AuthStat[] = [
    { value: '200', unit: '+', label: 'Happy teams' },
    { value: '99.9', unit: '%', label: 'Uptime' },
    { value: 'Global', label: 'Access' },
  ];
}
