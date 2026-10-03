import { Theme } from '@prisma/client';

export interface ThemeDto {
  id: string | null;
  name: string;
  description: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  successColor: string;
  warningColor: string;
  errorColor: string;
  infoColor: string;
  backgroundColor: string;
  surfaceColor: string;
  fontSize: number;
  spacing: number;
  fontFamily: string;
  borderRadius: number;
  mode: 'light' | 'dark';
  logoUrl: string | null;
  faviconUrl: string | null;
  isActive: boolean;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

/** The look the app ships with; served when an organization has not activated a theme. */
export const DEFAULT_THEME: ThemeDto = {
  id: null,
  name: 'Zellavora Default',
  description: 'Built-in theme used until another theme is activated.',
  primaryColor: '#6366F1',
  secondaryColor: '#8B5CF6',
  accentColor: '#0EA5E9',
  successColor: '#10B981',
  warningColor: '#F59E0B',
  errorColor: '#EF4444',
  infoColor: '#3B82F6',
  backgroundColor: '#0F172A',
  surfaceColor: '#1E293B',
  fontSize: 16,
  spacing: 4,
  fontFamily: 'Outfit',
  borderRadius: 10,
  mode: 'dark',
  logoUrl: null,
  faviconUrl: null,
  isActive: true,
  version: 1,
  createdAt: null,
  updatedAt: null,
};

export const toThemeDto = (t: Theme): ThemeDto => ({
  id: t.id,
  name: t.name,
  description: t.description,
  primaryColor: t.primaryColor ?? DEFAULT_THEME.primaryColor,
  secondaryColor: t.secondaryColor ?? DEFAULT_THEME.secondaryColor,
  accentColor: t.accentColor ?? DEFAULT_THEME.accentColor,
  successColor: t.successColor ?? DEFAULT_THEME.successColor,
  warningColor: t.warningColor ?? DEFAULT_THEME.warningColor,
  errorColor: t.errorColor ?? DEFAULT_THEME.errorColor,
  infoColor: t.infoColor ?? DEFAULT_THEME.infoColor,
  backgroundColor: t.backgroundColor ?? DEFAULT_THEME.backgroundColor,
  surfaceColor: t.surfaceColor ?? DEFAULT_THEME.surfaceColor,
  fontSize: t.fontSize,
  spacing: t.spacing,
  fontFamily: t.fontFamily,
  borderRadius: t.borderRadius,
  mode: t.mode === 'dark' ? 'dark' : 'light',
  logoUrl: t.logoUrl,
  faviconUrl: t.faviconUrl,
  isActive: t.isDefault,
  version: t.version,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});
