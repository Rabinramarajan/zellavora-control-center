import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const W = 160;
const H = 56;

let nextId = 0;

/** Decorative smoothed area sparkline; the numbers it summarises are shown as text nearby. */
@Component({
  selector: 'app-sparkline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" [attr.stop-color]="color()" stop-opacity="0.35" />
          <stop offset="100%" [attr.stop-color]="color()" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path [attr.d]="paths().area" [attr.fill]="'url(#' + gradientId + ')'" />
      <path
        [attr.d]="paths().line"
        fill="none"
        [attr.stroke]="color()"
        stroke-width="2.25"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  `,
  styles: `
    :host {
      display: block;
    }
    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
    }
  `,
})
export class SparklineComponent {
  public readonly data = input.required<readonly number[]>();
  public readonly color = input('#6366f1');

  protected readonly w = W;
  protected readonly h = H;
  protected readonly gradientId = `spark-${nextId++}`;

  protected readonly paths = computed(() => {
    const raw = this.data();
    // A flat series still draws a gentle baseline instead of nothing.
    const values = raw.length > 1 ? raw : [0, 0];
    const max = Math.max(1, ...values);
    const step = W / (values.length - 1);
    const pts = values.map((v, i) => ({ x: i * step, y: H - 6 - (v / max) * (H - 14) }));
    let line = `M${pts[0].x},${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1];
      const c = pts[i];
      const mx = (p.x + c.x) / 2;
      line += ` C${mx},${p.y} ${mx},${c.y} ${c.x},${c.y}`;
    }
    return { line, area: `${line} L${W},${H} L0,${H} Z` };
  });
}
