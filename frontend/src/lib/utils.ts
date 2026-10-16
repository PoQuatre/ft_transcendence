import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Tokens typographiques du design system (App.css, @theme --text-* et
// --font-*). Sans cette déclaration, tailwind-merge prend text-label-data
// pour une couleur et l'écrase dès qu'une classe text-<couleur> suit.
const FONT_SIZES = [
  'display-hero',
  'display-hero-mobile',
  'headline-xl',
  'headline-xl-mobile',
  'headline-md',
  'body-lg',
  'body-sm',
  'label-mono-caps',
  'label-data',
  'stat-counter',
];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: FONT_SIZES }],
      'font-family': [{ font: ['sans', 'mono', ...FONT_SIZES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
