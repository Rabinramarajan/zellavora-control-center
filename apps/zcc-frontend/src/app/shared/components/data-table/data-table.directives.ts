import { Directive, TemplateRef, inject, input } from '@angular/core';

export interface DataTableCellContext<T> {
  $implicit: T;
  index: number;
  /** Raw column value; absent for the actions column. */
  value?: unknown;
}

/** Custom cell for one column: `<ng-template dtCell="name" let-user>…</ng-template>` */
@Directive({ selector: 'ng-template[dtCell]', standalone: true })
export class DataTableCellDirective<T = unknown> {
  readonly dtCell = input.required<string>();
  readonly template = inject<TemplateRef<DataTableCellContext<T>>>(TemplateRef);
}

/** Trailing actions column: `<ng-template dtActions let-row>…</ng-template>` */
@Directive({ selector: 'ng-template[dtActions]', standalone: true })
export class DataTableActionsDirective<T = unknown> {
  readonly template = inject<TemplateRef<DataTableCellContext<T>>>(TemplateRef);
}

/** Replaces the default empty state. */
@Directive({ selector: 'ng-template[dtEmpty]', standalone: true })
export class DataTableEmptyDirective {
  readonly template = inject(TemplateRef);
}

/** Content placed before the pagination in the footer (export buttons, bulk actions). */
@Directive({ selector: 'ng-template[dtFooter]', standalone: true })
export class DataTableFooterDirective {
  readonly template = inject(TemplateRef);
}
