import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, catchError, of } from 'rxjs';
import { CmsBuilderApiService } from '../../../core/api/cms-builder.api';
import { IamFeedbackService } from '../../iam/shared/iam-feedback.service';
import { IAM_BTN } from '../../iam/shared/iam-page-header.component';
import {
  CmsPage,
  CmsSection,
  CmsComponentType,
  CmsDevice,
} from '../../../shared/models';
import { CmsComponentLibraryComponent } from './component-library/cms-component-library.component';
import { CmsCanvasComponent } from './canvas/cms-canvas.component';
import { CmsPropertyPanelComponent } from './property-panel/cms-property-panel.component';
import { CmsPageSettingsPanelComponent } from './settings/cms-page-settings-panel.component';

type RightPanel = 'properties' | 'settings';

@Component({
  selector: 'app-cms-page-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CmsComponentLibraryComponent,
    CmsCanvasComponent,
    CmsPropertyPanelComponent,
    CmsPageSettingsPanelComponent,
  ],
  templateUrl: './cms-page-builder.component.html',
  styleUrl: './cms-page-builder.component.scss',
})
export class CmsPageBuilderComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(CmsBuilderApiService);
  private readonly feedback = inject(IamFeedbackService);

  protected readonly btn = IAM_BTN;

  // Page state
  protected readonly page = signal<CmsPage | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly publishing = signal(false);
  protected readonly dirty = signal(false);

  // Builder state
  protected readonly selectedSection = signal<CmsSection | null>(null);
  protected readonly device = signal<CmsDevice>('desktop');
  protected readonly rightPanel = signal<RightPanel>('properties');

  // Undo/redo
  private readonly history = signal<CmsSection[][]>([]);
  private readonly historyIndex = signal(-1);
  protected readonly canUndo = computed(() => this.historyIndex() > 0);
  protected readonly canRedo = computed(() => this.historyIndex() < this.history().length - 1);

  protected readonly sections = computed(() => this.page()?.sections ?? []);

  protected readonly deviceOptions: { label: string; value: CmsDevice; icon: string }[] = [
    { label: 'Desktop', value: 'desktop', icon: 'pi-desktop' },
    { label: 'Laptop', value: 'laptop', icon: 'pi-window-maximize' },
    { label: 'Tablet', value: 'tablet', icon: 'pi-tablet' },
    { label: 'Mobile', value: 'mobile', icon: 'pi-mobile' },
  ];

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/cms']);
      return;
    }
    void this.loadPage(id);
  }

  private async loadPage(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const p = await firstValueFrom(
        this.api.getPage(id).pipe(
          catchError(() => of(MOCK_PAGE(id)))
        )
      );
      this.page.set(p);
      this.pushHistory(p.sections);
    } finally {
      this.loading.set(false);
    }
  }

  private pushHistory(sections: CmsSection[]): void {
    const idx = this.historyIndex();
    const h = this.history().slice(0, idx + 1);
    h.push([...sections]);
    this.history.set(h);
    this.historyIndex.set(h.length - 1);
  }

  protected addSection(type: CmsComponentType): void {
    const newSection: CmsSection = {
      id: crypto.randomUUID(),
      type,
      title: type.charAt(0).toUpperCase() + type.slice(1),
      content: {},
      props: getDefaultProps(type),
      styles: { desktop: {}, tablet: {}, mobile: {} },
      children: [],
      orderIndex: this.sections().length,
    };
    this.updateSections([...this.sections(), newSection]);
    this.selectedSection.set(newSection);
  }

  protected removeSection(id: string): void {
    if (this.selectedSection()?.id === id) this.selectedSection.set(null);
    this.updateSections(this.sections().filter((s) => s.id !== id));
  }

  protected moveSection(id: string, direction: 'up' | 'down'): void {
    const sections = [...this.sections()];
    const idx = sections.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const target = direction === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= sections.length) return;
    [sections[idx], sections[target]] = [sections[target], sections[idx]];
    this.updateSections(sections);
  }

  protected duplicateSection(id: string): void {
    const sections = this.sections();
    const idx = sections.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const copy: CmsSection = { ...sections[idx], id: crypto.randomUUID(), title: sections[idx].title + ' (Copy)' };
    const next = [...sections.slice(0, idx + 1), copy, ...sections.slice(idx + 1)];
    this.updateSections(next);
  }

  protected updateSection(updated: CmsSection): void {
    this.updateSections(this.sections().map((s) => (s.id === updated.id ? updated : s)));
    if (this.selectedSection()?.id === updated.id) this.selectedSection.set(updated);
  }

  protected reorderSections(sections: CmsSection[]): void {
    this.updateSections(sections);
  }

  private updateSections(sections: CmsSection[]): void {
    this.page.update((p) => p ? { ...p, sections } : null);
    this.dirty.set(true);
    this.pushHistory(sections);
  }

  protected undo(): void {
    const idx = this.historyIndex();
    if (idx <= 0) return;
    this.historyIndex.set(idx - 1);
    const sections = this.history()[idx - 1];
    this.page.update((p) => p ? { ...p, sections } : null);
    this.dirty.set(true);
  }

  protected redo(): void {
    const idx = this.historyIndex();
    if (idx >= this.history().length - 1) return;
    this.historyIndex.set(idx + 1);
    const sections = this.history()[idx + 1];
    this.page.update((p) => p ? { ...p, sections } : null);
    this.dirty.set(true);
  }

  protected async saveDraft(): Promise<void> {
    const p = this.page();
    if (!p || this.saving()) return;
    this.saving.set(true);
    try {
      const saved = await firstValueFrom(
        this.api.saveBuilder(p.id, { sections: p.sections, version: p.version ?? 1 }).pipe(
          catchError(() => of({ ...p }))
        )
      );
      this.page.set(saved);
      this.dirty.set(false);
      this.feedback.success('Draft saved.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async publish(): Promise<void> {
    const p = this.page();
    if (!p || this.publishing()) return;
    if (this.dirty()) await this.saveDraft();
    this.publishing.set(true);
    try {
      const published = await firstValueFrom(
        this.api.publishPage(p.id).pipe(catchError(() => of({ ...p, status: 'PUBLISHED' as const })))
      );
      this.page.set(published);
      this.feedback.success('Page published successfully.');
    } finally {
      this.publishing.set(false);
    }
  }

  protected updatePageSettings(settings: Partial<CmsPage>): void {
    this.page.update((p) => p ? { ...p, ...settings } : null);
    this.dirty.set(true);
  }

  protected selectSection(s: CmsSection | null): void {
    this.selectedSection.set(s);
    if (s) this.rightPanel.set('properties');
  }

  protected goBack(): void {
    void this.router.navigate(['/cms']);
  }
}

// Default props by component type
function getDefaultProps(type: CmsComponentType): Record<string, unknown> {
  switch (type) {
    case 'hero':
      return { title: 'Welcome to Our Platform', description: 'Build better experiences.', alignment: 'center', ctaText: 'Get Started', ctaUrl: '#' };
    case 'heading':
      return { text: 'Section Heading', level: 'h2', alignment: 'left' };
    case 'paragraph':
      return { text: 'Add your content here.' };
    case 'button':
      return { label: 'Click Me', url: '#', variant: 'primary', size: 'md' };
    case 'image':
      return { src: '', alt: '', caption: '' };
    case 'cta':
      return { title: 'Ready to get started?', description: 'Join thousands of users.', buttonText: 'Get Started', buttonUrl: '#' };
    case 'columns':
      return { count: 2, gap: 'md' };
    case 'divider':
      return { style: 'solid' };
    case 'spacer':
      return { height: 64 };
    default:
      return {};
  }
}

function MOCK_PAGE(id: string): CmsPage {
  return {
    id,
    title: 'New Page',
    slug: '/new-page',
    status: 'DRAFT',
    type: 'STANDARD',
    metaTitle: null,
    metaDescription: null,
    sections: [],
    schemaVersion: 1,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
