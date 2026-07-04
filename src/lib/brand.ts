export const brand = {
  blue: '#0066B3',
  green: '#8BC53F',
  yellow: '#FDB913',
  magenta: '#E6007E',
  dark: '#3A3A3A',
  gray: '#6B6B6B',
  nav: '#2B2B2B',
  light: '#F5F5F5',
} as const;

/** OKLCH tokens — perceptually uniform, neutrals tinted toward brand blue */
export const tokens = {
  surface: 'oklch(98.5% 0.006 245)',
  surfaceRaised: 'oklch(100% 0 0)',
  surfaceMuted: 'oklch(96% 0.008 245)',
  ink: 'oklch(32% 0.012 245)',
  inkMuted: 'oklch(52% 0.015 245)',
  inkFaint: 'oklch(68% 0.012 245)',
  border: 'oklch(90% 0.01 245)',
  borderStrong: 'oklch(82% 0.015 245)',
  blue: 'oklch(52% 0.14 245)',
  blueHover: 'oklch(42% 0.12 245)',
  green: 'oklch(74% 0.17 130)',
  greenHover: 'oklch(62% 0.15 130)',
  yellow: 'oklch(82% 0.16 85)',
  magenta: 'oklch(57% 0.24 350)',
  magentaHover: 'oklch(48% 0.22 350)',
  nav: 'oklch(26% 0.012 245)',
} as const;
