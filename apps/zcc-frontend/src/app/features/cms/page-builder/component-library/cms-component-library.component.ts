import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { CmsComponentType } from '../../../../shared/models';

interface ComponentDef {
  type: CmsComponentType;
  label: string;
  icon: string;
}

interface ComponentGroup {
  label: string;
  items: ComponentDef[];
  expanded: boolean;
}

const LIBRARY: ComponentGroup[] = [
  {
    label: 'Layout',
    expanded: true,
    items: [
      { type: 'container', label: 'Container', icon: 'pi-box' },
      { type: 'section', label: 'Section', icon: 'pi-th-large' },
      { type: 'columns', label: 'Columns', icon: 'pi-table' },
      { type: 'grid', label: 'Grid', icon: 'pi-objects-column' },
      { type: 'stack', label: 'Stack', icon: 'pi-align-justify' },
      { type: 'divider', label: 'Divider', icon: 'pi-minus' },
      { type: 'spacer', label: 'Spacer', icon: 'pi-arrows-v' },
    ],
  },
  {
    label: 'Content',
    expanded: true,
    items: [
      { type: 'heading', label: 'Heading', icon: 'pi-bold' },
      { type: 'paragraph', label: 'Paragraph', icon: 'pi-align-left' },
      { type: 'rich-text', label: 'Rich Text', icon: 'pi-file-edit' },
      { type: 'image', label: 'Image', icon: 'pi-image' },
      { type: 'video', label: 'Video', icon: 'pi-video' },
      { type: 'button', label: 'Button', icon: 'pi-stop' },
      { type: 'icon', label: 'Icon', icon: 'pi-star' },
      { type: 'link', label: 'Link', icon: 'pi-link' },
    ],
  },
  {
    label: 'Marketing',
    expanded: false,
    items: [
      { type: 'hero', label: 'Hero', icon: 'pi-sparkles' },
      { type: 'cta', label: 'CTA', icon: 'pi-megaphone' },
      { type: 'feature-grid', label: 'Feature Grid', icon: 'pi-th-large' },
      { type: 'stats', label: 'Stats', icon: 'pi-chart-bar' },
      { type: 'logo-cloud', label: 'Logo Cloud', icon: 'pi-building' },
      { type: 'testimonials', label: 'Testimonials', icon: 'pi-comments' },
      { type: 'faq', label: 'FAQ', icon: 'pi-question-circle' },
      { type: 'pricing', label: 'Pricing', icon: 'pi-tag' },
      { type: 'banner', label: 'Banner', icon: 'pi-flag' },
    ],
  },
  {
    label: 'Navigation',
    expanded: false,
    items: [
      { type: 'header', label: 'Header', icon: 'pi-bars' },
      { type: 'navbar', label: 'Navbar', icon: 'pi-align-center' },
      { type: 'breadcrumb', label: 'Breadcrumb', icon: 'pi-angle-double-right' },
      { type: 'tabs', label: 'Tabs', icon: 'pi-window-maximize' },
      { type: 'footer', label: 'Footer', icon: 'pi-align-justify' },
    ],
  },
  {
    label: 'Data',
    expanded: false,
    items: [
      { type: 'table', label: 'Table', icon: 'pi-table' },
      { type: 'card', label: 'Card', icon: 'pi-id-card' },
      { type: 'list', label: 'List', icon: 'pi-list' },
      { type: 'badge', label: 'Badge', icon: 'pi-tag' },
    ],
  },
  {
    label: 'Forms',
    expanded: false,
    items: [
      { type: 'form', label: 'Form', icon: 'pi-file-edit' },
      { type: 'input', label: 'Input', icon: 'pi-pencil' },
      { type: 'textarea', label: 'Textarea', icon: 'pi-align-left' },
      { type: 'select', label: 'Select', icon: 'pi-chevron-down' },
      { type: 'checkbox', label: 'Checkbox', icon: 'pi-check-square' },
      { type: 'radio', label: 'Radio', icon: 'pi-circle' },
      { type: 'file-upload', label: 'File Upload', icon: 'pi-upload' },
      { type: 'submit-button', label: 'Submit', icon: 'pi-send' },
    ],
  },
];

@Component({
  selector: 'app-cms-component-library',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cms-component-library.component.html',
  styleUrl: './cms-component-library.component.scss',
})
export class CmsComponentLibraryComponent {
  readonly add = output<CmsComponentType>();

  protected readonly groups = signal<ComponentGroup[]>(LIBRARY.map((g) => ({ ...g, items: [...g.items] })));
  protected readonly search = signal('');

  protected readonly filteredGroups = () => {
    const q = this.search().toLowerCase();
    if (!q) return this.groups();
    return this.groups()
      .map((g) => ({
        ...g,
        expanded: true,
        items: g.items.filter((i) => i.label.toLowerCase().includes(q) || i.type.includes(q)),
      }))
      .filter((g) => g.items.length > 0);
  };

  protected toggleGroup(label: string): void {
    this.groups.update((gs) =>
      gs.map((g) => (g.label === label ? { ...g, expanded: !g.expanded } : g))
    );
  }

  protected addComponent(type: CmsComponentType): void {
    this.add.emit(type);
  }

  protected onSearch(e: Event): void {
    this.search.set((e.target as HTMLInputElement).value);
  }
}
