import { useLocation, useNavigate } from '@solidjs/router';
import type { Component } from 'solid-js';
import { createSignal, onSettled, Show } from 'solid-js';

import basicTankLogo from '~/assets/basic-tank.svg';
import { FriendsPanel } from '~/components/friends/FriendsPanel';
import { currentUser, getMe, logout } from '~/lib/auth';
import { paths } from '~/router';

export const Header: Component = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = (path: string) =>
    (location.pathname.replace(/\/+$/, '') || '/') === path;
  const navClass = (path: string) => [
    'px-3 py-1 rounded-sm transition-colors no-underline',
    {
      'bg-accent-primary text-accent-primary-on shadow-glow-cyan font-extrabold tracking-widest':
        isActive(path),
      'text-text-muted hover:text-accent-primary': !isActive(path),
    },
  ];
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [friendsOpen, setFriendsOpen] = createSignal(false);

  // Initialisation et récupération de la session dès le montage client
  onSettled(() => {
    void getMe();
  });

  // Déconnexion propre avec fermeture du menu et redirection vers /login
  const handleLogout = async () => {
    setSettingsOpen(false);
    setFriendsOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header class="fixed top-0 left-0 right-0 z-50 bg-surface-1/90 backdrop-blur-md border-b border-border-subtle/85 py-3">
      <div class="mx-auto px-margin container flex flex-wrap items-center justify-between gap-4">
        {/* =================================================================
            1. LOGO FT_TRANSCENDENCE
            ================================================================= */}
        <div class="flex items-center space-x-3">
          <a href={paths()} class="flex items-center gap-3 no-underline">
            {/* Logo décoratif : le nom du projet est écrit juste à côté. */}
            <img
              src={basicTankLogo}
              alt=""
              class="w-9 h-9 object-contain drop-shadow-glow-cyan"
            />
            <span class="font-sans font-extrabold text-sm tracking-wider text-white">
              FT_TRANSCENDENCE
            </span>
          </a>
        </div>

        {/* =================================================================
            2. NAVIGATION
            ================================================================= */}
        <nav class="hidden md:flex items-center space-x-6 font-mono text-xs font-bold tracking-wider uppercase text-text-muted">
          <a
            href={paths()}
            class={navClass('/')}
            aria-current={isActive('/') ? 'page' : undefined}
          >
            PLAY
          </a>
          <a
            href="/game"
            class={navClass('/game')}
            aria-current={isActive('/game') ? 'page' : undefined}
          >
            GAME
          </a>
          <a
            href="/leaderboard"
            class={navClass('/leaderboard')}
            aria-current={isActive('/leaderboard') ? 'page' : undefined}
          >
            LEADERBOARD
          </a>
        </nav>

        {/* =================================================================
            3. SECTION DROITE : [ONLINE] + MENU PARAMÈTRES AVEC LOGOUT
            ================================================================= */}
        <div class="flex items-center gap-4 font-mono text-xs">
          <Show
            when={currentUser()}
            fallback={
              /* Non connecté */
              <div class="flex items-center gap-3">
                <a
                  href="/login"
                  class="font-mono text-xs text-text-muted hover:text-white transition-colors no-underline"
                >
                  LOG IN
                </a>
                <a
                  href="/signup"
                  class="font-mono text-xs font-bold text-accent-primary hover:underline no-underline"
                >
                  SIGN UP
                </a>
              </div>
            }
          >
            {/* 1. Badge [ONLINE] vert pulsant, [UNVERIFIED] tant que l'email n'est pas vérifié */}
            <div class="flex items-center gap-2 px-3 py-1 rounded-sm bg-success-background/40 border border-success-border/40">
              <span class="w-2 h-2 rounded-pill bg-success-foreground shadow-glow-green-xs animate-pulse" />
              <span class="text-success-foreground font-bold text-[11px] tracking-widest">
                [ONLINE]
              </span>
            </div>
            <Show when={currentUser()?.verified === false}>
              <a
                href={paths.settings()}
                title="Vérifie ton email dans les settings"
                class="flex items-center gap-2 px-3 py-1 rounded-sm bg-warning-background/40 border border-warning-border/40 hover:border-warning-foreground transition-colors no-underline text-warning-foreground font-bold text-[11px] tracking-widest"
              >
                <span class="w-2 h-2 rounded-pill bg-warning-foreground" />
                <span aria-hidden="true" class="sm:hidden">
                  [!]
                </span>
                <span class="sr-only sm:not-sr-only">[UNVERIFIED]</span>
              </a>
            </Show>

            {/* 2. Bouton amis : le panneau s'ouvre par-dessus la page en cours */}
            <button
              type="button"
              aria-label="Friends"
              aria-expanded={friendsOpen() ? 'true' : 'false'}
              title="Friends"
              onClick={() => setFriendsOpen(!friendsOpen())}
              class={[
                'p-2 rounded-md border transition-all cursor-pointer flex items-center justify-center',
                {
                  'bg-accent-primary-subtle/70 border-accent-primary text-accent-primary shadow-glow-cyan-md':
                    friendsOpen(),
                  'bg-surface-1 border-border-subtle/85 text-text-muted hover:text-accent-primary hover:border-accent-primary/50':
                    !friendsOpen(),
                },
              ]}
            >
              <span class="material-symbols-outlined text-lg">group</span>
            </button>
            <Show when={friendsOpen()}>
              <FriendsPanel onClose={() => setFriendsOpen(false)} />
            </Show>

            {/* 3. Bouton Paramètres & Popover Déroulant */}
            <div class="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen(!settingsOpen())}
                title="Paramètres du pilote"
                class={[
                  'p-2 rounded-md border transition-all cursor-pointer flex items-center justify-center',
                  {
                    'bg-accent-primary-subtle/70 border-accent-primary text-accent-primary shadow-glow-cyan-md':
                      settingsOpen(),
                    'bg-surface-1 border-border-subtle/85 text-text-muted hover:text-accent-primary hover:border-accent-primary/50':
                      !settingsOpen(),
                  },
                ]}
              >
                <span class="material-symbols-outlined text-lg">settings</span>
              </button>

              {/* Menu Popover Tactique */}
              <Show when={settingsOpen()}>
                {/* Backdrop accessible pour fermer en cliquant n'importe où ailleurs */}
                <button
                  type="button"
                  aria-label="Fermer les paramètres"
                  class="fixed inset-0 z-40 w-full h-full border-none bg-transparent cursor-default"
                  onClick={() => setSettingsOpen(false)}
                />

                {/* Boîte du menu */}
                <div class="absolute right-0 top-full mt-2 w-72 bg-surface-2/95 backdrop-blur-xl border border-border-subtle/90 rounded-lg p-4 shadow-2xl z-50 font-mono space-y-3">
                  {/* Lien vers la page paramètres */}
                  <a
                    href={paths.settings()}
                    onClick={() => setSettingsOpen(false)}
                    class="w-full py-2 px-3 rounded-md bg-accent-primary-subtle/40 hover:bg-accent-primary-subtle/80 border border-accent-primary/50 hover:border-accent-primary text-accent-primary font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 no-underline shadow-glow-cyan-sm hover:shadow-glow-cyan-md"
                  >
                    <span class="material-symbols-outlined text-sm">tune</span>
                    <span>SETTINGS</span>
                  </a>
                  {/* Bouton LOGOUT*/}
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    class="w-full py-2 px-3 rounded-md bg-error-background/40 hover:bg-error-background/80 border border-error-border/50 hover:border-error-foreground text-error-foreground font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-glow-pink-sm hover:shadow-glow-pink-md"
                  >
                    <span class="material-symbols-outlined text-sm">
                      logout
                    </span>
                    <span>LOG OUT</span>
                  </button>

                  <div class="border-t border-border-subtle/80 pt-2" />

                  {/* Informations du Pilote Connecté */}
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-[10px] text-text-muted">
                      <span class="tracking-widest uppercase">
                        OPERATOR PROTOCOL
                      </span>
                      <span class="w-1.5 h-1.5 rounded-pill bg-success-foreground shadow-glow-green-xs" />
                    </div>

                    {/* Pseudo / Call-sign */}
                    <div class="bg-background border border-border-subtle/85 rounded-md p-3">
                      <div class="text-[10px] text-text-muted font-bold">
                        CALL-SIGN
                      </div>
                      <div class="text-sm font-bold text-accent-primary tracking-wider truncate mt-1">
                        {currentUser()?.username}
                      </div>
                    </div>

                    {/* Email du compte */}
                    <div class="bg-background border border-border-subtle/85 rounded-md p-3">
                      <div class="text-[10px] text-text-muted font-bold">
                        EMAIL PILOTE
                      </div>
                      <div class="text-xs text-text-secondary truncate mt-1">
                        {currentUser()?.email}
                      </div>
                    </div>
                  </div>
                </div>
              </Show>
            </div>
          </Show>
        </div>
      </div>
    </header>
  );
};
