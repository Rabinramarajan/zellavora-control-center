import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { DecimalPipe } from '@angular/common';

export interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  host: { class: 'block' },
  templateUrl: './donut-chart.component.html',
  styleUrl: './donut-chart.component.scss',
})
export class DonutChartComponent {
  readonly slices = input.required<DonutSlice[]>();
  readonly size = input(200);
  readonly strokeWidth = input(24);
  readonly centerLabel = input('');
  readonly centerValue = input('');

  protected readonly total = computed(() => this.slices().reduce((sum, s) => sum + s.value, 0));

  readonly paths = computed(() => {
    const slices = this.slices();
    const total = this.total();
    if (total === 0) return [];

    const radius = (this.size() - this.strokeWidth()) / 2;
    const circumference = 2 * Math.PI * radius;

    let cumulative = 0;
    return slices.map((slice) => {
      const percentage = slice.value / total;
      const offset = circumference * (1 - percentage);
      const startAngle = cumulative * 2 * Math.PI;
      cumulative += percentage;

      const midAngle = startAngle + percentage * Math.PI;
      const labelRadius = radius * 0.7;
      const labelX =
        radius + this.strokeWidth() / 2 + labelRadius * Math.cos(midAngle - Math.PI / 2);
      const labelY =
        radius + this.strokeWidth() / 2 + labelRadius * Math.sin(midAngle - Math.PI / 2);

      return {
        name: slice.name,
        value: slice.value,
        color: slice.color,
        percentage: Math.round(percentage * 100),
        offset,
        circumference,
        radius,
        strokeWidth: this.strokeWidth(),
        labelX,
        labelY,
        midAngle,
      };
    });
  });

  readonly hasData = computed(() => this.total() > 0 && this.slices().length > 0);

  readonly ariaLabel = computed(() => {
    const items = this.slices()
      .map((s) => `${s.name}: ${s.value} (${Math.round((s.value / this.total()) * 100)}%)`)
      .join(', ');
    return `Donut chart showing distribution: ${items}`;
  });
}
