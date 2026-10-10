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

type Mode = 'login' | 'signup';

const TAB_BASE =
  'flex-1 px-space-sm py-space-xs font-label-mono-caps text-label-mono-caps transition-all rounded flex flex-col items-center gap-1 no-underline';
const TAB_ON =
  'bg-primary-container/20 text-primary-container font-bold shadow-[0_0_12px_rgba(0,240,255,0.25)] border border-primary-container/40';
const TAB_OFF =
  'bg-surface-container-high/60 text-on-surface-variant hover:text-white hover:bg-surface-container-high border border-transparent';

export type AuthCardProps = {
  mode: Mode;
  error: Extract<AuthResult, { ok: false }> | undefined;
  children: JSX.Element;
};

// Panneau commun aux pages /login et /signup (maquettes login.html / signup.html).
export const AuthCard: Component<AuthCardProps> = (props) => {
  const isLogin = () => props.mode === 'login';

  return (
    <section class="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
      <div class="w-full max-w-md">
        <Card variant="chamfer">
          <div class="flex items-center justify-between border-b border-surface-container-high/60 px-space-lg py-space-sm">
            <span class="font-label-data text-label-data text-outline">
              {isLogin() ? '[AUTH_01 // LOGIN]' : '[AUTH_02 // ENLIST]'}
            </span>
            <Show
              when={isLogin()}
              fallback={<Badge variant="secondary">NEW PILOT</Badge>}
            >
              <Badge variant="success">
                <span class="h-1.5 w-1.5 animate-pulse bg-[#39ff14]" /> UPLINK
              </Badge>
            </Show>
          </div>

          <div class="p-space-lg">
            <h1 class="font-headline-xl text-headline-xl uppercase">
              {isLogin() ? 'Operator ' : 'Pilot '}
              <span class="text-primary-container text-glow-cyan">
                {isLogin() ? 'Login' : 'Enlistment'}
              </span>
            </h1>
            <p class="mt-space-xs font-body-sm text-body-sm text-on-surface-variant">
              {isLogin()
                ? "Reconnecte ton call-sign pour rejoindre l'arène."
                : "Crée ton call-sign pour entrer dans l'arène."}
            </p>

            {/* Même rendu que TabsList / TabsTrigger, mais en liens : chaque onglet est une route. */}
            <nav class="mt-space-lg inline-flex w-full items-center gap-1 rounded border border-surface-container-high/40 bg-surface-container-low p-1">
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

            {props.children}

            <Separator class="my-space-lg" />

            <p class="text-center font-body-sm text-body-sm text-on-surface-variant">
              {isLogin()
                ? 'Pas encore de call-sign ? '
                : 'Déjà un call-sign ? '}
              <a
                href={isLogin() ? '/signup' : '/login'}
                class="font-bold uppercase text-neon-cyan underline-offset-4 hover:underline"
              >
                {isLogin() ? 'Sign up' : 'Log in'}
              </a>
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
};
