import { ChangeDetectionStrategy, Component } from '@angular/core';
import type { ValuePoint } from '../../models/nexus.models';

/** Three compact proof points under the headline — labels with icons, no cards. */
@Component({
  selector: 'app-auth-value-points',
  standalone: true,
  templateUrl: './auth-value-points.component.html',
  styleUrl: './auth-value-points.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthValuePointsComponent {
  protected readonly points: readonly ValuePoint[] = [
    { icon: 'shield', label: 'Enterprise grade' },
    { icon: 'scale', label: 'Built for scale' },
    { icon: 'control', label: 'Unified control' },
  ];
}
