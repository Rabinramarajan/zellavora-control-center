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
  templateUrl: './plan-donut.component.html',
  styleUrl: './plan-donut.component.scss',
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
