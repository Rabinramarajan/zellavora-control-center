import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { ThemeService } from '../../../../core/services/theme/theme.service';
import { NexusLogoComponent } from '../nexus-logo/nexus-logo.component';
import { NexusNetworkComponent } from '../nexus-network/nexus-network.component';
import { AuthStatsComponent } from '../auth-stats/auth-stats.component';
import { AuthValuePointsComponent } from '../auth-value-points/auth-value-points.component';
import { SystemStatusComponent } from '../system-status/system-status.component';
import { AuthFooterComponent } from '../auth-footer/auth-footer.component';

/**
 * The full-bleed Nexus composition shared by sign-in and registration: the
 * orbital network and the brand story on the left, a working panel on the
 * right that the host page fills through content projection.
 *
 * The marketing copy lives here rather than in either page because it is the
 * same story on both, and because keeping it on the stage leaves the panel to
 * the task at hand — the reason the two screens feel like one product.
 *
 * Projected content inherits the Nexus custom properties from this host, but
 * Angular scopes its classes to the host page, so each page keeps its own
 * panel styles and this component styles only the frame.
 */
@Component({
  selector: 'app-nexus-shell',
  standalone: true,
  imports: [
    NexusLogoComponent,
    NexusNetworkComponent,
    AuthStatsComponent,
    AuthValuePointsComponent,
    SystemStatusComponent,
    AuthFooterComponent,
  ],
  templateUrl: './nexus-shell.component.html',
  styleUrl: './nexus-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NexusShellComponent {
  /** Id given to the panel's <main>, so the skip link and labels can target it. */
  readonly contentId = input('nx-content');
  /** Completes "Skip to …" for the bypass link. */
  readonly skipTo = input('content');
  /** Element id of the heading that names the panel, for its accessible name. */
  readonly labelledBy = input<string | null>(null);

  private readonly theme = inject(ThemeService);

  protected readonly isDark = this.theme.isDark;
  protected readonly navLinks = ['Manage', 'Monitor', 'Scale'] as const;

  protected toggleTheme(): void {
    this.theme.setPreference(this.isDark() ? 'light' : 'dark');
  }
}
