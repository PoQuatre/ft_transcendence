import type { ComponentProps } from '@solidjs/web';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export type InputProps = ComponentProps<'input'>;

export const Input: Component<InputProps> = (props) => {
  const rest = omit(props, 'class');

  return (
    <input
      class={cn(
        'w-full bg-background/90 px-4 py-3 font-label-mono-caps text-body-lg text-text-primary placeholder:text-text-muted/40',
        'border border-border-subtle focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-focus-primary/80',
        'transition-all tracking-wider disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )}
      {...rest}
    />
  );
};
