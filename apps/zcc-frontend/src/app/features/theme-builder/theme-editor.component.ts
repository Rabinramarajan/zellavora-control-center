import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DOCUMENT } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  FormField,
  FormRoot,
  form,
  maxLength,
  minLength,
  pattern,
  required,
  validate,
} from '@angular/forms/signals';
import { firstValueFrom, map } from 'rxjs';
import { FormInputControl, SelectControl, SelectControlOption } from '@zellavoras/ui';
import { ThemesApiService } from '../../core/api/themes.api';
import { PermissionService } from '../../core/rbac/services/permission.service';
import { ThemeRuntimeService, ensureFontLoaded, fontStack } from '../../core/theme/theme-runtime.service';
import {
  SaveThemeRequest,
  THEME_FONTS,
  Theme,
  ThemeFont,
  ThemeMode,
} from '../../shared/models/theme-builder.model';
import { BRAND_SHADES, brandPalette, contrastRatio, isHexColor } from '../../shared/utils/brand-palette';
import { EmptyStateComponent, StatusChipComponent } from '../../shared/components/iam';
import { FormDialogService } from '../../shared/components/form-dialog';
import { IAM_BTN, IAM_CARD } from '../iam/shared/iam-page-header.component';
import { IamDialogsService } from '../iam/shared/iam-dialogs.service';
import { IamFeedbackService, errorMessage } from '../iam/shared/iam-feedback.service';
import { formatDateTime } from '../iam/shared/iam-format';

/** Form model; numbers stay strings until save because the inputs are text-based. */
interface ThemeDraft {
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  borderRadius: string;
  mode: string;
  logoUrl: string;
  faviconUrl: string;
}

interface Preset {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const HEX_MESSAGE = 'Use a 6-digit hex colour like #4F46E5';

const PRESETS: Preset[] = [
  { name: 'Indigo', primary: '#6366F1', secondary: '#8B5CF6', accent: '#0EA5E9' },
  { name: 'Ocean', primary: '#0284C7', secondary: '#0F766E', accent: '#F59E0B' },
  { name: 'Emerald', primary: '#059669', secondary: '#0D9488', accent: '#6366F1' },
  { name: 'Sunset', primary: '#EA580C', secondary: '#DB2777', accent: '#FACC15' },
  { name: 'Rose', primary: '#E11D48', secondary: '#9333EA', accent: '#14B8A6' },
  { name: 'Graphite', primary: '#334155', secondary: '#64748B', accent: '#22C55E' },
];

const NEW_DRAFT: ThemeDraft = {
  name: '',
  description: '',
  primaryColor: PRESETS[0].primary,
  secondaryColor: PRESETS[0].secondary,
  accentColor: PRESETS[0].accent,
  fontFamily: 'Outfit',
  borderRadius: '10',
  mode: 'light',
  logoUrl: '',
  faviconUrl: '',
};

const toDraft = (t: Theme): ThemeDraft => ({
  name: t.name,
  description: t.description ?? '',
  primaryColor: t.primaryColor,
  secondaryColor: t.secondaryColor,
  accentColor: t.accentColor,
  fontFamily: t.fontFamily,
  borderRadius: String(t.borderRadius),
  mode: t.mode,
  logoUrl: t.logoUrl ?? '',
  faviconUrl: t.faviconUrl ?? '',
});

const httpsUrl = (value: string): boolean => {
  if (!value) return true;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

@Component({
  selector: 'app-theme-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    FormField,
    FormRoot,
    FormInputControl,
    SelectControl,
    StatusChipComponent,
    EmptyStateComponent,
  ],
  templateUrl: './theme-editor.component.html',
  styleUrl: './theme-editor.component.scss',
})
export class ThemeEditorComponent {
  private readonly api = inject(ThemesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);
  private readonly runtime = inject(ThemeRuntimeService);
  private readonly formDialog = inject(FormDialogService);
  private readonly dialogs = inject(IamDialogsService);
  private readonly feedback = inject(IamFeedbackService);
  protected readonly canManage = inject(PermissionService).can('themes:manage');

  private readonly themeId = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('id') ?? 'new')),
    { initialValue: 'new' }
  );

  protected readonly btn = IAM_BTN;
  protected readonly card = IAM_CARD;
  protected readonly dateTime = formatDateTime;
  protected readonly presets = PRESETS;
  protected readonly fontOptions: SelectControlOption[] = THEME_FONTS.map((f) => ({
    value: f,
    label: f === 'System' ? 'System default' : f,
  }));
  protected readonly modeOptions: SelectControlOption[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  protected readonly theme = signal<Theme | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly busy = signal(false);
  protected readonly previewMode = signal<ThemeMode>('light');

  private readonly model = signal<ThemeDraft>({ ...NEW_DRAFT });
  private readonly baseline = signal<string>(JSON.stringify(NEW_DRAFT));
  /** Set once a save succeeds, so the leave guard does not ask about changes just saved. */
  private justSaved = false;

  protected readonly form = form(
    this.model,
    (p) => {
      required(p.name, { message: 'Enter a theme name' });
      minLength(p.name, 2, { message: 'Name must be at least 2 characters' });
      maxLength(p.name, 80, { message: 'Name must be 80 characters or fewer' });
      maxLength(p.description, 300, { message: 'Keep the description under 300 characters' });
      for (const color of [p.primaryColor, p.secondaryColor, p.accentColor]) {
        required(color, { message: HEX_MESSAGE });
        pattern(color, HEX, { message: HEX_MESSAGE });
      }
      required(p.fontFamily);
      required(p.mode);
      required(p.borderRadius, { message: 'Enter a radius from 0 to 24' });
      validate(p.borderRadius, ({ value }) => {
        const n = Number(value());
        return /^d{1,2}$/.test(value()) && n <= 24
          ? null
          : { kind: 'range', message: 'Enter a whole number from 0 to 24' };
      });
      for (const url of [p.logoUrl, p.faviconUrl]) {
        validate(url, ({ value }) =>
          httpsUrl(value()) ? null : { kind: 'https', message: 'Use an https:// URL' }
        );
      }
    },
    { submission: { action: async () => this.save() } }
  );

  protected readonly isNew = computed(() => this.themeId() === 'new');
  protected readonly readOnly = computed(() => !this.canManage());
  protected readonly dirty = computed(() => JSON.stringify(this.model()) !== this.baseline());
  protected readonly draft = this.model.asReadonly();

  // ---------------------------------------------------------------------------
  // Live preview
  // ---------------------------------------------------------------------------

  private readonly safe = computed(() => {
    const d = this.model();
    const pick = (v: string, fallback: string) => (isHexColor(v) ? v : fallback);
    const radius = Math.min(24, Math.max(0, Number(d.borderRadius) || 0));
    return {
      primary: pick(d.primaryColor, NEW_DRAFT.primaryColor),
      secondary: pick(d.secondaryColor, NEW_DRAFT.secondaryColor),
      accent: pick(d.accentColor, NEW_DRAFT.accentColor),
      font: (THEME_FONTS as readonly string[]).includes(d.fontFamily)
        ? (d.fontFamily as ThemeFont)
        : 'Outfit',
      radius,
    };
  });

  /** CSS variables scoped to the preview pane only; the rest of the app is untouched. */
  protected readonly previewStyle = computed(() => {
    const s = this.safe();
    const palette = brandPalette(s.primary);
    const vars: Record<string, string> = {
      '--pv-secondary': s.secondary,
      '--pv-accent': s.accent,
      '--pv-font': fontStack(s.font),
      '--pv-radius': `${s.radius}px`,
    };
    for (const shade of BRAND_SHADES) vars[`--pv-brand-${shade}`] = `rgb(${palette[shade]})`;
    return vars;
  });

  /** White text on the primary colour (buttons, active nav) must stay readable. */
  protected readonly contrast = computed(() => contrastRatio('#FFFFFF', this.safe().primary));
  protected readonly contrastOk = computed(() => this.contrast() >= 4.5);

  public constructor() {
    effect(() => {
      const id = this.themeId();
      if (id === 'new') this.reset({ ...NEW_DRAFT });
      else void this.load(id);
    });
    // Preview the chosen font for real, not with a fallback.
    effect(() => ensureFontLoaded(this.doc, this.safe().font));
    effect(() => {
      const mode = this.model().mode;
      if (mode === 'light' || mode === 'dark') this.previewMode.set(mode);
    });
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const theme = await firstValueFrom(this.api.get(id));
      this.theme.set(theme);
      this.reset(toDraft(theme));
    } catch (err) {
      this.loadError.set(errorMessage(err, 'Theme not found.'));
    } finally {
      this.loading.set(false);
    }
  }

  private reset(draft: ThemeDraft): void {
    if (this.isNew()) this.theme.set(null);
    this.model.set(draft);
    this.baseline.set(JSON.stringify(draft));
    this.form().reset();
  }

  // ---------------------------------------------------------------------------
  // Editing helpers
  // ---------------------------------------------------------------------------

  protected applyPreset(preset: Preset): void {
    this.model.update((d) => ({
      ...d,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      accentColor: preset.accent,
    }));
  }

  /** The native colour picker writes the same field as the hex text input. */
  protected pickColor(
    key: 'primaryColor' | 'secondaryColor' | 'accentColor',
    event: Event
  ): void {
    const value = (event.target as HTMLInputElement).value.toUpperCase();
    this.model.update((d) => ({ ...d, [key]: value }));
  }

  protected pickerValue(value: string): string {
    return isHexColor(value) ? value : '#000000';
  }

  protected discard(): void {
    const t = this.theme();
    this.model.set(t ? toDraft(t) : { ...NEW_DRAFT });
    this.form().reset();
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  private async save(): Promise<undefined> {
    const d = this.model();
    const body: SaveThemeRequest = {
      name: d.name.trim(),
      description: d.description.trim() || null,
      primaryColor: d.primaryColor.toUpperCase(),
      secondaryColor: d.secondaryColor.toUpperCase(),
      accentColor: d.accentColor.toUpperCase(),
      fontFamily: d.fontFamily as ThemeFont,
      borderRadius: Number(d.borderRadius),
      mode: d.mode as ThemeMode,
      logoUrl: d.logoUrl.trim() || null,
      faviconUrl: d.faviconUrl.trim() || null,
    };
    this.saving.set(true);
    try {
      const current = this.theme();
      const saved = current?.id
        ? await firstValueFrom(this.api.update(current.id, { ...body, version: current.version }))
        : await firstValueFrom(this.api.create(body));
      this.theme.set(saved);
      this.model.set(toDraft(saved));
      this.baseline.set(JSON.stringify(toDraft(saved)));
      // Editing the live theme updates everyone's look, including this tab.
      if (saved.isActive) this.runtime.apply(saved);
      this.feedback.success(current?.id ? 'Theme saved.' : 'Theme created.');
      if (!current?.id) {
        this.justSaved = true;
        await this.router.navigate(['/theme-builder', saved.id], { replaceUrl: true });
        this.justSaved = false;
      }
    } catch (err) {
      this.feedback.error(err, 'Could not save the theme.');
    } finally {
      this.saving.set(false);
    }
    return undefined;
  }

  protected async activate(): Promise<void> {
    const t = this.theme();
    if (!t?.id) return;
    const ok = await this.dialogs.confirm(
      `Activate ${t.name}?`,
      'Everyone in your organization will see this theme the next time a page loads.',
      'Activate'
    );
    if (!ok) return;
    await this.run(async () => {
      const active = await firstValueFrom(this.api.activate(t.id!));
      this.theme.set(active);
      this.runtime.apply(active);
      this.feedback.success(`${active.name} is now the active theme.`);
    });
  }

  protected async duplicate(): Promise<void> {
    const t = this.theme();
    if (!t?.id) return;
    const copy = await this.formDialog.open<Theme>({
      mode: 'create',
      title: { create: `Duplicate ${t.name}` },
      subtitle: { create: 'Creates an inactive copy you can edit freely.' },
      submitText: { create: 'Duplicate' },
      sections: [
        {
          title: 'New Theme',
          fields: [
            {
              key: 'name',
              label: 'Theme Name',
              type: 'text',
              required: true,
              minLength: 2,
              maxLength: 80,
              span: 2,
            },
          ],
        },
      ],
      value: { name: `${t.name} (Copy)`.slice(0, 80) },
      save: (values) => firstValueFrom(this.api.duplicate(t.id!, String(values['name']).trim())),
    });
    if (copy?.id) {
      this.feedback.success(`${copy.name} created.`);
      await this.router.navigate(['/theme-builder', copy.id]);
    }
  }

  protected async remove(): Promise<void> {
    const t = this.theme();
    if (!t?.id) return;
    const ok = await this.dialogs.confirm(
      `Delete ${t.name}?`,
      'This theme will be removed from the library. This cannot be undone.',
      'Delete',
      true
    );
    if (!ok) return;
    await this.run(async () => {
      await firstValueFrom(this.api.remove(t.id!));
      this.justSaved = true;
      this.feedback.success('Theme deleted.');
      await this.router.navigate(['/theme-builder']);
    });
  }

  /** Used by the route's canDeactivate guard. */
  public canLeave(): boolean | Promise<boolean> {
    if (this.justSaved || this.readOnly() || !this.dirty()) return true;
    return this.dialogs.confirm(
      'Discard changes?',
      'You have unsaved theme changes. Leave this page and discard them?',
      'Discard',
      true
    );
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await action();
    } catch (err) {
      this.feedback.error(err);
    } finally {
      this.busy.set(false);
    }
  }
}
