import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { NexusLogoComponent } from '../nexus-logo/nexus-logo.component';
import type { NexusNode } from '../../models/nexus.models';

/**
 * The orbital network: business modules circling the Nexus hub.
 *
 * Geometry lives in a 1000x1000 square. The orbit rings, connectors and
 * particles are drawn as SVG inside that square; the nodes themselves are HTML
 * positioned over it, so their labels stay selectable, themeable and crisp at
 * any scale. Decorative throughout — `aria-hidden` on the host keeps it out of
 * the accessibility tree, and the page states the same information in text.
 */
@Component({
  selector: 'app-nexus-network',
  standalone: true,
  imports: [NexusLogoComponent],
  templateUrl: './nexus-network.component.html',
  styleUrl: './nexus-network.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class.nx-net--compact]': 'compact()' },
})
export class NexusNetworkComponent {
  /** Mobile header variant: fewer rings, no particles, smaller hub. */
  readonly compact = input(false);

  protected readonly nodes: readonly NexusNode[] = [
    { id: 'organizations', label: 'Organizations', x: 50, y: 14, delay: 0 },
    { id: 'teams', label: 'Teams', x: 19, y: 33, delay: 0.9 },
    { id: 'projects', label: 'Projects', x: 81, y: 33, delay: 1.8 },
    { id: 'timesheets', label: 'Timesheets', x: 27, y: 76, delay: 2.7 },
    { id: 'invoices', label: 'Invoices', x: 73, y: 76, delay: 3.6 },
  ];

  /** Connector paths, hub (500,480) out to each node, bowed for a softer orbit. */
  protected readonly connectors: readonly { id: string; d: string; delay: number }[] = [
    { id: 'organizations', d: 'M500 480 Q 556 304 500 140', delay: 0 },
    { id: 'teams', d: 'M500 480 Q 330 452 190 330', delay: 0.9 },
    { id: 'projects', d: 'M500 480 Q 670 452 810 330', delay: 1.8 },
    { id: 'timesheets', d: 'M500 480 Q 352 606 270 760', delay: 2.7 },
    { id: 'invoices', d: 'M500 480 Q 648 606 730 760', delay: 3.6 },
  ];

  /** Orbit rings around the hub: radius, dash rhythm and rotation period. */
  protected readonly rings: readonly { r: number; dash: string; dur: number; reverse: boolean }[] = [
    { r: 150, dash: '2 10', dur: 70, reverse: false },
    { r: 232, dash: '40 26', dur: 95, reverse: true },
    { r: 318, dash: '3 14', dur: 120, reverse: false },
    { r: 404, dash: '70 44', dur: 150, reverse: true },
  ];

  /** Drifting points of light, placed on a ring at a starting angle. */
  protected readonly particles: readonly { r: number; angle: number; dur: number; size: number }[] =
    [
      { r: 232, angle: 20, dur: 95, size: 4 },
      { r: 232, angle: 200, dur: 95, size: 3 },
      { r: 318, angle: 110, dur: 120, size: 3.5 },
      { r: 318, angle: 290, dur: 120, size: 2.5 },
      { r: 404, angle: 65, dur: 150, size: 4 },
      { r: 404, angle: 245, dur: 150, size: 3 },
      { r: 150, angle: 155, dur: 70, size: 3 },
    ];
}
