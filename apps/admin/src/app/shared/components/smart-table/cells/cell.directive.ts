import { input, TemplateRef, inject, Directive } from '@angular/core';

/** Directive to project a cell template with column key identification. */
@Directive({ selector: '[smartCell]', standalone: true })
export class SmartCellDirective {
  readonly columnKey = input.required<string>();
  readonly template = inject(TemplateRef);
}

/** Directive to project an empty state template. */
@Directive({ selector: '[smartEmpty]', standalone: true })
export class SmartEmptyDirective {
  readonly template = inject(TemplateRef);
}