import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

import { Avatar, Badge } from '~/components/ui';
import { cn } from '~/lib/utils';

import { initials, PANEL } from './shared';

// Carte d'identité du pilote, commune au profil personnel et au profil
// public d'un autre joueur : chaque page fournit son état, ses détails sous
// le nom et son bouton d'action.
// Le badge d'état est dessiné ici à partir de données, pas reçu en JSX : un
// élément JSX passé en propriété et placé avant l'avatar n'est pas créé dans
// le même ordre au rendu serveur et à l'hydratation, ce qui décale les clés
// d'hydratation et laisse l'ancien HTML affiché (ex. « OFFLINE ONLINE »).
export function IdentityCard(props: {
  username: string;
  status: { label: string; online?: boolean };
  children?: JSX.Element;
  action?: JSX.Element;
}) {
  return (
    <div class={cn(PANEL, 'p-0 md:p-0 lg:col-span-12')}>
      <div class="flex items-center justify-between gap-space-md border-b border-border-subtle/85 px-space-md py-space-sm md:px-space-lg">
        <span class="min-w-0 truncate font-label-data text-label-data text-text-muted">
          [PILOT_FILE // {props.username}]
        </span>
        <Show
          when={props.status.online}
          fallback={
            <Badge variant="outline" class="shrink-0">
              {props.status.label}
            </Badge>
          }
        >
          <Badge variant="success" class="shrink-0">
            <span
              aria-hidden="true"
              class="h-1.5 w-1.5 bg-success-foreground motion-safe:animate-pulse"
            />
            {props.status.label}
          </Badge>
        </Show>
      </div>

      <div class="p-space-md md:p-space-lg">
        <div class="flex flex-col gap-space-md sm:flex-row sm:items-center sm:gap-space-lg">
          <div class="flex min-w-0 flex-1 items-center gap-space-md sm:gap-space-lg">
            <Avatar
              class="h-16 w-16 border-accent-primary shadow-glow-cyan-md sm:h-20 sm:w-20 [&>div]:font-stat-counter [&>div]:text-stat-counter [&>div]:text-accent-primary"
              fallback={initials(props.username)}
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
              <h1 class="font-headline-xl text-headline-xl-mobile uppercase break-words sm:text-headline-xl">
                <span class="text-accent-primary">{props.username}</span>
              </h1>
              {props.children}
            </div>
          </div>
          {props.action}
        </div>
      </div>
    </div>
  );
}
