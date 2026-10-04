import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { ThemesApiService } from '../../core/api/themes.api';
import { PermissionService } from '../../core/rbac/services/permission.service';
import { THEME_FONTS, Theme, ThemeFont, ThemeMode } from '../../shared/models/theme-builder.model';
import { contrastRatio } from '../../shared/utils/brand-palette';
import { EmptyStateComponent } from '../../shared/components/iam';
import { IamDialogsService } from '../iam/shared/iam-dialogs.service';
import { IamFeedbackService, errorMessage } from '../iam/shared/iam-feedback.service';
import { formatDateTime } from '../iam/shared/iam-format';
import { ColorFieldComponent } from './components/color-field.component';
import {
  PreviewDevice,
  PreviewVariant,
  ThemePreviewComponent,
} from './components/theme-preview.component';
import {
  COLOR_KEYS,
  ColorKey,
  DEFAULT_DRAFT,
  FONT_SIZES,
  ThemeDraft,
  cssExport,
  safeColor,
  toDraft,
  toRequest,
  validateDraft,
} from './theme-draft';
import { ensureFontLoaded, ThemeRuntimeService } from '../../core/services/theme/theme-runtime.service';

type TabKey = 'colors' | 'branding' | 'layout' | 'components' | 'export';

interface TabDef {
  key: TabKey;
  label: string;
  icon: string;
}

const TABS: TabDef[] = [
  { key: 'colors', label: 'Colors & Typography', icon: 'pi pi-pencil' },
  { key: 'branding', label: 'Branding', icon: 'pi pi-image' },
  { key: 'layout', label: 'Layout', icon: 'pi pi-th-large' },
  { key: 'components', label: 'Components', icon: 'pi pi-box' },
  { key: 'export', label: 'Preview & Export', icon: 'pi pi-upload' },
];

const DEVICES: Array<{ key: PreviewDevice; label: string; icon: string }> = [
  { key: 'desktop', label: 'Desktop', icon: 'pi pi-desktop' },
  { key: 'laptop', label: 'Laptop', icon: 'pi pi-tablet' },
  { key: 'tablet', label: 'Tablet', icon: 'pi pi-tablet' },
  { key: 'mobile', label: 'Mobile', icon: 'pi pi-mobile' },
];

const EXTENDED: Array<{ key: ColorKey; label: string }> = [
  { key: 'successColor', label: 'Success' },
  { key: 'warningColor', label: 'Warning' },
  { key: 'errorColor', label: 'Error' },
  { key: 'infoColor', label: 'Info' },
  { key: 'backgroundColor', label: 'Background' },
  { key: 'surfaceColor', label: 'Surface' },
];

/** Exported/imported theme files are versioned so future formats can stay readable. */
const EXPORT_FORMAT = 'zcc-theme@1';

@Component({
  selector: 'app-theme-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    FormInputControl,
    SelectControl,
    EmptyStateComponent,
    ColorFieldComponent,
    ThemePreviewComponent,
  ],
  templateUrl: './theme-builder.component.html',
  styleUrl: './theme-builder.component.scss',
})
export class ThemeBuilderComponent {
  private readonly api = inject(ThemesApiService);
  private readonly runtime = inject(ThemeRuntimeService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);
  private readonly doc = inject(DOCUMENT);
  protected readonly canManage = inject(PermissionService).can('themes:manage');

  protected readonly tabs = TABS;
  protected readonly devices = DEVICES;
  protected readonly extended = EXTENDED;
  protected readonly dateTime = formatDateTime;
  protected readonly fontOptions: SelectControlOption[] = THEME_FONTS.map((f) => ({
    value: f,
    label: f === 'System' ? 'System default' : f,
  }));
  protected readonly fontSizeOptions: SelectControlOption[] = FONT_SIZES;
  protected readonly modeOptions: Array<{ value: ThemeMode; label: string; icon: string }> = [
    { value: 'dark', label: 'Dark', icon: 'pi pi-moon' },
    { value: 'light', label: 'Light', icon: 'pi pi-sun' },
  ];

  protected readonly theme = signal<Theme | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly tab = signal<TabKey>('colors');
  protected readonly device = signal<PreviewDevice>('desktop');
  protected readonly previewMode = signal<ThemeMode | null>(null);

  protected readonly draft = signal<ThemeDraft>({ ...DEFAULT_DRAFT });
  private readonly baseline = signal(JSON.stringify(DEFAULT_DRAFT));

  protected readonly readOnly = computed(() => !this.canManage());
  protected readonly errors = computed(() => validateDraft(this.draft()));
  protected readonly valid = computed(() => Object.keys(this.errors()).length === 0);
  protected readonly dirty = computed(() => JSON.stringify(this.draft()) !== this.baseline());
  protected readonly isDefaultTheme = computed(() => !this.theme()?.id);
  protected readonly previewVariant = computed<PreviewVariant>(() =>
    this.tab() === 'components' ? 'components' : this.tab() === 'export' ? 'page' : 'overview'
  );
  protected readonly contrast = computed(() =>
    contrastRatio('#FFFFFF', safeColor(this.draft(), 'primaryColor'))
  );

  public constructor() {
    void this.load();
    effect(() => ensureFontLoaded(this.doc, this.draft().fontFamily));
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const theme = await firstValueFrom(this.api.active());
      this.theme.set(theme);
      this.setBaseline(toDraft(theme));
    } catch (err) {
      this.loadError.set(errorMessage(err, 'Unable to load the theme.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected retry(): void {
    void this.load();
  }

  private setBaseline(draft: ThemeDraft): void {
    this.draft.set(draft);
    this.baseline.set(JSON.stringify(draft));
  }

  // ---------------------------------------------------------------------------
  // Editing
  // ---------------------------------------------------------------------------

  protected set<K extends keyof ThemeDraft>(key: K, value: ThemeDraft[K]): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected setColor(key: ColorKey, value: string): void {
    this.set(key, value);
  }

  protected setFont(value: string): void {
    if ((THEME_FONTS as readonly string[]).includes(value))
      this.set('fontFamily', value as ThemeFont);
  }

  protected setNumber(key: 'fontSize' | 'borderRadius' | 'spacing', value: string | number): void {
    const n = Number(value);
    if (Number.isFinite(n)) this.set(key, n);
  }

  protected rangeFill(value: number, min: number, max: number): string {
    return `${((value - min) / (max - min)) * 100}%`;
  }

  protected selectTab(key: TabKey): void {
    this.tab.set(key);
  }

  /** Arrow keys, Home and End move between tabs (WAI-ARIA tabs pattern). */
  protected onTabKey(event: KeyboardEvent, index: number): void {
    const last = this.tabs.length - 1;
    const next: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    const target = this.tabs[next[event.key]];
    this.tab.set(target.key);
    this.doc.getElementById(`tb-tab-${target.key}`)?.focus();
  }

  // ---------------------------------------------------------------------------
  // Save / reset
  // ---------------------------------------------------------------------------

  protected async save(): Promise<void> {
    if (!this.valid()) {
      this.feedback.error(null, 'Fix the highlighted fields before saving.');
      return;
    }
    this.saving.set(true);
    try {
      const current = this.theme();
      const saved = await firstValueFrom(
        this.api.saveActive(toRequest(this.draft(), current?.id ? current.version : undefined))
      );
      this.theme.set(saved);
      this.setBaseline(toDraft(saved));
      // Applies to this tab immediately; everyone else gets it on their next page load.
      this.runtime.apply(saved);
      this.feedback.success('Theme saved and applied to your organization.');
    } catch (err) {
      this.feedback.error(err, 'Could not save the theme.');
    } finally {
      this.saving.set(false);
    }
  }

  protected async resetToDefault(): Promise<void> {
    const ok = await this.dialogs.confirm(
      'Reset to default?',
      'All settings return to the built-in Zellavora theme. Nothing changes for others until you save.',
      'Reset'
    );
    if (ok) this.draft.set({ ...DEFAULT_DRAFT, name: this.draft().name });
  }

  protected discard(): void {
    this.draft.set(JSON.parse(this.baseline()) as ThemeDraft);
  }

  /** Used by the route's canDeactivate guard. */
  public canLeave(): boolean | Promise<boolean> {
    if (this.readOnly() || !this.dirty()) return true;
    return this.dialogs.confirm(
      'Discard changes?',
      'You have unsaved theme changes. Leave this page and discard them?',
      'Discard',
      true
    );
  }

  // ---------------------------------------------------------------------------
  // Export / import
  // ---------------------------------------------------------------------------

  protected exportJson(): void {
    const payload = { format: EXPORT_FORMAT, theme: toRequest(this.draft()) };
    this.download(
      `${this.slug()}.theme.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  }

  protected exportCss(): void {
    this.download(`${this.slug()}.css`, cssExport(this.draft()), 'text/css');
  }

  protected async copyCss(): Promise<void> {
    try {
      await navigator.clipboard.writeText(cssExport(this.draft()));
      this.feedback.success('CSS variables copied to the clipboard.');
    } catch {
      this.feedback.error(null, 'Clipboard access was blocked; use Download CSS instead.');
    }
  }

  protected async importJson(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 50_000) {
      this.feedback.error(null, 'That file is too large to be a theme.');
      return;
    }
    try {
      const parsed = JSON.parse(await file.text()) as {
        format?: string;
        theme?: Partial<ThemeDraft>;
      };
      if (parsed.format !== EXPORT_FORMAT || !parsed.theme) throw new Error('format');
      // Only known keys are taken; everything is re-validated before it can be saved.
      const next = { ...this.draft() };
      for (const key of Object.keys(DEFAULT_DRAFT) as Array<keyof ThemeDraft>) {
        const value = parsed.theme[key];
        if (value === undefined || value === null) continue;
        if (typeof value !== typeof DEFAULT_DRAFT[key]) continue;
        (next as Record<string, unknown>)[key] = value;
      }
      this.draft.set(next);
      const invalid = Object.keys(validateDraft(next)).length;
      if (invalid)
        this.feedback.error(null, `Imported with ${invalid} field(s) to fix before saving.`);
      else this.feedback.success('Theme imported. Review it, then save to apply.');
    } catch {
      this.feedback.error(null, 'This is not a Zellavora theme file.');
    }
  }

  protected colorCount(): number {
    return COLOR_KEYS.length;
  }

  private slug(): string {
    return (
      this.draft()
        .name.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'theme'
    );
  }

  private download(filename: string, content: string, type: string): void {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = this.doc.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }
}
