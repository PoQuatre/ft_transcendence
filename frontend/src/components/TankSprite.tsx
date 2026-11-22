import type { Component } from 'solid-js';

import sprites from '~/assets/tanks.svg';

export type TankKind = 'basic' | 'twin' | 'heavy' | 'quad' | 'drone';

// Mêmes proportions que les symboles de assets/tanks.svg.
const VIEW_BOXES: Record<TankKind, string> = {
  basic: '0 0 79 56',
  twin: '0 0 82 50',
  heavy: '0 0 90 68',
  quad: '0 0 108 108',
  drone: '0 0 70 106',
};

export type TankSpriteProps = { kind: TankKind; class?: string };

// <use> garde currentColor, une <img> non : le tank prend la couleur choisie.
export const TankSprite: Component<TankSpriteProps> = (props) => (
  <svg
    viewBox={VIEW_BOXES[props.kind]}
    fill="none"
    aria-hidden="true"
    class={props.class}
  >
    <use href={`${sprites}#${props.kind}`} />
  </svg>
);
