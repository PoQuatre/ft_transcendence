import { useNavigate } from '@solidjs/router';
import type { Component } from 'solid-js';
import { createSignal, onSettled, Show } from 'solid-js';

import basicTankLogo from '~/assets/basic-tank.svg';
import { currentUser, getMe, logout } from '~/lib/auth';
import { paths } from '~/router';

export const Header: Component = () => {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = createSignal(false);

  // Initialisation et récupération de la session dès le montage client
  onSettled(() => {
    void getMe();
  });

  // Déconnexion propre avec fermeture du menu et redirection vers /login
  const handleLogout = async () => {
    setSettingsOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <header class="fixed top-0 left-0 right-0 z-50 bg-hud-panel/90 backdrop-blur-md border-b border-hud-line/85 px-4 lg:px-8 py-3">
      <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* =================================================================
            1. IDENTIFIANT & LOGO TRANSCEDANCE ARENA
            ================================================================= */}
        <div class="flex items-center space-x-3">
          <a href={paths()} class="flex items-center gap-3 no-underline">
            {/* Nouveau Logo Tank */}
            <img
              src={basicTankLogo}
              alt="Cybercore Tank Logo"
              class="w-9 h-9 object-contain drop-shadow-[0_0_8px_#00E5FF]"
            />
            <div>
              <div class="flex items-center gap-1.5 font-sans font-extrabold text-sm tracking-wider text-white">
                <span>TRANSCEDANCE</span>
                <span class="text-neon-cyan">ARENA</span>
              </div>
              <div class="font-mono text-[10px] text-slate-500 tracking-widest uppercase">
                TACTICAL NET // SEC-00
              </div>
            </div>
          </a>
        </div>

        {/* =================================================================
            2. NAVIGATION
            ================================================================= */}
        <nav class="hidden md:flex items-center space-x-6 font-mono text-xs font-bold tracking-wider uppercase text-slate-400">
          <a
            href={paths()}
            class="px-3 py-1 rounded bg-neon-cyan text-hud-deep shadow-glow-cyan no-underline font-extrabold tracking-widest"
          >
            PLAY
          </a>
          <a
            href="/game"
            class="px-3 py-1 text-slate-400 hover:text-white transition-colors no-underline"
          >
            GAME
          </a>
          <a
            href="#leaderboard"
            class="hover:text-neon-cyan transition-colors no-underline"
          >
            LEADERBOARD
          </a>
          <a
            href="#classes"
            class="hover:text-neon-cyan transition-colors no-underline"
          >
            CLASSES
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
                  class="font-mono text-xs text-slate-400 hover:text-white transition-colors no-underline"
                >
                  LOG IN
                </a>
                <a
                  href="/signup"
                  class="font-mono text-xs font-bold text-neon-cyan hover:underline no-underline"
                >
                  SIGN UP
                </a>
              </div>
            }
          >
            {/* 1. Badge [ONLINE] vert pulsant */}
            <div class="flex items-center gap-2 px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-500/40">
              <span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#39ff14] animate-pulse" />
              <span class="text-emerald-400 font-bold text-[11px] tracking-widest">
                [ONLINE]
              </span>
            </div>

            {/* 2. Bouton Paramètres & Popover Déroulant */}
            <div class="relative">
              <button
                type="button"
                onClick={() => setSettingsOpen(!settingsOpen())}
                title="Paramètres du pilote"
                class={[
                  'p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center',
                  {
                    'bg-cyan-950/70 border-neon-cyan text-neon-cyan shadow-[0_0_12px_rgba(0,240,255,0.4)]':
                      settingsOpen(),
                    'bg-hud-panel border-hud-line/85 text-slate-400 hover:text-neon-cyan hover:border-neon-cyan/50':
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
                <div class="absolute right-0 top-full mt-2 w-72 bg-hud-raised/95 backdrop-blur-xl border border-hud-line/90 rounded-xl p-4 shadow-2xl z-50 font-mono space-y-3">
                  {/* Bouton LOGOUT au-dessus */}
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    class="w-full py-2 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-950/80 border border-rose-500/50 hover:border-rose-400 text-rose-400 font-bold text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_10px_rgba(244,63,94,0.25)] hover:shadow-[0_0_14px_rgba(244,63,94,0.45)]"
                  >
                    <span class="material-symbols-outlined text-sm">
                      logout
                    </span>
                    <span>LOG OUT</span>
                  </button>

                  <div class="border-t border-hud-line/80 pt-2" />

                  {/* Informations du Pilote Connecté */}
                  <div class="space-y-2">
                    <div class="flex items-center justify-between text-[10px] text-slate-400">
                      <span class="tracking-widest uppercase">
                        OPERATOR PROTOCOL
                      </span>
                      <span class="w-1.5 h-1.5 rounded-full bg-neon-green shadow-[0_0_6px_#39ff14]" />
                    </div>

                    {/* Pseudo / Call-sign */}
                    <div class="bg-hud-deep border border-hud-line/85 rounded-lg p-2.5">
                      <div class="text-[10px] text-slate-500 font-bold">
                        CALL-SIGN
                      </div>
                      <div class="text-sm font-bold text-neon-cyan tracking-wider truncate mt-0.5">
                        {currentUser()?.username}
                      </div>
                    </div>

                    {/* Email du compte */}
                    <div class="bg-hud-deep border border-hud-line/85 rounded-lg p-2.5">
                      <div class="text-[10px] text-slate-500 font-bold">
                        EMAIL PILOTE
                      </div>
                      <div class="text-xs text-slate-300 truncate mt-0.5">
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
