import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { FormInputControl } from '@zellavoras/ui';
import { AppDialogService } from '../../shared/components/dialog';
import { CmsBuilderRepository } from '../../core/repositories/cms-builder.repository';
import { CmsSection } from '../../shared/models';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-cms-builder',
  standalone: true,
  imports: [FormInputControl],
  templateUrl: './cms-builder.component.html',
  styleUrl: './cms-builder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CmsBuilderComponent {
  readonly repository = inject(CmsBuilderRepository);
  private readonly dialog = inject(AppDialogService);

  readonly pageTitle = signal('Landing Page');
  readonly pageSlug = signal('landing');
  readonly activeSections = signal<CmsSection[]>([]);

  constructor() {
    void this.loadPages();
  }

  private async loadPages(): Promise<void> {
    const pages = await firstValueFrom(this.repository.loadPages());
    if (pages.length > 0) {
      this.pageTitle.set(pages[0].title);
      this.pageSlug.set(pages[0].slug);
      this.activeSections.set([...pages[0].sections]);
    }
  }

  addSection(type: 'hero' | 'cta' | 'header' | 'footer') {
    const newSec: CmsSection = {
      id: crypto.randomUUID(),
      type,
      title: type.toUpperCase() + ' Component',
      content: {},
      orderIndex: this.activeSections().length,
    };
    this.activeSections.update((sections) => [...sections, newSec]);
  }

  removeSection(index: number) {
    this.activeSections.update((sections) => sections.filter((_, i) => i !== index));
  }

  moveUp(index: number) {
    if (index === 0) return;
    this.swap(index, index - 1);
  }

  moveDown(index: number) {
    if (index === this.activeSections().length - 1) return;
    this.swap(index, index + 1);
  }

  private swap(a: number, b: number) {
    this.activeSections.update((sections) => {
      const next = [...sections];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }

  async saveActivePage() {
    await firstValueFrom(
      this.repository.savePage({
        id: undefined,
        title: this.pageTitle(),
        slug: this.pageSlug(),
        sections: this.activeSections(),
      })
    );
    this.dialog.alert({
      title: 'Page published',
      message: 'CMS dynamic page saved and published successfully.',
    });
  }
}
