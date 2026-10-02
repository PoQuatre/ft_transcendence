import type { ComponentProps } from "@solidjs/web";
import { type Component, omit } from "solid-js";
import { cn } from "~/lib/utils";

export type InputProps = ComponentProps<"input">;

export const Input: Component<InputProps> = (props) => {
  const rest = omit(props, "class");

  return (
    <input
      class={cn(
        "w-full bg-surface-container-lowest/90 px-4 py-3 font-label-mono-caps text-body-lg text-primary placeholder:text-outline/40",
        "border border-surface-container-high focus:border-primary-container focus:outline-none focus:ring-1 focus:ring-primary-container/80",
        "transition-all uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-50",
        props.class,
      )}
      {...rest}
    />
  );
};