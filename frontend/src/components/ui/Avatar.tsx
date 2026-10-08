import type { ComponentProps } from '@solidjs/web';
import { type Component, createSignal, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export type AvatarProps = ComponentProps<'div'> & {
  src?: string;
  alt?: string;
  fallback?: string;
};

export const Avatar: Component<AvatarProps> = (props) => {
  const [hasError, setHasError] = createSignal(false);
  const rest = omit(props, 'src', 'alt', 'fallback', 'class');

  return (
    <div
      class={cn(
        'relative flex h-8 w-8 shrink-0 overflow-hidden rounded-full border border-primary-container/40 bg-surface-container-low shadow-[0_0_8px_rgba(0,240,255,0.2)]',
        props.class,
      )}
      {...rest}
    >
      {props.src && !hasError() ? (
        <img
          src={props.src}
          alt={props.alt ?? 'Pilot Avatar'}
          onError={() => setHasError(true)}
          class="aspect-square h-full w-full object-cover"
        />
      ) : (
        <div class="flex h-full w-full items-center justify-center font-label-mono-caps text-xs font-bold text-primary">
          {props.fallback ?? 'OP'}
        </div>
      )}
    </div>
  );
};
