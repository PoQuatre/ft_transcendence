import type { Component } from "solid-js";

interface ChassisVectorProps {
  type: "STRIKER" | "PHANTOM" | "OVERSEER";
  color?: string;
  glow?: string;
  class?: string;
}

export const ChassisVector: Component<ChassisVectorProps> = (props) => {
  const color = () => props.color ?? "#dcb8ff";
  const glow = () => props.glow ?? "rgba(220, 184, 255, 0.75)";

  return (
    <div class={props.class} style={{ filter: `drop-shadow(0 0 12px ${glow()})` }}>
      {props.type === "STRIKER" && (
        <svg viewBox="0 0 100 100" class="w-full h-full transition-transform duration-300">
          <rect
            x="36"
            y="10"
            width="10"
            height="38"
            rx="1.5"
            fill="#101424"
            stroke={color()}
            stroke-width="2.5"
          />
          <rect
            x="54"
            y="10"
            width="10"
            height="38"
            rx="1.5"
            fill="#101424"
            stroke={color()}
            stroke-width="2.5"
          />
          <circle cx="50" cy="55" r="28" fill="#101424" stroke={color()} stroke-width="4" />
          <circle
            cx="50"
            cy="55"
            r="14"
            fill={color()}
            fill-opacity="0.3"
            stroke={color()}
            stroke-width="2"
          />
          <circle cx="50" cy="55" r="4.5" fill="#ffffff" />
        </svg>
      )}

      {props.type === "PHANTOM" && (
        <svg viewBox="0 0 100 100" class="w-full h-full transition-transform duration-300">
          <path
            d="M50 15 L85 80 L50 65 L15 80 Z"
            fill="#10131e"
            stroke={color()}
            stroke-width="4"
            stroke-linejoin="round"
          />
          <polygon points="50,25 78,75 50,62 22,75" fill={color()} fill-opacity="0.3" />
          <circle cx="50" cy="52" r="10" fill={color()} />
          <circle cx="50" cy="52" r="4" fill="#ffffff" />
        </svg>
      )}

      {props.type === "OVERSEER" && (
        <svg viewBox="0 0 100 100" class="w-full h-full transition-transform duration-300">
          <polygon
            points="50,15 82,33 82,67 50,85 18,67 18,33"
            fill="#10131e"
            stroke={color()}
            stroke-width="4"
          />
          <polygon points="50,25 74,38 74,62 50,75 26,62 26,38" fill={color()} fill-opacity="0.3" />
          <circle cx="50" cy="50" r="12" fill={color()} />
          <circle cx="50" cy="50" r="4.5" fill="#ffffff" />
          <polygon points="16,16 24,18 18,24" fill="#00f0ff" />
          <polygon points="84,18 76,22 82,28" fill="#00f0ff" />
          <polygon points="50,92 56,84 44,84" fill="#00f0ff" />
        </svg>
      )}
    </div>
  );
};
