import type { Config } from 'tailwindcss';
import { brand } from './src/lib/brand';

export default {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
        display: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-literata)', 'Georgia', 'serif'],
      },
      colors: {
        ucu: {
          blue: brand.blue,
          green: brand.green,
          yellow: brand.yellow,
          magenta: brand.magenta,
          dark: brand.dark,
          gray: brand.gray,
          nav: brand.nav,
          light: brand.light,
        },
      },
      boxShadow: {
        ucu: '0 1px 3px oklch(32% 0.012 245 / 0.06), 0 4px 16px oklch(32% 0.012 245 / 0.04)',
        'ucu-md': '0 2px 8px oklch(32% 0.012 245 / 0.08), 0 8px 24px oklch(32% 0.012 245 / 0.06)',
        'ucu-lg': '0 4px 12px oklch(32% 0.012 245 / 0.1), 0 16px 40px oklch(32% 0.012 245 / 0.08)',
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
} satisfies Config;
