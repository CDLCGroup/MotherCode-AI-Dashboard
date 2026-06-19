// src/theme.ts
// Shared theme tokens, reskinned to the Z.E.R.O. "neural voice interface" palette.
//
// IMPORTANT: accentRGB / glowRGB stay bare "r,g,b" triplets — OrbCanvas interpolates
// them as `rgba(${accentRGB},a)`. Never put an oklch()/hex string in those fields.
// The hex values below are the sRGB conversions of the Z.E.R.O. oklch design tokens.

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

// Three neural palettes. Variant 1 is the Z.E.R.O. cyan default; 2/3 are alt
// neural tints so the palette switcher still does something and the other views
// (History/Schedule/Library/Settings) inherit a coherent accent.
export const THEMES: Record<number, ThemeDef> = {
  1: { id: 1, label: 'I · ZERO', accent: '#00dad1', accentRGB: '0,218,209', glow: '#00caff', glowRGB: '0,202,255' },
  2: { id: 2, label: 'II · SYNAPSE', accent: '#d36dea', accentRGB: '211,109,234', glow: '#b675ff', glowRGB: '182,117,255' },
  3: { id: 3, label: 'III · EMBER', accent: '#ff9100', accentRGB: '255,145,0', glow: '#ff5200', glowRGB: '255,82,0' },
};

// Z.E.R.O. core surface tokens (sRGB conversions of the design's oklch values).
export const ZERO = {
  bg: '#04070f', // --background
  bgRGB: '4,7,15',
  card: '#070d18', // --card
  cardRGB: '7,13,24',
  fg: '#e7f1f1', // --foreground
  muted: '#7c949c', // --muted-foreground
  border: 'rgba(22,50,62,0.6)', // --border
  borderSolid: '#16323e',
  danger: '#ff2335', // --destructive
  dangerRGB: '255,35,53',
};

// Surface palette for the dashboard chrome (rails / header / panels / footer).
// Dark is the Z.E.R.O. default (identical to ZERO above); light is an inverted
// near-white variant. The center neural canvas stays dark in both modes.
export interface Surface {
  bg: string;
  bgRGB: string;
  card: string;
  cardRGB: string;
  fg: string;
  muted: string;
  border: string;
  borderSolid: string;
  danger: string;
  dangerRGB: string;
  chromeAlpha: number; // panel background opacity over the time-of-day backdrop
}

const DARK_SURFACE: Surface = { ...ZERO, chromeAlpha: 0.82 };
const LIGHT_SURFACE: Surface = {
  bg: '#dfe7ea',
  bgRGB: '223,231,234',
  card: '#eef3f5',
  cardRGB: '238,243,245',
  fg: '#0b1c22',
  muted: '#5d7681',
  border: 'rgba(120,150,160,0.45)',
  borderSolid: '#bccdd3',
  danger: '#d11526',
  dangerRGB: '209,21,38',
  chromeAlpha: 0.94,
};

export function getSurface(dark: boolean): Surface {
  return dark ? DARK_SURFACE : LIGHT_SURFACE;
}

// Brain-region identity colors (the cortex palette). Center nodes + the cortex
// map cycle through these so each agent domain gets a stable region color.
export interface Region {
  name: string;
  color: string;
  rgb: string;
}
export const REGIONS: Region[] = [
  { name: 'PREFRONTAL', color: '#b675ff', rgb: '182,117,255' },
  { name: 'SENSORY CORTEX', color: '#00caff', rgb: '0,202,255' },
  { name: 'FEATURE LAYER', color: '#00d7ce', rgb: '0,215,206' },
  { name: 'CONCEPT LAYER', color: '#ff9100', rgb: '255,145,0' },
  { name: 'HIPPOCAMPUS', color: '#51d75e', rgb: '81,215,94' },
  { name: 'LANGUAGE', color: '#3e89ff', rgb: '62,137,255' },
  { name: 'MOTOR CORTEX', color: '#ff2335', rgb: '255,35,53' },
  { name: 'ASSOCIATION', color: '#ff66c1', rgb: '255,102,193' },
  { name: 'BRAINSTEM', color: '#ff5200', rgb: '255,82,0' },
];

// Stable region for a given agent domain (by position in the domain list).
export function regionFor(index: number): Region {
  return REGIONS[index % REGIONS.length];
}

export const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
export const SANS = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

export function getTheme(variant: number): ThemeDef {
  return THEMES[variant] || THEMES[1];
}
