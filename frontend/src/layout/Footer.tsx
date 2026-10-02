import type { Component } from "solid-js";

export const Footer: Component = () => {
  return (
    <footer class="w-full bg-surface-container-lowest text-on-surface-variant py-space-lg border-t border-surface-container-high/40 mt-auto relative z-10">
      <div class="w-full px-margin flex flex-col md:flex-row items-center justify-between gap-space-md">
        <div class="flex items-center gap-space-md">
          <div class="flex items-center gap-space-xs">
            <span class="w-2 h-2 bg-primary-fixed-dim" />
            <span class="font-label-mono-caps text-label-mono-caps text-primary">
              SYSTEM STATUS // OPERATIONAL
            </span>
          </div>
          <span class="text-outline font-label-data text-label-data hidden sm:inline">|</span>
          <span class="font-label-data text-label-data text-on-surface-variant tracking-wider">
            BUILD: v2.8.4-PROD
          </span>
        </div>

        <div class="flex items-center gap-space-lg">
          <div class="flex items-center gap-space-sm">
            <button
              type="button"
              aria-label="Terminal Signal"
              class="text-on-surface-variant hover:text-primary transition-colors flex items-center bg-transparent border-0 cursor-pointer p-0"
            >
              <span class="material-symbols-outlined text-[18px]">terminal</span>
            </button>
            <button
              type="button"
              aria-label="Global Network"
              class="text-on-surface-variant hover:text-primary transition-colors flex items-center bg-transparent border-0 cursor-pointer p-0"
            >
              <span class="material-symbols-outlined text-[18px]">public</span>
            </button>
            <button
              type="button"
              aria-label="Telemetry Broadcast"
              class="text-on-surface-variant hover:text-primary transition-colors flex items-center bg-transparent border-0 cursor-pointer p-0"
            >
              <span class="material-symbols-outlined text-[18px]">sensors</span>
            </button>
          </div>

          <div class="flex items-center gap-space-md font-label-data text-label-data">
            <a class="hover:text-primary transition-colors no-underline text-outline" href="/terms">
              TERMS_OF_ENGAGEMENT
            </a>
            <a class="hover:text-primary transition-colors no-underline text-outline" href="/privacy">
              PRIVACY_PROTOCOL
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

