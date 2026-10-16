import type { ComponentProps, JSX } from '@solidjs/web';
import {
  createContext,
  useContext,
  createSignal,
  type Accessor,
  type Component,
  omit,
} from 'solid-js';

import { cn } from '~/lib/utils';

interface TabsContextValue {
  value: Accessor<string>;
  setValue: (val: string) => void;
}

const TabsContext = createContext<TabsContextValue>();

export type TabsProps = ComponentProps<'div'> & {
  defaultValue?: string;
  value?: string;
  onValueChange?: (val: string) => void;
  children?: JSX.Element;
};

export const Tabs: Component<TabsProps> = (props) => {
  const [internalValue, setInternalValue] = createSignal(
    props.defaultValue ?? '',
  );
  const value = () =>
    props.value !== undefined ? props.value : internalValue();

  const setValue = (val: string) => {
    setInternalValue(val);
    props.onValueChange?.(val);
  };

  const rest = omit(
    props,
    'defaultValue',
    'value',
    'onValueChange',
    'class',
    'children',
  );

  return (
    <TabsContext value={{ value, setValue }}>
      <div class={cn('flex flex-col gap-2', props.class)} {...rest}>
        {props.children}
      </div>
    </TabsContext>
  );
};

export type TabsListProps = ComponentProps<'div'>;

export const TabsList: Component<TabsListProps> = (props) => {
  const rest = omit(props, 'class');
  return (
    <div
      class={cn(
        'inline-flex items-center gap-1 rounded bg-surface-1 p-1 border border-border-subtle/40',
        props.class,
      )}
      {...rest}
    />
  );
};

export type TabsTriggerProps = ComponentProps<'button'> & {
  value: string;
};

export const TabsTrigger: Component<TabsTriggerProps> = (props) => {
  const context = useContext(TabsContext);
  const isSelected = () => context?.value() === props.value;
  const rest = omit(props, 'value', 'class');

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected() ? 'true' : 'false'}
      onClick={() => context?.setValue(props.value)}
      class={cn(
        'px-space-sm py-space-xs font-label-mono-caps text-label-mono-caps transition-all cursor-pointer rounded flex flex-col items-center gap-1',
        isSelected()
          ? 'bg-accent-primary/20 text-accent-primary font-bold shadow-glow-cyan-sm border border-accent-primary/40'
          : 'bg-surface-2/60 text-text-secondary hover:text-white hover:bg-surface-2 border border-transparent',
        props.class,
      )}
      {...rest}
    />
  );
};

export type TabsContentProps = ComponentProps<'div'> & {
  value: string;
  children?: JSX.Element;
};

export const TabsContent: Component<TabsContentProps> = (props) => {
  const context = useContext(TabsContext);
  const isSelected = () => context?.value() === props.value;
  const rest = omit(props, 'value', 'class', 'children');

  return (
    <div
      role="tabpanel"
      hidden={!isSelected()}
      class={cn(isSelected() ? 'block' : 'hidden', props.class)}
      {...rest}
    >
      {isSelected() && props.children}
    </div>
  );
};
