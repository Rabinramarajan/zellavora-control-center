/** Tailwind shade steps the brand palette provides. */
export const BRAND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type BrandShade = (typeof BRAND_SHADES)[number];

/** How far each shade moves from the base colour: towards white (+) or black (-). */
const MIX: Record<BrandShade, number> = {
  50: 0.94,
  100: 0.87,
  200: 0.74,
  300: 0.55,
  400: 0.3,
  500: 0,
  600: -0.15,
  700: -0.3,
  800: -0.45,
  900: -0.58,
  950: -0.74,
};

type Rgb = [number, number, number];

export const isHexColor = (value: string): boolean => /^#[0-9a-fA-F]{6}$/.test(value.trim());

export const hexToRgb = (hex: string): Rgb => {
  const n = parseInt(hex.trim().slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const mix = ([r, g, b]: Rgb, amount: number): Rgb => {
  const target = amount >= 0 ? 255 : 0;
  const t = Math.abs(amount);
  return [r, g, b].map((c) => Math.round(c + (target - c) * t)) as Rgb;
};

/** `{ 500: '79 70 229', … }` — space-separated RGB, the form Tailwind's `<alpha-value>` expects. */
export const brandPalette = (hex: string): Record<BrandShade, string> => {
  const base = hexToRgb(hex);
  return Object.fromEntries(
    BRAND_SHADES.map((shade) => [shade, mix(base, MIX[shade]).join(' ')])
  ) as Record<BrandShade, string>;
};

/** WCAG relative luminance (0 = black, 1 = white). */
export const luminance = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two colours, from 1 to 21. */
export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
};
