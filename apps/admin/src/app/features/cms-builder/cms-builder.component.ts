import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CmsBuilderRepository } from '@core/repositories/cms-builder.repository';
import { CmsPage, CmsSection } from '@shared/models';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-cms-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cms-builder.component.html',
  styleUrl: './cms-builder.component.css',
})
export class CmsBuilderComponent {
  readonly repository = inject(CmsBuilderRepository);

  pageTitle = 'Landing Page';
  pageSlug = 'landing';
  activeSections: CmsSection[] = [];

  constructor() {
    void this.loadPages();
  }

  private async loadPages(): Promise<void> {
    const pages = await firstValueFrom(this.repository.loadPages());
    if (pages.length > 0) {
      this.pageTitle = pages[0].title;
      this.pageSlug = pages[0].slug;
      this.activeSections = [...pages[0].sections];
    }
  }

  addSection(type: 'hero' | 'cta' | 'header' | 'footer') {
    const newSec: CmsSection = {
      id: crypto.randomUUID(),
      type,
      title: type.toUpperCase() + ' Component',
      content: {},
      orderIndex: this.activeSections.length,
    };
    this.activeSections.push(newSec);
  }

  removeSection(index: number) {
    this.activeSections.splice(index, 1);
  }

  moveUp(index: number) {
    if (index === 0) return;
    const temp = this.activeSections[index];
    this.activeSections[index] = this.activeSections[index - 1];
    this.activeSections[index - 1] = temp;
  }

  moveDown(index: number) {
    if (index === this.activeSections.length - 1) return;
    const temp = this.activeSections[index];
    this.activeSections[index] = this.activeSections[index + 1];
    this.activeSections[index + 1] = temp;
  }

  async saveActivePage() {
    await firstValueFrom(this.repository.savePage({
      title: this.pageTitle,
      slug: this.pageSlug,
      sections: this.activeSections,
    }));
    alert('CMS Dynamic Page saved and published successfully!');
  }
}
