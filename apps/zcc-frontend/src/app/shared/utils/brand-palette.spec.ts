import { brandPalette, contrastRatio, hexToRgb, isHexColor } from './brand-palette';

describe('brand-palette', () => {
  it('validates 6-digit hex colours only', () => {
    expect(isHexColor('#4F46E5')).toBeTrue();
    expect(isHexColor('#fff')).toBeFalse();
    expect(isHexColor('blue')).toBeFalse();
  });

  it('converts hex to RGB', () => {
    expect(hexToRgb('#6366F1')).toEqual([99, 102, 241]);
  });

  it('keeps the base colour at 500 and lightens / darkens around it', () => {
    const p = brandPalette('#6366F1');
    expect(p[500]).toBe('99 102 241');
    const lum = (s: string) => s.split(' ').map(Number).reduce((a, b) => a + b, 0);
    expect(lum(p[50])).toBeGreaterThan(lum(p[300]));
    expect(lum(p[300])).toBeGreaterThan(lum(p[500]));
    expect(lum(p[500])).toBeGreaterThan(lum(p[900]));
  });

  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
    expect(contrastRatio('#FFFFFF', '#4F46E5')).toBeGreaterThan(4.5);
  });
});
