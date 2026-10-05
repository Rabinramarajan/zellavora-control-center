import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BreadcrumbService } from '../../../core/services/breadcrumb/breadcrumb.service';
import { BreadcrumbItem } from '../../models';

/** A trail step, or the gap that stands in for the steps hidden on narrow screens. */
type BreadcrumbNode =
  { readonly kind: 'item'; readonly item: BreadcrumbItem } | { readonly kind: 'gap' };

/**
 * Renders the breadcrumb trail for the active route. Drops into any shell without inputs;
 * pass `items` only to render a trail the router cannot describe.
 */
@Component({
  selector: 'app-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [RouterLink],
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.scss',
})
export class BreadcrumbComponent {
  private readonly breadcrumbs = inject(BreadcrumbService);

  /** Overrides the route-derived trail. */
  public readonly items = input<readonly BreadcrumbItem[] | null>(null);

  /** Steps kept visible; the trail collapses around a gap beyond this. */
  public readonly maxItems = input(4);

  public readonly trail = computed<readonly BreadcrumbItem[]>(
    () => this.items() ?? this.breadcrumbs.items()
  );

  public readonly nodes = computed<readonly BreadcrumbNode[]>(() => {
    const trail = this.trail();
    const max = Math.max(2, this.maxItems());
    if (trail.length <= max) {
      return trail.map((item) => ({ kind: 'item', item }) as const);
    }
    // Keep the root for context and the tail for position; the middle collapses.
    return [
      { kind: 'item', item: trail[0] } as const,
      { kind: 'gap' } as const,
      ...trail.slice(trail.length - (max - 1)).map((item) => ({ kind: 'item', item }) as const),
    ];
  });

  /** Read out in place of the collapsed steps. */
  public readonly hiddenLabel = computed(() => {
    const trail = this.trail();
    const shown = this.nodes().filter((node) => node.kind === 'item').length;
    return trail
      .slice(1, trail.length - (shown - 1))
      .map((item) => item.label)
      .join(', ');
  });
}
