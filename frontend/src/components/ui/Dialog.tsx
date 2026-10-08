import type { ComponentProps, JSX } from "@solidjs/web";
import { Portal } from "@solidjs/web";
import { type Component, Show, omit } from "solid-js";
import { cn } from "~/lib/utils";

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: JSX.Element;
};

export const Dialog: Component<DialogProps> = (props) => {
  return (
    <Show when={props.open}>
      <Portal>
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop accessible au clavier et à la souris */}
          <button
            type="button"
            aria-label="Fermer la boîte de dialogue"
            tabIndex={-1}
            class="fixed inset-0 bg-surface-container-lowest/80 backdrop-blur-md transition-opacity cursor-pointer border-0 p-0"
            onClick={() => props.onOpenChange(false)}
          />
          {/* Contenu modale Cyber */}
          <div class="relative z-50 w-full max-w-lg bg-surface-container/95 border border-primary-container/40 p-space-lg rounded-xl shadow-[0_0_30px_rgba(0,240,255,0.25)] text-on-surface">
            {props.children}
          </div>
        </div>
      </Portal>
    </Show>
  );
};

export const DialogHeader: Component<ComponentProps<"div">> = (props) => {
  const rest = omit(props, "class", "children");
  return (
    <div
      class={cn("flex flex-col gap-1.5 pb-4 border-b border-surface-container-high/40", props.class)}
      {...rest}
    >
      {props.children}
    </div>
  );
};

export const DialogTitle: Component<ComponentProps<"h3">> = (props) => {
  const rest = omit(props, "class", "children");
  return (
    <h3
      class={cn("font-headline-md text-headline-md text-white font-bold tracking-wide", props.class)}
      {...rest}
    >
      {props.children}
    </h3>
  );
};

export const DialogDescription: Component<ComponentProps<"p">> = (props) => {
  const rest = omit(props, "class", "children");
  return (
    <p
      class={cn("font-body-sm text-body-sm text-on-surface-variant", props.class)}
      {...rest}
    >
      {props.children}
    </p>
  );
};

export const DialogFooter: Component<ComponentProps<"div">> = (props) => {
  const rest = omit(props, "class", "children");
  return (
    <div
      class={cn(
        "flex items-center justify-end gap-space-sm pt-4 border-t border-surface-container-high/40",
        props.class,
      )}
      {...rest}
    >
      {props.children}
    </div>
  );
};