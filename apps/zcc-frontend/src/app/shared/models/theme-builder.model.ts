/** Fonts the backend accepts (apps/backend/src/modules/themes/theme.dto.ts THEME_FONTS). */
export const THEME_FONTS = [
  'Outfit',
  'Inter',
  'Roboto',
  'Poppins',
  'Montserrat',
  'Source Sans 3',
  'IBM Plex Sans',
  'System',
] as const;
export type ThemeFont = (typeof THEME_FONTS)[number];
export type ThemeMode = 'light' | 'dark';

export interface Theme {
  /** null for the built-in default theme. */
  id: string | null;
  name: string;
  description: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: ThemeFont;
  borderRadius: number;
  mode: ThemeMode;
  logoUrl: string | null;
  faviconUrl: string | null;
  isActive: boolean;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SaveThemeRequest {
  name: string;
  description: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: ThemeFont;
  borderRadius: number;
  mode: ThemeMode;
  logoUrl: string | null;
  faviconUrl: string | null;
  /** Loaded version, so concurrent edits are rejected instead of overwritten. */
  version?: number;
}
