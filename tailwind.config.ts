import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS v4 Configuration
 *
 * Most design tokens are defined in src/styles/globals.css via @theme.
 * This file provides supplementary configuration for features that
 * cannot be expressed in CSS @theme blocks.
 *
 * Breakpoints (compact, standard, full) and all colors/spacing/typography
 * are defined in the @theme block in globals.css.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
} satisfies Config;
