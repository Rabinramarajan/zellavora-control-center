export interface ThemeConfig {
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  borderRadius: number; // in pixels
  spacing: number;      // base spacing multiplier
  isDarkMode: boolean;
}
