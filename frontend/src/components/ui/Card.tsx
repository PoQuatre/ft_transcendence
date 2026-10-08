import type { ComponentProps } from '@solidjs/web';
import { type VariantProps, cva } from 'class-variance-authority';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export const cardVariants = cva(
  'relative overflow-hidden transition-all duration-300',
  {
    variants: {
      variant: {
        default:
          'bg-surface-container/70 backdrop-blur-xl border border-surface-container-high/60 shadow-xl',
        glow: 'bg-surface-container/70 backdrop-blur-xl border border-primary-container/30 shadow-[0_0_20px_rgba(0,240,255,0.15)]',
        interactive:
          'bg-surface-container/70 hover:bg-surface-container-high/80 backdrop-blur-xl border border-surface-container-high/50 hover:border-primary-container/50 shadow-xl cursor-pointer',
        chamfer:
          'bg-surface-container/70 backdrop-blur-xl border border-surface-container-high/60 clip-chamfer shadow-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type CardProps = ComponentProps<'div'> &
  VariantProps<typeof cardVariants>;

export const Card: Component<CardProps> = (props) => {
  const rest = omit(props, 'variant', 'class');

  return (
    <div
      class={cn(cardVariants({ variant: props.variant }), props.class)}
      {...rest}
    />
  );
};
