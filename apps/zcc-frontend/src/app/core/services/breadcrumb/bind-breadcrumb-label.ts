import { effect, inject } from '@angular/core';
import { BreadcrumbService } from './breadcrumb.service';

/**
 * Keeps the final crumb in step with a label the screen only knows once its data arrives,
 * so detail pages name themselves without owning a breadcrumb of their own.
 *
 * Call from a component's field initialiser or constructor:
 * `private readonly crumb = bindBreadcrumbLabel(() => this.user()?.personal.fullName);`
 */
export function bindBreadcrumbLabel(label: () => string | null | undefined): void {
  const breadcrumbs = inject(BreadcrumbService);
  effect(() => breadcrumbs.setCurrentLabel(label()));
}
