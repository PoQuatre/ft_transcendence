import type { Component } from 'solid-js';

export const Footer: Component = () => {
  return (
    <footer class="w-full bg-background text-text-secondary py-space-lg border-t border-border-subtle/40 mt-auto relative z-10">
      <div class="container mx-auto px-margin flex flex-wrap items-center justify-center md:justify-end gap-space-md font-label-data text-label-data">
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
    </footer>
  );
};
