import { MAGAZINE_VISUAL_PALETTES, type MagazineVisualPaletteKey } from './magazineVisualTaxonomy';
import type { MagazineVisualContrastMode } from './magazineVisualSchemas';

function normalizeHex(hex: string): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) return clean.split('').map((c) => c + c).join('');
  return clean.padEnd(6, '0').slice(0, 6);
}

function hexToRgb(hex: string) {
  const clean = normalizeHex(hex);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function srgbToLinear(value: number) {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  return 0.2126 * srgbToLinear(rgb.r) + 0.7152 * srgbToLinear(rgb.g) + 0.0722 * srgbToLinear(rgb.b);
}

export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

export function safeTextColor(background: string): '#0C0D0A' | '#F2F1E8' {
  const darkRatio = contrastRatio('#0C0D0A', background);
  const lightRatio = contrastRatio('#F2F1E8', background);
  return darkRatio >= lightRatio ? '#0C0D0A' : '#F2F1E8';
}

export function contrastModeForPalette(palette: MagazineVisualPaletteKey): MagazineVisualContrastMode {
  const token = MAGAZINE_VISUAL_PALETTES[palette];
  const foregroundRatio = contrastRatio(token.foreground, token.background);
  if (foregroundRatio >= 4.5) return token.contrast as MagazineVisualContrastMode;
  return safeTextColor(token.background) === '#F2F1E8' ? 'dark' : 'light';
}

export function buildContrastSafePalette(palette: MagazineVisualPaletteKey) {
  const token = MAGAZINE_VISUAL_PALETTES[palette];
  const foreground = contrastRatio(token.foreground, token.background) >= 4.5
    ? token.foreground
    : safeTextColor(token.background);
  return {
    ...token,
    foreground,
    contrastRatio: contrastRatio(foreground, token.background),
    contrastMode: contrastModeForPalette(palette),
  };
}
