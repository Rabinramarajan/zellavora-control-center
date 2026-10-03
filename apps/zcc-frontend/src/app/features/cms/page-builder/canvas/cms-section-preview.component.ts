import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CmsSection } from '../../../../shared/models';

@Component({
  selector: 'app-cms-section-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-wrap" [attr.data-type]="section().type">
      @switch (section().type) {
        @case ('hero') {
          <div class="preview-hero">
            <p class="preview-hero-title">{{ getProp('title', 'Hero Title') }}</p>
            <p class="preview-hero-desc">{{ getProp('description', 'Hero description text goes here.') }}</p>
            @if (getProp('ctaText')) {
              <span class="preview-hero-btn">{{ getProp('ctaText') }}</span>
            }
          </div>
        }
        @case ('heading') {
          <p class="preview-heading" [attr.data-level]="getProp('level', 'h2')">{{ getProp('text', 'Heading Text') }}</p>
        }
        @case ('paragraph') {
          <p class="preview-para">{{ getProp('text', 'Paragraph text goes here.') }}</p>
        }
        @case ('button') {
          <span class="preview-btn" [attr.data-variant]="getProp('variant', 'primary')">{{ getProp('label', 'Button') }}</span>
        }
        @case ('image') {
          <div class="preview-image-placeholder">
            <i class="pi pi-image" aria-hidden="true"></i>
            @if (getProp('alt')) { <span>{{ getProp('alt') }}</span> }
          </div>
        }
        @case ('cta') {
          <div class="preview-cta">
            <p class="preview-cta-title">{{ getProp('title', 'Call to Action') }}</p>
            <span class="preview-btn" data-variant="primary">{{ getProp('buttonText', 'Get Started') }}</span>
          </div>
        }
        @case ('divider') {
          <hr class="preview-divider" />
        }
        @case ('spacer') {
          <div class="preview-spacer" [style.height.px]="getNumProp('height', 48)"></div>
        }
        @case ('columns') {
          <div class="preview-columns" [attr.data-count]="getNumProp('count', 2)">
            @for (col of getColumns(); track $index) {
              <div class="preview-column">Column {{ $index + 1 }}</div>
            }
          </div>
        }
        @default {
          <div class="preview-generic">
            <i class="pi pi-box" aria-hidden="true"></i>
            <span>{{ section().type }}</span>
          </div>
        }
      }
    </div>
  `,
  styleUrl: './cms-section-preview.component.scss',
})
export class CmsSectionPreviewComponent {
  readonly section = input.required<CmsSection>();

  protected getProp(key: string, fallback: string = ''): string {
    return (this.section().props?.[key] as string) ?? fallback;
  }

  protected getNumProp(key: string, fallback: number = 0): number {
    return (this.section().props?.[key] as number) ?? fallback;
  }

  protected getColumns(): number[] {
    const count = this.getNumProp('count', 2);
    return Array.from({ length: count }, (_, i) => i);
  }
}
