import type { ComponentProps } from '@solidjs/web';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export type SeparatorProps = ComponentProps<'hr'> & {
  orientation?: 'horizontal' | 'vertical';
};

export const Separator: Component<SeparatorProps> = (props) => {
  const rest = omit(props, 'orientation', 'class');
  const isHorizontal = () =>
    (props.orientation ?? 'horizontal') === 'horizontal';

  return (
    <hr
      aria-orientation={props.orientation ?? 'horizontal'}
      class={cn(
        'shrink-0 border-0 bg-surface-container-high/40',
        isHorizontal() ? 'h-[1px] w-full' : 'h-full w-[1px]',
        props.class,
      )}
      {...rest}
    />
  );
};
