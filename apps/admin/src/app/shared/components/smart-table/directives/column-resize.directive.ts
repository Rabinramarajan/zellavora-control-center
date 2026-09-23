import { Directive, ElementRef, Input, output, signal, effect } from '@angular/core';

/**
 * ColumnResizeDirective - Allows users to resize column widths by dragging the column header border.
 * Emits the new width via output widthChange.
 *
 * Usage:
 * <th smartColumnResize [initialWidth]="150" (widthChange)="onWidthChange($event)"></th>
 */
@Directive({ selector: '[smartColumnResize]', standalone: true })
export class ColumnResizeDirective {
  private el = inject(ElementRef);
  private readonly _initialWidth = input<number>(150);
  readonly widthChange = output<number>();

  private dragStartX = 0;
  private startWidth = 0;
  private isResizing = false;

  constructor() {
    effect(() => {
      // Initialize width from input if needed
      const initial = this._initialWidth();
      if (initial > 0) {
        this.el.nativeElement.style.width = `${initial}px`;
        this.el.nativeElement.minWidth = initial;
      }
    });
  }

  /** Start resizing capture. Called from host (td/th) via (mousedown). */
  startResize(event: MouseEvent): void {
    this.isResizing = true;
    this.dragStartX = event.clientX;
    this.startWidth = parseFloat(this.el.nativeElement.style.width) || this._initialWidth() || 150;

    // Add global listeners
    const onMouseMove = (e: MouseEvent) => this.doResize(e);
    const onMouseUp = () => this.endResize();

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Prevent selection while resizing
    event.preventDefault();
  }

  private doResize(event: MouseEvent): void {
    if (!this.isResizing) return;
    const delta = event.clientX - this.dragStartX;
    const newWidth = Math.max(50, this.startWidth + delta); // minimum 50px

    this.el.nativeElement.style.width = `${newWidth}px`;
    this.widthChange.emit(newWidth);
  }

  private endResize(): void {
    this.isResizing = false;
    document.removeEventListener('mousemove', () => {});
    document.removeEventListener('mouseup', () => {});
  }
}