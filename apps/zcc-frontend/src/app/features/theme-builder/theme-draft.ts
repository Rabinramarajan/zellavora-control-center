import {
  SaveThemeRequest,
  THEME_FONTS,
  Theme,
  ThemeFont,
  ThemeMode,
} from '../../shared/models/theme-builder.model';
import { BRAND_SHADES, brandPalette, isHexColor } from '../../shared/utils/brand-palette';
import { fontStack } from '../../core/theme/theme-runtime.service';

/** Everything the Theme Builder edits; mirrors SaveThemeRequest with non-null strings. */
export interface ThemeDraft {
  name: string;
  description: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  infoColor: string;
  backgroundColor: string;
  surfaceColor: string;
  fontFamily: ThemeFont;
  fontSize: number;
  borderRadius: number;
  spacing: number;
  mode: ThemeMode;
  logoUrl: string;
  faviconUrl: string;
}

export type ColorKey =
  | 'primaryColor'
  | 'secondaryColor'
  | 'accentColor'
  | 'successColor'
  | 'warningColor'
  | 'errorColor'
  | 'infoColor'
  | 'backgroundColor'
  | 'surfaceColor';

export const COLOR_KEYS: readonly ColorKey[] = [
  'primaryColor',
  'secondaryColor',
  'accentColor',
  'successColor',
  'warningColor',
  'errorColor',
  'infoColor',
  'backgroundColor',
  'surfaceColor',
];

/** The built-in Zellavora look (kept in step with the backend DEFAULT_THEME). */
export const DEFAULT_DRAFT: ThemeDraft = {
  name: 'Organization Theme',
  description: '',
  primaryColor: '#6366F1',
  secondaryColor: '#EC4899',
  accentColor: '#0EA5E9',
  successColor: '#10B981',
  warningColor: '#F59E0B',
  errorColor: '#EF4444',
  infoColor: '#3B82F6',
  backgroundColor: '#0F172A',
  surfaceColor: '#1E293B',
  fontFamily: 'Inter',
  fontSize: 16,
  borderRadius: 8,
  spacing: 4,
  mode: 'dark',
  logoUrl: '',
  faviconUrl: '',
};

export const FONT_SIZES = [
  { value: '14', label: 'Small (14px)' },
  { value: '15', label: 'Compact (15px)' },
  { value: '16', label: 'Medium (16px)' },
  { value: '17', label: 'Comfortable (17px)' },
  { value: '18', label: 'Large (18px)' },
];

export const toDraft = (t: Theme): ThemeDraft => ({
  name: t.id ? t.name : DEFAULT_DRAFT.name,
  description: t.description ?? '',
  primaryColor: t.primaryColor,
  secondaryColor: t.secondaryColor,
  accentColor: t.accentColor,
  successColor: t.successColor,
  warningColor: t.warningColor,
  errorColor: t.errorColor,
  infoColor: t.infoColor,
  backgroundColor: t.backgroundColor,
  surfaceColor: t.surfaceColor,
  fontFamily: (THEME_FONTS as readonly string[]).includes(t.fontFamily) ? t.fontFamily : 'Inter',
  fontSize: t.fontSize,
  borderRadius: t.borderRadius,
  spacing: t.spacing,
  mode: t.mode,
  logoUrl: t.logoUrl ?? '',
  faviconUrl: t.faviconUrl ?? '',
});

export const toRequest = (d: ThemeDraft, version?: number): SaveThemeRequest => ({
  name: d.name.trim(),
  description: d.description.trim() || null,
  primaryColor: d.primaryColor.toUpperCase(),
  secondaryColor: d.secondaryColor.toUpperCase(),
  accentColor: d.accentColor.toUpperCase(),
  successColor: d.successColor.toUpperCase(),
  warningColor: d.warningColor.toUpperCase(),
  errorColor: d.errorColor.toUpperCase(),
  infoColor: d.infoColor.toUpperCase(),
  backgroundColor: d.backgroundColor.toUpperCase(),
  surfaceColor: d.surfaceColor.toUpperCase(),
  fontFamily: d.fontFamily,
  fontSize: d.fontSize,
  borderRadius: d.borderRadius,
  spacing: d.spacing,
  mode: d.mode,
  logoUrl: d.logoUrl.trim() || null,
  faviconUrl: d.faviconUrl.trim() || null,
  ...(version ? { version } : {}),
});

const httpsOrEmpty = (v: string): boolean => {
  if (!v.trim()) return true;
  try {
    return new URL(v.trim()).protocol === 'https:';
  } catch {
    return false;
  }
};

/** Field → message; empty when the draft can be saved. Mirrors the backend rules. */
export const validateDraft = (d: ThemeDraft): Partial<Record<keyof ThemeDraft, string>> => {
  const errors: Partial<Record<keyof ThemeDraft, string>> = {};
  const name = d.name.trim();
  if (name.length < 2) errors.name = 'Name must be at least 2 characters';
  else if (name.length > 80) errors.name = 'Name must be 80 characters or fewer';
  for (const key of COLOR_KEYS) {
    if (!isHexColor(d[key])) errors[key] = 'Use a 6-digit hex like #4F46E5';
  }
  if (!httpsOrEmpty(d.logoUrl)) errors.logoUrl = 'Use an https:// URL';
  if (!httpsOrEmpty(d.faviconUrl)) errors.faviconUrl = 'Use an https:// URL';
  if (d.description.length > 300) errors.description = 'Keep it under 300 characters';
  return errors;
};

/** A valid colour for rendering even while the user is mid-way through typing a hex. */
export const safeColor = (d: ThemeDraft, key: ColorKey): string =>
  isHexColor(d[key]) ? d[key] : DEFAULT_DRAFT[key];

/** Design tokens as CSS custom properties, used by the live preview and the CSS export. */
export const cssVariables = (d: ThemeDraft): Record<string, string> => {
  const palette = brandPalette(safeColor(d, 'primaryColor'));
  const vars: Record<string, string> = {
    '--tb-primary': safeColor(d, 'primaryColor'),
    '--tb-secondary': safeColor(d, 'secondaryColor'),
    '--tb-accent': safeColor(d, 'accentColor'),
    '--tb-success': safeColor(d, 'successColor'),
    '--tb-warning': safeColor(d, 'warningColor'),
    '--tb-error': safeColor(d, 'errorColor'),
    '--tb-info': safeColor(d, 'infoColor'),
    '--tb-background': safeColor(d, 'backgroundColor'),
    '--tb-surface': safeColor(d, 'surfaceColor'),
    '--tb-font': fontStack(d.fontFamily),
    '--tb-font-size': `${d.fontSize}px`,
    '--tb-radius': `${d.borderRadius}px`,
    '--tb-space': `${d.spacing}px`,
  };
  for (const shade of BRAND_SHADES) vars[`--tb-brand-${shade}`] = `rgb(${palette[shade]})`;
  return vars;
};

export const cssExport = (d: ThemeDraft): string =>
  `:root {\n${Object.entries(cssVariables(d))
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')}\n}\n`;
