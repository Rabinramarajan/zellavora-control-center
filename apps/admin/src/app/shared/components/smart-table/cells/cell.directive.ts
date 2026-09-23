import { Directive, TemplateRef, inject, input } from '@angular/core';

/** Context handed to a projected cell template. */
export interface SmartCellContext<T> {
  $implicit: T;
  value: unknown;
  index: number;
}

/**
 * Projects a custom cell for one column:
 * `<ng-template smartCell="status" let-row let-value="value">…</ng-template>`
 */
@Directive({ selector: 'ng-template[smartCell]', standalone: true })
export class SmartCellDirective {
  readonly smartCell = input.required<string>();
  readonly template = inject<TemplateRef<SmartCellContext<unknown>>>(TemplateRef);
}

/** Replaces the default empty-state row: `<ng-template smartEmpty>…</ng-template>` */
@Directive({ selector: 'ng-template[smartEmpty]', standalone: true })
export class SmartEmptyDirective {
  readonly template = inject(TemplateRef);
}
