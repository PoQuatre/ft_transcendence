import type { JSX } from '@solidjs/web';
import { type Component, Show } from 'solid-js';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  Separator,
} from '~/components/ui';
import type { AuthResult } from '~/lib/auth';
import { cn } from '~/lib/utils';

type Mode = 'login' | 'signup' | 'forgot' | 'reset';

const TAB_BASE =
  'flex-1 px-space-sm py-space-xs font-label-mono-caps text-label-mono-caps transition-all rounded-sm flex flex-col items-center gap-1 no-underline';
const TAB_ON =
  'bg-accent-primary/20 text-accent-primary font-bold shadow-glow-cyan-sm border border-accent-primary/40';
const TAB_OFF =
  'bg-surface-2/60 text-text-secondary hover:text-white hover:bg-surface-2 border border-transparent';

const COPY: Record<
  Mode,
  {
    tag: string;
    title: string;
    highlight: string;
    intro: string;
    footer: string;
    link: { href: string; label: string };
  }
> = {
  login: {
    tag: '[AUTH_01 // LOGIN]',
    title: 'Operator ',
    highlight: 'Login',
    intro: "Reconnecte ton call-sign pour rejoindre l'arène.",
    footer: 'Pas encore de call-sign ? ',
    link: { href: '/signup', label: 'Sign up' },
  },
  signup: {
    tag: '[AUTH_02 // ENLIST]',
    title: 'Pilot ',
    highlight: 'Enlistment',
    intro: "Crée ton call-sign pour entrer dans l'arène.",
    footer: 'Déjà un call-sign ? ',
    link: { href: '/login', label: 'Log in' },
  },
  forgot: {
    tag: '[AUTH_03 // RECOVERY]',
    title: 'Access ',
    highlight: 'Recovery',
    intro:
      'Entre ton email : tu recevras un lien pour choisir un nouveau mot de passe.',
    footer: 'Mot de passe retrouvé ? ',
    link: { href: '/login', label: 'Log in' },
  },
  reset: {
    tag: '[AUTH_04 // RESET]',
    title: 'New ',
    highlight: 'Password',
    intro: 'Choisis le nouveau mot de passe de ton compte.',
    footer: 'Lien expiré ? ',
    link: { href: '/forgot-password', label: 'Nouveau lien' },
  },
};

export type AuthCardProps = {
  mode: Mode;
  error: Extract<AuthResult, { ok: false }> | undefined;
  notice?: { title: string; message: string } | undefined;
  children: JSX.Element;
};

// Panneau commun aux pages d'authentification (maquettes login.html /
// signup.html). Les onglets LOG IN / SIGN UP ne s'affichent que sur ces deux
// pages ; la récupération du mot de passe garde le même cadre.
export const AuthCard: Component<AuthCardProps> = (props) => {
  const isLogin = () => props.mode === 'login';
  const hasTabs = () => props.mode === 'login' || props.mode === 'signup';
  const copy = () => COPY[props.mode];

  return (
    <section class="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
      <div class="w-full max-w-md">
        <Card variant="chamfer">
          <div class="flex items-center justify-between border-b border-border-subtle/60 px-space-lg py-space-sm">
            <span class="font-label-data text-label-data text-text-muted">
              {copy().tag}
            </span>
            <Show
              when={hasTabs()}
              fallback={<Badge variant="warning">RECOVERY</Badge>}
            >
              <Show
                when={isLogin()}
                fallback={<Badge variant="secondary">NEW PILOT</Badge>}
              >
                <Badge variant="success">
                  <span class="h-1.5 w-1.5 animate-pulse bg-success-foreground" />{' '}
                  UPLINK
                </Badge>
              </Show>
            </Show>
          </div>

          <div class="p-space-lg">
            <h1 class="font-headline-xl text-headline-xl uppercase">
              {copy().title}
              <span class="text-accent-primary text-glow-cyan">
                {copy().highlight}
              </span>
            </h1>
            <p class="mt-space-xs font-body-sm text-body-sm text-text-secondary">
              {copy().intro}
            </p>

            {/* Même rendu que TabsList / TabsTrigger, mais en liens : chaque onglet est une route. */}
            <Show when={hasTabs()}>
              <nav class="mt-space-lg inline-flex w-full items-center gap-1 rounded-sm border border-border-subtle/40 bg-surface-1 p-1">
                <a
                  href="/login"
                  aria-current={isLogin() ? 'page' : undefined}
                  class={cn(TAB_BASE, isLogin() ? TAB_ON : TAB_OFF)}
                >
                  LOG IN
                </a>
                <a
                  href="/signup"
                  aria-current={isLogin() ? undefined : 'page'}
                  class={cn(TAB_BASE, isLogin() ? TAB_OFF : TAB_ON)}
                >
                  SIGN UP
                </a>
              </nav>
            </Show>

            <Show when={props.error}>
              {(err) => (
                <Alert variant="destructive" class="mt-space-lg">
                  <span class="font-mono font-bold">!</span>
                  <div>
                    <AlertTitle>{err().title}</AlertTitle>
                    <AlertDescription>{err().message}</AlertDescription>
                  </div>
                </Alert>
              )}
            </Show>

            <Show when={!props.error && props.notice}>
              {(notice) => (
                <Alert variant="success" class="mt-space-lg">
                  <span class="font-mono font-bold">◆</span>
                  <div>
                    <AlertTitle>{notice().title}</AlertTitle>
                    <AlertDescription>{notice().message}</AlertDescription>
                  </div>
                </Alert>
              )}
            </Show>

            {props.children}

            <Separator class="my-space-lg" />

            <p class="text-center font-body-sm text-body-sm text-text-secondary">
              {copy().footer}
              <a
                href={copy().link.href}
                class="font-bold uppercase text-accent-primary underline-offset-4 hover:underline"
              >
                {copy().link.label}
              </a>
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
};
