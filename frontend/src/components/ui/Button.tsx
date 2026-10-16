import type { ComponentProps } from '@solidjs/web';
import { type VariantProps, cva } from 'class-variance-authority';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold uppercase transition-all duration-200 cursor-pointer disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Variantes solidcn standard
        default: 'bg-accent-primary text-black hover:bg-accent-primary/80',
        secondary: 'bg-surface-high text-text-primary hover:bg-surface-highest',
        destructive:
          'bg-accent-secondary text-white hover:bg-accent-secondary/80',
        outline:
          'border border-surface-high bg-transparent hover:bg-surface-high text-text-primary',
        ghost: 'hover:bg-surface-high text-text-primary',
        link: 'text-accent-primary underline-offset-4 hover:underline',
        // Variantes Cyberpunk Rider
        cyan: 'border border-accent-primary text-accent-primary glow-cyan hover:bg-accent-primary hover:text-black clip-chamfer-btn',
        pink: 'border-accent-secondary text-accent-secondary glow-pink hover:bg-accent-secondary hover:text-white clip-chamfer-btn',
      },
      size: {
        default: 'h-10 px-6 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'cyan',
      size: 'default',
    },
  },
);

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants>;

export const Button: Component<ButtonProps> = (props) => {
  // En Solid 2.0, omit retire les clés spécifiques pour le spread du bouton natif
  const rest = omit(props, 'variant', 'size', 'class');

  return (
    <button
      class={cn(
        buttonVariants({ variant: props.variant, size: props.size }),
        props.class,
      )}
      {...rest}
    />
  );
};
