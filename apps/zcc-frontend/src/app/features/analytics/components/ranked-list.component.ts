import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { AnalyticsTopItem } from '../../../shared/models/analytics.model';

/**
 * Ranked breakdown (top pages, sources, countries, …) rendered as a semantic list with a
 * proportional bar per row, so the numbers stay readable without relying on the bar.
 */
@Component({
  selector: 'app-ranked-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe],
  templateUrl: './ranked-list.component.html',
  styleUrl: './ranked-list.component.scss',
})
export class RankedListComponent {
  public readonly items = input.required<readonly AnalyticsTopItem[]>();
  /** Column header for the item name, e.g. "Page" or "Country". */
  public readonly label = input.required<string>();
  public readonly emptyText = input('No data for this period.');
  /** Render names in a monospace font (paths, hosts). */
  public readonly mono = input(false);

  protected readonly max = computed(() => Math.max(1, ...this.items().map((i) => i.count)));

  protected width(count: number): number {
    return Math.max(2, (count / this.max()) * 100);
  }
}
