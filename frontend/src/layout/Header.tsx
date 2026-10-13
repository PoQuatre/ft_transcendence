import type { Component } from 'solid-js';
import { createSignal, onSettled, Show } from 'solid-js';

import { type AuthUser, getMe } from '~/lib/auth';
import { paths } from '~/router';

export const Header: Component = () => {
  // Signal d'utilisateur compatible SolidJS 2.0 & SSR
  const [user, setUser] = createSignal<AuthUser | null>(null);

  // Vérification de la session une fois le composant initialisé dans le navigateur
  onSettled(() => {
    void getMe().then(setUser);
  });
  return (
    <header class="fixed top-0 left-0 right-0 z-50 bg-[#070b18]/90 backdrop-blur-md border-b border-[rgba(23,42,77,0.85)] px-4 lg:px-8 py-3">
      <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
        
        {/* Identifiant & Logo TRANSCEDANCE ARENA */}
        <div class="flex items-center space-x-3">
          <a href={paths()} class="flex items-center gap-3 no-underline">
            <div class="w-8 h-8 flex items-center justify-center text-[#00f0ff]">
              <svg viewBox="0 0 100 100" class="w-8 h-8 drop-shadow-[0_0_8px_#00f0ff]">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#00f0ff" stroke-width="6" />
                <circle cx="50" cy="50" r="24" fill="#00f0ff" opacity="0.3" />
                <circle cx="50" cy="50" r="10" fill="#00f0ff" />
                <line x1="50" y1="8" x2="50" y2="24" stroke="#00f0ff" stroke-width="6" />
                <line x1="50" y1="76" x2="50" y2="92" stroke="#00f0ff" stroke-width="6" />
                <line x1="8" y1="50" x2="24" y2="50" stroke="#00f0ff" stroke-width="6" />
                <line x1="76" y1="50" x2="92" stroke="#00f0ff" stroke-width="6" />
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-1.5 font-sans font-extrabold text-sm tracking-wider text-white">
                <span>TRANSCEDANCE</span>
                <span class="text-[#00f0ff]">ARENA</span>
              </div>
              <div class="font-mono text-[10px] text-slate-500 tracking-widest uppercase">
                TACTICAL NET // SEC-00
              </div>
            </div>
          </a>
        </div>

        {/* Navigation : PLAY, GAME, LEADERBOARD, CLASSES (Sans UPDATES ni USERS) */}
        <nav class="hidden md:flex items-center space-x-6 font-mono text-xs font-bold tracking-wider uppercase text-slate-400">
          <a
            href={paths()}
            class="px-3 py-1 rounded bg-[#00f0ff] text-[#050711] shadow-glow-cyan no-underline font-extrabold tracking-widest"
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
            class="hover:text-[#00f0ff] transition-colors no-underline"
          >
            LEADERBOARD
          </a>
          <a
            href="#classes"
            class="hover:text-[#00f0ff] transition-colors no-underline"
          >
            CLASSES
          </a>
        </nav>

        {/* Statut Télémétrique & Contrôles Utilisateur */}
        <div class="flex items-center gap-4 font-mono text-xs">
          <Show
            when={user()}
            fallback={
              <div class="flex items-center gap-3">
                <a
                  href="/login"
                  class="font-mono text-xs text-slate-400 hover:text-white transition-colors no-underline"
                >
                  LOG IN
                </a>
                <a
                  href="/signup"
                  class="font-mono text-xs font-bold text-[#00f0ff] hover:underline no-underline"
                >
                  SIGN UP
                </a>
                <span class="material-symbols-outlined text-base text-slate-400 cursor-pointer hover:text-[#00f0ff] transition-colors">
                  settings
                </span>
              </div>
            }
          >
            {/* Badge [ONLINE] avec point vert pulsant */}
            <div class="flex items-center gap-2 px-2.5 py-1 rounded bg-emerald-950/40 border border-emerald-500/40">
              <span class="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#39ff14] animate-pulse" />
              <span class="text-emerald-400 font-bold text-[11px] tracking-widest">[ONLINE]</span>
            </div>

            {/* Icônes d'action : Chat, Paramètres, Profil */}
            <div class="flex items-center gap-3 text-slate-400">
              <button
                type="button"
                title="Messagerie tactique"
                class="material-symbols-outlined text-base cursor-pointer hover:text-[#00f0ff] transition-colors bg-transparent border-none p-0 text-slate-400"
              >
                chat_bubble
              </button>
              <button
                type="button"
                title="Paramètres de l'arène"
                class="material-symbols-outlined text-base cursor-pointer hover:text-[#00f0ff] transition-colors bg-transparent border-none p-0 text-slate-400"
              >
                settings
              </button>
              <button
                type="button"
                title={`Profil de ${user()?.username ?? 'Pilote'}`}
                class="material-symbols-outlined text-base cursor-pointer hover:text-[#00f0ff] transition-colors bg-transparent border-none p-0 text-slate-400"
              >
                account_circle
              </button>
            </div>
          </Show>
        </div>
      </div>
    </header>
  );
};
