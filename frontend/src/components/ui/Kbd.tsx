import type { ComponentProps } from '@solidjs/web';
import { type VariantProps, cva } from 'class-variance-authority';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export const kbdVariants = cva(
  'inline-flex items-center justify-center font-mono font-bold uppercase rounded-sm border select-none transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-surface-2 text-accent-primary-hover border-border-default shadow-inner',
        glow: 'bg-accent-primary/10 text-accent-primary border-accent-primary/40 shadow-glow-cyan-sm',
        outline: 'bg-transparent text-text-muted border-border-strong/30',
      },
      size: {
        sm: 'h-5 min-w-[20px] px-1 text-[10px]',
        default: 'h-6 min-w-[24px] px-2 text-xs',
        lg: 'h-8 min-w-[32px] px-2 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export type KbdProps = ComponentProps<'kbd'> & VariantProps<typeof kbdVariants>;

export const Kbd: Component<KbdProps> = (props) => {
  const rest = omit(props, 'variant', 'size', 'class');

  return (
    <kbd
      class={cn(
        kbdVariants({ variant: props.variant, size: props.size }),
        props.class,
      )}
      {...rest}
    />
  );
};
