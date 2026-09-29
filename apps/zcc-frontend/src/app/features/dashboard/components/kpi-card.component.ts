import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DashboardIconComponent, DashboardIconName } from './dashboard-icon.component';

export type KpiTone = 'purple' | 'blue' | 'emerald' | 'amber' | 'pink' | 'red';

const TONE_RGB: Record<KpiTone, string> = {
  purple: '139 92 246',
  blue: '59 130 246',
  emerald: '16 185 129',
  amber: '245 158 11',
  pink: '236 72 153',
  red: '244 63 94',
};

const BAR_COUNT = 6;

@Component({
  selector: 'app-kpi-card',
  standalone: true,
  imports: [DashboardIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <article
      class="kpi-card group"
      [class.kpi-card--active]="highlighted()"
      [style.--tone]="toneRgb()"
      [attr.aria-label]="label() + ': ' + value()"
    >
      <header class="flex items-center gap-3">
        <span class="kpi-icon">
          <app-dashboard-icon [name]="icon()" [size]="18" />
        </span>
        <h3 class="text-[13px] font-semibold text-white/90 truncate">{{ label() }}</h3>
      </header>

      <div class="mt-4 flex items-end justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[28px] leading-none font-bold text-white tabular-nums">{{ value() }}</p>
          @if (delta() !== null) {
            <p
              class="mt-2 flex items-center gap-0.5 text-[11px] font-semibold tabular-nums"
              [class.text-emerald-400]="deltaPositive()"
              [class.text-rose-400]="!deltaPositive()"
            >
              <app-dashboard-icon
                [name]="deltaPositive() ? 'arrow-up' : 'arrow-down'"
                [size]="11"
                [strokeWidth]="2.5"
              />
              {{ deltaLabel() }}
            </p>
          }
          <p class="mt-1 text-[11px] text-slate-400 truncate">{{ hint() }}</p>
        </div>

        @if (bars().length) {
          <div class="kpi-bars" aria-hidden="true">
            @for (h of bars(); track $index) {
              <span [style.height.%]="h" [style.animation-delay.ms]="$index * 60"></span>
            }
          </div>
        } @else {
          <div class="kpi-flat" aria-hidden="true">
            <span></span>
            <span></span>
          </div>
        }
      </div>
    </article>
  `,
  styles: `
    .kpi-card {
      position: relative;
      height: 100%;
      padding: 1rem 1.125rem 1rem;
      border-radius: 1rem;
      border: 1px solid rgb(var(--tone) / 0.18);
      background:
        radial-gradient(120% 90% at 100% 100%, rgb(var(--tone) / 0.16), transparent 60%),
        linear-gradient(180deg, rgb(255 255 255 / 0.035), rgb(255 255 255 / 0.01));
      overflow: hidden;
      transition:
        transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
        border-color 220ms ease,
        box-shadow 220ms ease;
    }
    .kpi-card:hover,
    .kpi-card--active {
      transform: translateY(-2px);
      border-color: rgb(var(--tone) / 0.45);
      box-shadow:
        0 12px 32px -12px rgb(var(--tone) / 0.45),
        inset 0 1px 0 rgb(255 255 255 / 0.05);
    }
    .kpi-icon {
      display: grid;
      place-items: center;
      width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.625rem;
      color: rgb(var(--tone));
      background: rgb(var(--tone) / 0.16);
      box-shadow: inset 0 0 0 1px rgb(var(--tone) / 0.25);
    }
    .kpi-bars {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 44px;
      width: 72px;
      flex-shrink: 0;
    }
    .kpi-bars span {
      flex: 1;
      min-height: 12%;
      border-radius: 3px 3px 1px 1px;
      background: linear-gradient(180deg, rgb(var(--tone)), rgb(var(--tone) / 0.25));
      transform-origin: bottom;
      animation: kpi-grow 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .kpi-flat {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 22px;
      width: 72px;
      height: 44px;
    }
    .kpi-flat span {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgb(var(--tone) / 0.7));
    }
    @keyframes kpi-grow {
      from {
        transform: scaleY(0);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .kpi-card,
      .kpi-bars span {
        animation: none;
        transition: none;
      }
    }
  `,
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<number>();
  readonly hint = input<string>('');
  readonly icon = input.required<DashboardIconName>();
  readonly tone = input<KpiTone>('purple');
  /** Percent change against the previous half of the range; null hides the indicator. */
  readonly delta = input<number | null>(null);
  readonly series = input<number[]>([]);
  readonly highlighted = input<boolean>(false);

  readonly toneRgb = computed(() => TONE_RGB[this.tone()]);
  readonly deltaPositive = computed(() => (this.delta() ?? 0) >= 0);
  readonly deltaLabel = computed(() => `${Math.abs(Math.round(this.delta() ?? 0))}%`);

  // Buckets the series into a fixed number of bars so every card has the same rhythm.
  readonly bars = computed(() => {
    const values = this.series();
    if (!values.length || values.every((v) => v === 0)) return [];
    const size = Math.ceil(values.length / BAR_COUNT);
    const buckets: number[] = [];
    for (let i = 0; i < values.length; i += size) {
      buckets.push(values.slice(i, i + size).reduce((a, b) => a + b, 0));
    }
    const max = Math.max(...buckets, 1);
    return buckets.map((b) => Math.max(12, (b / max) * 100));
  });
}
