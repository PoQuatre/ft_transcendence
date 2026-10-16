import type { ComponentProps } from '@solidjs/web';
import { type VariantProps, cva } from 'class-variance-authority';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export const alertVariants = cva(
  'relative w-full rounded-xl p-space-md border backdrop-blur-md flex items-start gap-space-sm',
  {
    variants: {
      variant: {
        default:
          'bg-surface-container/70 border-surface-container-high/60 text-on-surface',
        cyan: 'bg-primary-container/10 border-primary-container/40 text-primary shadow-glow-cyan-sm',
        destructive:
          'bg-error-container/20 border-error/40 text-error shadow-glow-pink-sm',
        warning: 'bg-neon-amber/10 border-neon-amber/40 text-neon-amber',
        success: 'bg-neon-green/10 border-neon-green/40 text-neon-green',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export type AlertProps = ComponentProps<'div'> &
  VariantProps<typeof alertVariants>;

export const Alert: Component<AlertProps> = (props) => {
  const rest = omit(props, 'variant', 'class');
  return (
    <div
      role="alert"
      class={cn(alertVariants({ variant: props.variant }), props.class)}
      {...rest}
    />
  );
};

export const AlertTitle: Component<ComponentProps<'h5'>> = (props) => {
  const rest = omit(props, 'class', 'children');
  return (
    <h5
      class={cn(
        'font-headline-md text-[15px] font-bold tracking-wide uppercase leading-none mb-1',
        props.class,
      )}
      {...rest}
    >
      {props.children}
    </h5>
  );
};

export const AlertDescription: Component<ComponentProps<'div'>> = (props) => {
  const rest = omit(props, 'class', 'children');
  return (
    <div
      class={cn(
        'font-body-sm text-body-sm text-on-surface-variant leading-relaxed',
        props.class,
      )}
      {...rest}
    >
      {props.children}
    </div>
  );
};
