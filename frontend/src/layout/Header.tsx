import type { Component } from "solid-js";
import { paths } from "~/router";

export const Header: Component = () => {
  return (
    <header class="fixed top-0 left-0 right-0 z-50 bg-surface-container-lowest/85 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.5)] border-b border-surface-container-high/40">
      <div class="h-16 w-full px-margin flex items-center justify-between">
        {/* Identifiant & Télémétrie */}
        <div class="flex items-center gap-space-lg">
          <a
            href={paths()}
            aria-label="Cybercore Arena Home"
            class="flex items-center gap-space-md no-underline"
          >
            <div class="w-8 h-8 flex items-center justify-center text-primary-container">
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
            <div class="hidden sm:flex flex-col">
              <span class="font-headline-md text-headline-md tracking-wider text-primary leading-none">
                CYBERCORE
              </span>
              <span class="font-label-data text-label-data text-outline tracking-widest">
                TACTICAL NET // v2.8
              </span>
            </div>
          </a>

          <div class="hidden lg:flex items-center gap-space-xs px-space-sm py-space-xs bg-surface-container-low border border-surface-container-high/40">
            <span class="w-1.5 h-1.5 bg-primary-container animate-pulse" />
            <span class="font-label-mono-caps text-label-mono-caps text-on-surface-variant">
              14MS // US-EAST
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav class="hidden md:flex items-center gap-space-xs">
          <a
            href={paths()}
            class="px-space-md py-space-xs transition-all bg-primary-container text-on-primary font-bold shadow-[0_0_12px_rgba(0,240,255,0.4)] no-underline"
          >
            PLAY
          </a>
          <a
            href="/game"
            class="px-space-md py-space-xs font-label-mono-caps text-label-mono-caps text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all no-underline"
          >
            GAME
          </a>
          <a
            href="#leaderboard"
            class="px-space-md py-space-xs font-label-mono-caps text-label-mono-caps text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all no-underline"
          >
            LEADERBOARD
          </a>
          <a
            href="#class-section"
            class="px-space-md py-space-xs font-label-mono-caps text-label-mono-caps text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all no-underline"
          >
            CLASSES
          </a>
          <a
            href="#patch-notes"
            class="px-space-md py-space-xs font-label-mono-caps text-label-mono-caps text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all no-underline"
          >
            UPDATES
          </a>
          <a
            href={paths.users(1)}
            class="px-space-md py-space-xs font-label-mono-caps text-label-mono-caps text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-all no-underline"
          >
            USERS
          </a>
        </nav>

        {/* Actions utilisateur */}
        <div class="flex items-center gap-space-sm">
          <button
            type="button"
            aria-label="Discord Relay"
            class="p-space-xs bg-surface-container-low text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors flex items-center justify-center cursor-pointer border border-surface-container-high/40"
          >
            <span class="material-symbols-outlined text-[20px]">forum</span>
          </button>
          <button
            type="button"
            aria-label="HUD Settings"
            class="p-space-xs bg-surface-container-low text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors flex items-center justify-center cursor-pointer border border-surface-container-high/40"
          >
            <span class="material-symbols-outlined text-[20px]">settings</span>
          </button>
          <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary">
            <span class="material-symbols-outlined text-[18px]">person</span>
          </div>
        </div>
      </div>
    </header>
  );
};
