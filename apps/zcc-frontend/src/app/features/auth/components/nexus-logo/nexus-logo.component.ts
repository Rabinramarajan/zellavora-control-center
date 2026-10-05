import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { NexusLogoSize } from '../../models/nexus.models';

/** Pixel size of the rounded-square mark at each step. */
const MARK_PX: Record<NexusLogoSize, number> = { xs: 16, sm: 24, md: 32, lg: 64 };

/**
 * The Zelavora Nexus mark: a rounded square holding a connected-node "Z",
 * optionally followed by the ZELAVORA / NEXUS wordmark.
 *
 * The glyph drops its node dots below 24px, where they would otherwise blur the
 * stroke, so the "Z" stays legible down to a 16px favicon.
 */
@Component({
  selector: 'app-nexus-logo',
  standalone: true,
  templateUrl: './nexus-logo.component.html',
  styleUrl: './nexus-logo.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"nx-logo nx-logo--" + size()',
    '[style.--nx-logo-size.px]': 'markPx()',
  },
})
export class NexusLogoComponent {
  readonly size = input<NexusLogoSize>('md');
  readonly wordmark = input(true);
  /** Adds the breathing glow used by the hero mark. Off for inline chrome. */
  readonly glow = input(false);

  protected readonly markPx = computed(() => MARK_PX[this.size()]);
  protected readonly showNodes = computed(() => this.size() !== 'xs');
}
