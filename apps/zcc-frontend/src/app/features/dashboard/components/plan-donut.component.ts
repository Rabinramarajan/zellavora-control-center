import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { PlanDistribution } from '../dashboard.models';

const PALETTE = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#f43f5e'];
const R = 42;
const CIRC = 2 * Math.PI * R;

@Component({
  selector: 'app-plan-donut',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-col sm:flex-row items-center gap-6 xl:gap-8">
      <div class="donut" role="img" [attr.aria-label]="ariaLabel()">
        <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90" aria-hidden="true">
          <circle
            cx="50"
            cy="50"
            [attr.r]="R"
            fill="none"
            stroke="rgb(255 255 255 / 0.05)"
            stroke-width="14"
          />
          @for (s of segments(); track s.plan) {
            <circle
              class="donut-seg"
              cx="50"
              cy="50"
              [attr.r]="R"
              fill="none"
              [attr.stroke]="s.color"
              stroke-width="14"
              [attr.stroke-dasharray]="s.dash + ' ' + CIRC"
              [attr.stroke-dashoffset]="-s.offset"
              [class.donut-seg--dim]="hovered() !== null && hovered() !== s.plan"
              [style.animation-delay.ms]="$index * 120"
              [style.filter]="'drop-shadow(0 0 4px ' + s.color + '66)'"
              (mouseenter)="hovered.set(s.plan)"
              (mouseleave)="hovered.set(null)"
            />
          }
        </svg>
        <div class="donut-center">
          <span class="text-[34px] font-bold text-white leading-none tabular-nums">
            {{ centerValue() }}
          </span>
          <span class="mt-1.5 text-[11px] text-slate-400 text-center leading-tight px-4">
            {{ centerLabel() }}
          </span>
        </div>
      </div>

      <ul class="flex-1 w-full space-y-1">
        @for (s of segments(); track s.plan) {
          <li
            class="flex items-center gap-3 text-[13px] rounded-lg px-2.5 py-2 transition-colors"
            [class.bg-white/5]="hovered() === s.plan"
            (mouseenter)="hovered.set(s.plan)"
            (mouseleave)="hovered.set(null)"
          >
            <span class="w-2.5 h-2.5 rounded-full shrink-0" [style.background]="s.color"></span>
            <span class="flex-1 text-slate-200 truncate">{{ s.label }}</span>
            <span class="font-semibold text-white tabular-nums">{{ s.count }}</span>
            <span class="w-11 text-right text-slate-400 tabular-nums">{{ s.pct }}%</span>
          </li>
        }
      </ul>
    </div>
  `,
  styles: `
    .donut {
      position: relative;
      width: 11.5rem;
      height: 11.5rem;
      flex-shrink: 0;
    }
    .donut-seg {
      cursor: pointer;
      transition:
        opacity 200ms ease,
        stroke-width 200ms ease;
      animation: donut-in 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    }
    .donut-seg:hover {
      stroke-width: 16;
    }
    .donut-seg--dim {
      opacity: 0.35;
    }
    .donut-center {
      position: absolute;
      inset: 22%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      background: radial-gradient(circle, rgb(20 18 45), rgb(10 9 26));
      box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.06);
    }
    @keyframes donut-in {
      from {
        opacity: 0;
        stroke-dasharray: 0 999;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .donut-seg {
        animation: none;
      }
    }
  `,
})
export class PlanDonutComponent {
  readonly data = input.required<PlanDistribution[]>();
  readonly totalLabel = input<string>('Total');

  protected readonly R = R;
  protected readonly CIRC = CIRC;
  protected readonly hovered = signal<string | null>(null);

  readonly total = computed(() => this.data().reduce((a, p) => a + p.count, 0));

  readonly segments = computed(() => {
    const total = this.total() || 1;
    let offset = 0;
    return [...this.data()]
      .sort((a, b) => b.count - a.count)
      .map((p, i) => {
        const dash = (p.count / total) * CIRC;
        const seg = {
          plan: p.plan,
          label: p.plan.charAt(0).toUpperCase() + p.plan.slice(1),
          count: p.count,
          pct: Math.round((p.count / total) * 100),
          color: PALETTE[i % PALETTE.length],
          dash,
          offset,
        };
        offset += dash;
        return seg;
      });
  });

  readonly centerValue = computed(() => {
    const plan = this.hovered();
    return plan ? (this.data().find((p) => p.plan === plan)?.count ?? 0) : this.total();
  });

  readonly centerLabel = computed(() => {
    const plan = this.hovered();
    return plan ? (this.segments().find((s) => s.plan === plan)?.label ?? '') : this.totalLabel();
  });

  readonly ariaLabel = computed(
    () =>
      `${this.totalLabel()}: ${this.total()}. ` +
      this.segments()
        .map((s) => `${s.label} ${s.count} (${s.pct}%)`)
        .join(', ')
  );
}
