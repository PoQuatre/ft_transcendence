export const AlertTitle: Component<ComponentProps<"h5">> = (props) => {
  const rest = omit(props, "class", "children");
  return (
    <h5
      class={cn("font-headline-md text-[15px] font-bold tracking-wide uppercase leading-none mb-1", props.class)}
      {...rest}
    >
      {props.children}
    </h5>
  );
};

export const AlertDescription: Component<ComponentProps<"div">> = (props) => {
  const rest = omit(props, "class", "children");
  return (
    <div
      class={cn("font-body-sm text-body-sm text-on-surface-variant leading-relaxed", props.class)}
      {...rest}
    >
      {props.children}
    </div>
  );
};