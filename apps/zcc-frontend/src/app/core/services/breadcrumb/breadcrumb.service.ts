import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import {
  BREADCRUMB_SEGMENT_LABELS,
  BreadcrumbItem,
  BreadcrumbRouteConfig,
  BreadcrumbRouteData,
} from '../../../shared/models';

/** Looks like a database id rather than a readable slug. */
const ID_SEGMENT = /^(?:[0-9]+|[0-9a-f]{8,}(?:-[0-9a-f-]+)?)$/i;

/** Page titles are suffixed for the browser tab; the trail shows the bare name. */
const TITLE_SUFFIX = /\s*[·|-]\s*ZCC$/i;

/**
 * Derives the breadcrumb trail from the active route tree, so pages never hardcode one.
 *
 * A route describes its own crumb through `data.breadcrumb` (string or {@link BreadcrumbRouteConfig})
 * or, failing that, `data.title`. Segments with neither fall back to
 * {@link BREADCRUMB_SEGMENT_LABELS} and then to a humanised segment. Detail screens that only
 * know their label after loading call {@link setCurrentLabel}.
 */
@Injectable({ providedIn: 'root' })
export class BreadcrumbService {
  private readonly router = inject(Router);

  /** Re-reads the route tree on every completed navigation, redirects included. */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects || event.url)
    ),
    { initialValue: this.router.url }
  );

  /** Label a detail screen resolves at runtime, e.g. the user's name. */
  private readonly currentLabel = signal<string | null>(null);

  public readonly items = computed<BreadcrumbItem[]>(() => {
    this.currentUrl();
    const trail = this.buildTrail(this.router.routerState.snapshot.root);
    const label = this.currentLabel();
    if (!trail.length) {
      return [{ label: BREADCRUMB_SEGMENT_LABELS['dashboard'], url: null }];
    }
    if (!label) return trail;
    return trail.map((item, index) => (index === trail.length - 1 ? { label, url: null } : item));
  });

  /** The crumb for the screen the user is on. */
  public readonly current = computed<BreadcrumbItem | null>(() => this.items().at(-1) ?? null);

  public constructor() {
    // The label belongs to the screen that set it, never to the next one.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.currentLabel.set(null));
  }

  /** Overrides the last crumb once a detail screen knows what it is showing. */
  public setCurrentLabel(label: string | null | undefined): void {
    this.currentLabel.set(label?.trim() || null);
  }

  private buildTrail(root: ActivatedRouteSnapshot): BreadcrumbItem[] {
    const items: BreadcrumbItem[] = [];
    let path = '';

    for (let route: ActivatedRouteSnapshot | null = root; route; route = route.firstChild) {
      const configSegments = (route.routeConfig?.path ?? '').split('/').filter(Boolean);

      route.url.forEach((segment, index) => {
        path += `/${segment.path}`;
        const isRouteLeaf = index === route!.url.length - 1;
        const isParam = (configSegments[index] ?? '').startsWith(':');

        // An id in the middle of a path (`/invoices/:id/edit`) has no screen to point at.
        if (isParam && !isRouteLeaf) return;

        const configured = isRouteLeaf ? this.routeLabel(route!) : undefined;
        const label = configured?.label ?? this.fallbackLabel(segment.path);
        // Consecutive duplicates come from parent/child routes describing the same screen.
        if (items.at(-1)?.label === label) {
          items[items.length - 1] = { label, url: path };
          return;
        }
        items.push({ label, url: configured?.link === false ? null : path });
      });
    }

    const last = items.at(-1);
    if (last) items[items.length - 1] = { label: last.label, url: null };
    return items;
  }

  private routeLabel(route: ActivatedRouteSnapshot): BreadcrumbRouteConfig | undefined {
    const configured = route.data['breadcrumb'] as BreadcrumbRouteData | undefined;
    if (typeof configured === 'string') return { label: configured };
    if (configured) return configured;

    const dataTitle = route.data['title'];
    if (typeof dataTitle === 'string' && dataTitle) return { label: dataTitle };

    const routeTitle = route.title;
    if (typeof routeTitle === 'string' && routeTitle) {
      return { label: routeTitle.replace(TITLE_SUFFIX, '') };
    }
    return undefined;
  }

  private fallbackLabel(segment: string): string {
    const known = BREADCRUMB_SEGMENT_LABELS[segment.toLowerCase()];
    if (known) return known;
    if (ID_SEGMENT.test(segment)) return 'Details';
    return decodeURIComponent(segment)
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
