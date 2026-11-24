import type { Component } from 'solid-js';

import sprites from '~/assets/tanks.svg';

export type TankKind = 'basic' | 'twin' | 'heavy' | 'quad' | 'drone';

// Taille et centre de rotation de chaque tank (TankType, game/src/simulation).
const TANKS: Record<
  TankKind,
  { width: number; height: number; pivotX: number }
> = {
  basic: { width: 79, height: 56, pivotX: 28 },
  twin: { width: 82, height: 50, pivotX: 28 },
  heavy: { width: 90, height: 68, pivotX: 34 },
  quad: { width: 108, height: 108, pivotX: 54 },
  drone: { width: 70, height: 106, pivotX: 35 },
};

// Décalage horizontal qui amène le centre de rotation au milieu du dessin.
export const pivotShift = (kind: TankKind) =>
  `${50 - (TANKS[kind].pivotX / TANKS[kind].width) * 100}%`;

export type TankSpriteProps = { kind: TankKind; class?: string };

// <use> garde currentColor, une <img> non : le tank prend la couleur choisie.
export const TankSprite: Component<TankSpriteProps> = (props) => (
  <svg
    viewBox={`0 0 ${TANKS[props.kind].width} ${TANKS[props.kind].height}`}
    fill="none"
    aria-hidden="true"
    class={props.class}
  >
    <use href={`${sprites}#${props.kind}`} />
  </svg>
);
