import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';

import { Alert, AlertDescription, AlertTitle, Button } from '~/components/ui';
import { cn } from '~/lib/utils';

// Éléments communs aux sections de la page profil.

// Conteneur des sections : même carte que l'accueil et le leaderboard.
export const PANEL =
  'relative min-w-0 overflow-hidden rounded-lg border border-border-subtle/85 bg-surface-1/90 p-space-md shadow-card-inner backdrop-blur-md md:p-space-lg';

// Arrière-plan d'ambiance commun aux autres pages (grille + halos).
export function ProfileBackdrop() {
  return (
    <div aria-hidden="true" class="pointer-events-none fixed inset-0 z-0">
      <div class="absolute inset-0 tactical-grid opacity-80" />
      <div class="absolute -top-48 -left-32 h-96 w-96 rounded-pill bg-accent-primary/15 blur-3xl" />
      <div class="absolute top-1/3 -right-48 h-96 w-96 rounded-pill bg-accent-secondary/15 blur-3xl" />
      <div class="absolute -bottom-48 left-1/3 h-96 w-96 rounded-pill bg-accent-secondary/10 blur-3xl" />
    </div>
  );
}

// En-tête de carte : sur-titre coloré + titre, séparés du contenu.
export function PanelHeading(props: {
  id: string;
  eyebrow: string;
  title: string;
  accent?: 'primary' | 'secondary';
  aside?: JSX.Element;
}) {
  return (
    <div class="flex flex-wrap items-end justify-between gap-space-sm border-b border-border-subtle/85 pb-3">
      <div class="min-w-0">
        <p
          class={cn(
            'font-label-data text-label-data font-bold uppercase tracking-wide',
            props.accent === 'secondary'
              ? 'text-accent-secondary'
              : 'text-accent-primary',
          )}
        >
          ◇ &nbsp;{props.eyebrow}
        </p>
        <h2
          id={props.id}
          class="mt-space-xs font-headline-md text-headline-md font-bold uppercase text-text-primary"
        >
          {props.title}
        </h2>
      </div>
      <Show when={props.aside}>
        <div class="font-label-data text-label-data text-text-muted">
          {props.aside}
        </div>
      </Show>
    </div>
  );
}

// Focus visible de la même famille que l'accent du contrôle (charte).
export const FOCUS_PRIMARY =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-primary';

export const initials = (name: string) => name.slice(0, 2).toUpperCase();

// Feedback : toujours une icône + un libellé (charte).
export function Notice(props: {
  variant: 'warning' | 'destructive' | 'cyan';
  title?: string;
  message: string;
}) {
  return (
    <Alert variant={props.variant}>
      <span aria-hidden="true" class="font-label-mono-caps font-bold">
        {props.variant === 'cyan' ? '◆' : '!'}
      </span>
      <div>
        <Show when={props.title}>
          {(title) => <AlertTitle>{title()}</AlertTitle>}
        </Show>
        <AlertDescription>{props.message}</AlertDescription>
      </div>
    </Alert>
  );
}

export function Pager(props: {
  label: string;
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  return (
    <Show when={props.totalPages > 1}>
      <nav
        aria-label={props.label}
        class="mt-space-md flex items-center justify-between"
      >
        <Button
          variant="outline"
          size="sm"
          class={FOCUS_PRIMARY}
          disabled={props.page <= 1}
          onClick={() => props.onPage(props.page - 1)}
        >
          ← PREV
        </Button>
        <span class="font-label-data text-label-data tabular-nums text-text-muted">
          {props.page} / {props.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          class={FOCUS_PRIMARY}
          disabled={props.page >= props.totalPages}
          onClick={() => props.onPage(props.page + 1)}
        >
          NEXT →
        </Button>
      </nav>
    </Show>
  );
}
