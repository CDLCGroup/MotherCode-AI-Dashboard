// src/theme.ts
// Shared Glass-Metric theme tokens used across all dashboard views.

export interface OrbTheme {
  accent: string;
  accentRGB: string;
  glow: string;
  glowRGB: string;
}

export interface ThemeDef extends OrbTheme {
  id: number;
  label: string;
}

export const THEMES: Record<number, ThemeDef> = {
  1: { id: 1, label: 'A · NEON', accent: '#00ff99', accentRGB: '0,255,153', glow: '#00ccff', glowRGB: '0,204,255' },
  2: { id: 2, label: 'B · ACID', accent: '#bfff00', accentRGB: '191,255,0', glow: '#ff00ff', glowRGB: '255,0,255' },
  3: { id: 3, label: 'C · EMBER', accent: '#ff4500', accentRGB: '255,69,0', glow: '#ffd700', glowRGB: '255,215,0' },
};

export const MONO = "'Fira Code', ui-monospace, SFMono-Regular, Menlo, monospace";
export const SANS = 'Inter, system-ui, sans-serif';

export function getTheme(variant: number): ThemeDef {
  return THEMES[variant] || THEMES[1];
}
