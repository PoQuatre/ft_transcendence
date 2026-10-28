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
          'bg-surface-1/70 backdrop-blur-xl border border-border-subtle/60 shadow-xl',
        glow: 'bg-surface-1/70 backdrop-blur-xl border border-accent-primary/30 shadow-glow-cyan-ambient',
        interactive:
          'bg-surface-1/70 hover:bg-surface-2/80 backdrop-blur-xl border border-border-subtle/50 hover:border-accent-primary/50 shadow-xl cursor-pointer',
        chamfer:
          'bg-surface-1/70 backdrop-blur-xl border border-border-subtle/60 clip-chamfer shadow-xl',
        panel: 'min-w-0 rounded-lg border border-border-subtle bg-surface-1',
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
