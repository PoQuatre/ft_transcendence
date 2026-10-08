import type { ComponentProps } from '@solidjs/web';
import { type VariantProps, cva } from 'class-variance-authority';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export const kbdVariants = cva(
  'inline-flex items-center justify-center font-mono font-bold uppercase rounded border select-none transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-surface-container-high text-primary-fixed border-surface-container-highest shadow-inner',
        glow: 'bg-primary-container/10 text-primary-container border-primary-container/40 shadow-[0_0_8px_rgba(0,240,255,0.25)]',
        outline: 'bg-transparent text-outline border-outline/30',
      },
      size: {
        sm: 'h-5 min-w-[20px] px-1 text-[10px]',
        default: 'h-6 min-w-[24px] px-1.5 text-xs',
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
