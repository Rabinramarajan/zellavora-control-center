import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { CmsSection, CmsDevice } from '../../../../shared/models';
import { CmsSectionPreviewComponent } from './cms-section-preview.component';

@Component({
  selector: 'app-cms-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CmsSectionPreviewComponent],
  templateUrl: './cms-canvas.component.html',
  styleUrl: './cms-canvas.component.scss',
})
export class CmsCanvasComponent {
  readonly sections = input<CmsSection[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly device = input<CmsDevice>('desktop');

  readonly selectSection = output<CmsSection | null>();
  readonly removeSection = output<string>();
  readonly moveSection = output<{ id: string; direction: 'up' | 'down' }>();
  readonly duplicateSection = output<string>();
  readonly reorder = output<CmsSection[]>();

  protected readonly hoveredId = signal<string | null>(null);

  protected select(s: CmsSection): void {
    const current = this.selectedId();
    this.selectSection.emit(current === s.id ? null : s);
  }

  protected remove(id: string, e: MouseEvent): void {
    e.stopPropagation();
    this.removeSection.emit(id);
  }

  protected move(id: string, direction: 'up' | 'down', e: MouseEvent): void {
    e.stopPropagation();
    this.moveSection.emit({ id, direction });
  }

  protected duplicate(id: string, e: MouseEvent): void {
    e.stopPropagation();
    this.duplicateSection.emit(id);
  }

  protected deselect(): void {
    this.selectSection.emit(null);
  }
}
