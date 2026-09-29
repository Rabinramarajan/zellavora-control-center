import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface TrendSeries {
  name: string;
  color: string;
  data: number[];
}

const W = 1000;
const H = 240;
const TICKS = 5;
const MAX_X_LABELS = 11;

interface Point {
  x: number;
  y: number;
}

// Catmull-Rom → cubic Bézier, clamped so the curve never overshoots the plot floor.
function smoothPath(points: Point[]): string {
  if (!points.length) return '';
  if (points.length === 1) return `M0,${points[0].y} L${W},${points[0].y}`;
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1y = Math.min(H, p1.y + (p2.y - p0.y) / 6);
    const c2y = Math.min(H, p2.y - (p3.y - p1.y) / 6);
    d += ` C${p1.x + (p2.x - p0.x) / 6},${c1y} ${p2.x - (p3.x - p1.x) / 6},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

function niceMax(value: number): number {
  if (value <= 0) return TICKS * 2;
  const step = Math.pow(10, Math.floor(Math.log10(value / TICKS)));
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * step).find((u) => u * TICKS >= value) ?? step * 10;
  return Math.max(unit, 1) * TICKS;
}

@Component({
  selector: 'app-trend-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex gap-3 h-full">
      <div
        class="flex flex-col justify-between text-[11px] text-slate-400 tabular-nums text-right pb-7 -mt-1.5"
        aria-hidden="true"
      >
        @for (t of yTicks(); track $index) {
          <span class="leading-none">{{ t }}</span>
        }
      </div>

      <div class="relative flex-1 min-w-0">
        <div
          class="chart-plot"
          tabindex="0"
          role="img"
          [attr.aria-label]="ariaLabel()"
          (mousemove)="onPointer($event)"
          (mouseleave)="active.set(null)"
          (blur)="active.set(null)"
          (keydown)="onKey($event)"
        >
          <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
            @for (t of yTicks(); track $index) {
              <span class="block h-px bg-white/[0.05]"></span>
            }
          </div>

          <svg
            class="absolute inset-0 w-full h-full overflow-visible"
            [attr.viewBox]="'0 0 ' + W + ' ' + H"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              @for (s of paths(); track s.name) {
                <linearGradient [attr.id]="gradientId(s.name)" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" [attr.stop-color]="s.color" stop-opacity="0.45" />
                  <stop offset="100%" [attr.stop-color]="s.color" stop-opacity="0" />
                </linearGradient>
              }
            </defs>
            @for (s of paths(); track s.name) {
              <path
                class="chart-area"
                [attr.d]="s.area"
                [attr.fill]="'url(#' + gradientId(s.name) + ')'"
              />
              <path
                class="chart-line"
                [attr.d]="s.line"
                fill="none"
                [attr.stroke]="s.color"
                stroke-width="2.5"
                vector-effect="non-scaling-stroke"
                [style.filter]="'drop-shadow(0 0 6px ' + s.color + ')'"
              />
            }
          </svg>

          @if (activePoint(); as a) {
            <div class="chart-guide" [style.left.%]="a.leftPct"></div>
            @for (dot of a.dots; track dot.name) {
              <span
                class="chart-dot"
                [style.left.%]="a.leftPct"
                [style.top.%]="dot.topPct"
                [style.--dot]="dot.color"
              ></span>
            }
            <div
              class="chart-tooltip"
              [style.left.%]="a.leftPct"
              [class.chart-tooltip--flip]="a.leftPct > 75"
              [class.chart-tooltip--start]="a.leftPct < 12"
            >
              <p class="text-[12px] font-semibold text-white mb-1.5">{{ a.label }}</p>
              @for (dot of a.dots; track dot.name) {
                <p class="flex items-center gap-2 text-[12px] text-slate-300">
                  <span class="w-2 h-2 rounded-full" [style.background]="dot.color"></span>
                  <span class="flex-1">{{ dot.name }}</span>
                  <span class="font-semibold text-white tabular-nums pl-4">{{ dot.value }}</span>
                </p>
              }
            </div>
          }
        </div>

        <div class="relative h-7 mt-2 text-[11px] text-slate-400" aria-hidden="true">
          @for (l of xLabels(); track l.index) {
            <span class="chart-xlabel" [style.left.%]="l.leftPct">{{ l.text }}</span>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .chart-plot {
      position: relative;
      height: calc(100% - 2.25rem);
      min-height: 180px;
      outline: none;
      border-radius: 0.5rem;
      cursor: crosshair;
    }
    .chart-plot:focus-visible {
      box-shadow: 0 0 0 2px rgb(139 92 246 / 0.6);
    }
    .chart-line {
      stroke-dasharray: 6000;
      stroke-dashoffset: 6000;
      animation: chart-draw 1.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
    }
    .chart-area {
      opacity: 0;
      animation: chart-fade 900ms 400ms ease forwards;
    }
    .chart-guide {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 0;
      border-left: 1px dashed rgb(255 255 255 / 0.35);
      pointer-events: none;
    }
    .chart-dot {
      position: absolute;
      width: 14px;
      height: 14px;
      margin: -7px 0 0 -7px;
      border-radius: 9999px;
      background: #fff;
      border: 3px solid var(--dot);
      box-shadow:
        0 0 0 4px color-mix(in srgb, var(--dot) 30%, transparent),
        0 0 14px var(--dot);
      pointer-events: none;
    }
    .chart-tooltip {
      position: absolute;
      top: -0.5rem;
      transform: translate(-50%, -100%);
      min-width: 9rem;
      padding: 0.625rem 0.75rem;
      border-radius: 0.625rem;
      background: rgb(17 15 38 / 0.92);
      border: 1px solid rgb(255 255 255 / 0.1);
      backdrop-filter: blur(10px);
      box-shadow: 0 16px 40px -12px rgb(0 0 0 / 0.7);
      pointer-events: none;
      z-index: 2;
    }
    .chart-tooltip--flip {
      transform: translate(-100%, -100%);
    }
    .chart-tooltip--start {
      transform: translate(0, -100%);
    }
    .chart-xlabel {
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      white-space: nowrap;
    }
    .chart-xlabel:first-child {
      transform: none;
    }
    .chart-xlabel:last-child {
      transform: translateX(-100%);
    }
    @keyframes chart-draw {
      to {
        stroke-dashoffset: 0;
      }
    }
    @keyframes chart-fade {
      to {
        opacity: 1;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .chart-line,
      .chart-area {
        animation: none;
        stroke-dashoffset: 0;
        opacity: 1;
      }
    }
  `,
})
export class TrendChartComponent {
  readonly labels = input.required<string[]>();
  readonly series = input.required<TrendSeries[]>();

  protected readonly W = W;
  protected readonly H = H;
  protected readonly active = signal<number | null>(null);

  private readonly count = computed(() => this.labels().length);

  private readonly yMax = computed(() =>
    niceMax(Math.max(0, ...this.series().flatMap((s) => s.data)))
  );

  readonly yTicks = computed(() => {
    const max = this.yMax();
    return Array.from({ length: TICKS + 1 }, (_, i) => Math.round(max - (max / TICKS) * i));
  });

  private xAt(i: number): number {
    const n = this.count();
    return n <= 1 ? W / 2 : (i / (n - 1)) * W;
  }

  private yAt(v: number): number {
    return H - (v / this.yMax()) * H;
  }

  readonly paths = computed(() =>
    this.series().map((s) => {
      const points = s.data.map((v, i) => ({ x: this.xAt(i), y: this.yAt(v) }));
      const line = smoothPath(points);
      const lastX = points.length > 1 ? points[points.length - 1].x : W;
      const firstX = points.length > 1 ? points[0].x : 0;
      return {
        name: s.name,
        color: s.color,
        line,
        area: `${line} L${lastX},${H} L${firstX},${H} Z`,
      };
    })
  );

  readonly xLabels = computed(() => {
    const labels = this.labels();
    const n = labels.length;
    if (!n) return [];
    const step = Math.max(1, Math.ceil((n - 1) / (MAX_X_LABELS - 1)));
    const idx: number[] = [];
    for (let i = 0; i < n; i += step) idx.push(i);
    if (idx[idx.length - 1] !== n - 1 && n - 1 - idx[idx.length - 1] < step / 2) idx.pop();
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    return idx.map((i) => ({
      index: i,
      text: this.shortLabel(labels[i]),
      leftPct: (this.xAt(i) / W) * 100,
    }));
  });

  readonly activePoint = computed(() => {
    const i = this.active();
    if (i === null || i >= this.count()) return null;
    return {
      leftPct: (this.xAt(i) / W) * 100,
      label: this.longLabel(this.labels()[i]),
      dots: this.series().map((s) => ({
        name: s.name,
        color: s.color,
        value: s.data[i] ?? 0,
        topPct: (this.yAt(s.data[i] ?? 0) / H) * 100,
      })),
    };
  });

  readonly ariaLabel = computed(() => {
    const totals = this.series()
      .map((s) => `${s.name} total ${s.data.reduce((a, b) => a + b, 0)}`)
      .join(', ');
    return `Trend chart over ${this.count()} days. ${totals}. Use arrow keys to inspect days.`;
  });

  gradientId(name: string): string {
    return `trend-fill-${name.toLowerCase().replace(/\W+/g, '-')}`;
  }

  onPointer(event: MouseEvent): void {
    const n = this.count();
    if (!n) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    this.active.set(Math.round(ratio * (n - 1)));
  }

  onKey(event: KeyboardEvent): void {
    const n = this.count();
    if (!n) return;
    const current = this.active() ?? -1;
    if (event.key === 'ArrowRight') this.active.set(Math.min(n - 1, current + 1));
    else if (event.key === 'ArrowLeft')
      this.active.set(Math.max(0, current < 0 ? n - 1 : current - 1));
    else if (event.key === 'Home') this.active.set(0);
    else if (event.key === 'End') this.active.set(n - 1);
    else if (event.key === 'Escape') this.active.set(null);
    else return;
    event.preventDefault();
  }

  private toDate(iso: string): Date {
    return new Date(`${iso}T00:00:00Z`);
  }

  private shortLabel(iso: string): string {
    return this.toDate(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }

  private longLabel(iso: string): string {
    return this.toDate(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
}
