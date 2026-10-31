import type { Component } from 'solid-js';

export const Footer: Component = () => {
  return (
    <footer class="w-full bg-background text-text-secondary py-space-lg border-t border-border-subtle/40 mt-auto relative z-10">
      <div class="container mx-auto px-margin flex flex-col md:flex-row items-center justify-between gap-space-md">
        <div class="flex items-center gap-space-md">
          <div class="flex items-center gap-space-xs">
            <span class="w-2 h-2 bg-accent-primary-pressed" />
            <span class="font-label-mono-caps text-label-mono-caps text-text-primary">
              SYSTEM STATUS // OPERATIONAL
            </span>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-space-lg">
          <div class="flex items-center gap-space-sm">
            <button
              type="button"
              aria-label="Terminal Signal"
              class="text-text-secondary hover:text-text-primary transition-colors flex items-center bg-transparent border-0 cursor-pointer p-0"
            >
              <span class="material-symbols-outlined text-[18px]">
                terminal
              </span>
            </button>
            <button
              type="button"
              aria-label="Global Network"
              class="text-text-secondary hover:text-text-primary transition-colors flex items-center bg-transparent border-0 cursor-pointer p-0"
            >
              <span class="material-symbols-outlined text-[18px]">public</span>
            </button>
            <button
              type="button"
              aria-label="Telemetry Broadcast"
              class="text-text-secondary hover:text-text-primary transition-colors flex items-center bg-transparent border-0 cursor-pointer p-0"
            >
              <span class="material-symbols-outlined text-[18px]">sensors</span>
            </button>
          </div>

          <div class="flex flex-wrap items-center justify-center gap-space-md font-label-data text-label-data">
            <a
              class="hover:text-text-primary transition-colors no-underline text-text-muted"
              href="/terms"
            >
              TERMS_OF_ENGAGEMENT
            </a>
            <a
              class="hover:text-text-primary transition-colors no-underline text-text-muted"
              href="/privacy"
            >
              PRIVACY_PROTOCOL
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
