import { Directive, ElementRef, input, output, signal, effect } from '@angular/core';

/**
 * ColumnWidthsSyncDirective - Syncs column widths between frozen and regular columns
 * using ResizeObserver. Updates a shared columnWidths signal.
 *
 * Usage in thead/th:
 * <th smartColumnWidthSync [columnKey]="'name'" (widthUpdated)="onWidth($event)"></th>
 */
@Directive({ selector: '[smartColumnWidthSync]', standalone: true })
export class ColumnWidthSyncDirective {
  private el = inject(ElementRef);
  readonly columnKey = input.required<string>();
  readonly widthUpdated = output<number>();

  private readonly _widths = input<Signal<Map<string, number>>>(undefined);
  private readonly _onChange = output<Map<string, number>>();

  private readonly widths = signal<Map<string, number>>(new Map());

  constructor() {
    // Subscribe to the input signal changes if provided
    effect(() => {
      const widthsFn = this._widths();
      if (widthsFn) {
        const current = this.widths();
        const key = this.columnKey();
        if (key && widthsFn.has(key)) {
          this.widths.set(key, widthsFn.get(key)!);
          this.el.nativeElement.style.width = `${widthsFn.get(key)}px`;
        }
      }
    });

    // Export updated widths via output
    effect(() => {
      this._onChange.emit(this.widths());
    });
  }

  /** Get the current width for this column key. */
  getWidth(): number {
    return this.widths().get(this.columnKey()) ?? 150;
  }

  /** Set the width for this column key. */
  setWidth(width: number): void {
    this.widths.update(current => {
      const newMap = new Map(current);
      newMap.set(this.columnKey(), width);
      return newMap;
    });
    this.el.nativeElement.style.width = `${width}px`;
    this.widthUpdated.emit(width);
  }
}