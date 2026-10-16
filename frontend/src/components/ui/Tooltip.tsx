import type { JSX } from '@solidjs/web';
import { type Component, createSignal, Show } from 'solid-js';

import { cn } from '~/lib/utils';

export type TooltipProps = {
  content: JSX.Element;
  children: JSX.Element;
  class?: string;
  side?: 'top' | 'bottom';
};

export const Tooltip: Component<TooltipProps> = (props) => {
  const [isOpen, setIsOpen] = createSignal(false);
  const side = () => props.side ?? 'top';

  return (
    <div
      class="relative inline-flex"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      onFocus={() => setIsOpen(true)}
      onBlur={() => setIsOpen(false)}
    >
      {props.children}
      <Show when={isOpen()}>
        <div
          role="tooltip"
          class={cn(
            'absolute z-50 pointer-events-none px-2 py-1 font-label-mono-caps text-[10px] text-text-primary whitespace-nowrap bg-background/95 border border-accent-primary/40 rounded-sm shadow-glow-cyan-sm left-1/2 -translate-x-1/2',
            side() === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            props.class,
          )}
        >
          {props.content}
        </div>
      </Show>
    </div>
  );
};
