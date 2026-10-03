import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ThemeMode } from '../../../shared/models/theme-builder.model';
import { ThemeDraft, cssVariables } from '../theme-draft';

export type PreviewDevice = 'desktop' | 'laptop' | 'tablet' | 'mobile';
export type PreviewVariant = 'overview' | 'components' | 'page';

/** Width the preview frame is constrained to for each device. */
export const DEVICE_WIDTH: Record<PreviewDevice, string> = {
  desktop: '100%',
  laptop: '880px',
  tablet: '700px',
  mobile: '380px',
};

interface Row {
  name: string;
  status: 'Active' | 'Pending' | 'Inactive';
  role: string;
}

/**
 * Sample interface rendered purely from the draft's design tokens (scoped CSS variables),
 * so editing never touches the rest of the app until the theme is saved.
 */
@Component({
  selector: 'app-theme-preview',
  standalone: true,
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './theme-preview.component.html',
  styleUrl: './theme-preview.component.scss',
})
export class ThemePreviewComponent {
  public readonly draft = input.required<ThemeDraft>();
  public readonly device = input<PreviewDevice>('desktop');
  public readonly variant = input<PreviewVariant>('overview');
  /** Overrides the theme's default mode, e.g. to compare light and dark. */
  public readonly mode = input<ThemeMode | null>(null);

  protected readonly style = computed(() => cssVariables(this.draft()));
  protected readonly resolvedMode = computed(() => this.mode() ?? this.draft().mode);
  protected readonly width = computed(() => DEVICE_WIDTH[this.device()]);
  protected readonly compact = computed(() => this.device() === 'mobile');

  protected readonly rows: Row[] = [
    { name: 'Rabin R', status: 'Active', role: 'Administrator' },
    { name: 'Arun Kumar', status: 'Pending', role: 'Editor' },
    { name: 'Priya Sharma', status: 'Inactive', role: 'Viewer' },
  ];
}
