import type { ComponentProps } from '@solidjs/web';
import { type Component, omit } from 'solid-js';

import { cn } from '~/lib/utils';

export const Table: Component<ComponentProps<'table'>> = (props) => {
  const rest = omit(props, 'class');
  return (
    <div class="relative w-full overflow-auto">
      <table
        class={cn(
          'w-full caption-bottom text-sm font-label-mono-caps',
          props.class,
        )}
        {...rest}
      />
    </div>
  );
};

export const TableHeader: Component<ComponentProps<'thead'>> = (props) => {
  const rest = omit(props, 'class');
  return (
    <thead
      class={cn(
        '[&_tr]:border-b border-surface-container-high/60',
        props.class,
      )}
      {...rest}
    />
  );
};

export const TableBody: Component<ComponentProps<'tbody'>> = (props) => {
  const rest = omit(props, 'class');
  return (
    <tbody class={cn('[&_tr:last-child]:border-0', props.class)} {...rest} />
  );
};

export const TableRow: Component<ComponentProps<'tr'>> = (props) => {
  const rest = omit(props, 'class');
  return (
    <tr
      class={cn(
        'border-b border-surface-container-high/30 transition-colors hover:bg-surface-container-high/40',
        props.class,
      )}
      {...rest}
    />
  );
};

export const TableHead: Component<ComponentProps<'th'>> = (props) => {
  const rest = omit(props, 'class');
  return (
    <th
      class={cn(
        'h-10 px-3 text-left align-middle font-bold text-outline text-[11px] tracking-wider uppercase',
        props.class,
      )}
      {...rest}
    />
  );
};

export const TableCell: Component<ComponentProps<'td'>> = (props) => {
  const rest = omit(props, 'class');
  return (
    <td
      class={cn('p-3 align-middle text-on-surface text-body-sm', props.class)}
      {...rest}
    />
  );
};
