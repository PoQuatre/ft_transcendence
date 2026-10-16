import type { Component } from 'solid-js';

export const Ticker: Component = () => {
  return (
    <div class="relative z-10 w-full bg-surface-1/90 backdrop-blur-md px-margin py-space-xs flex items-center justify-between overflow-x-auto shadow-sm border-b border-border-subtle/30">
      <div class="flex items-center gap-space-lg min-w-max">
        <div class="flex items-center gap-space-xs">
          <span class="w-2 h-2 rounded-pill bg-success-foreground animate-ping" />
          <span class="font-label-mono-caps text-label-mono-caps text-text-primary tracking-widest">
            NETWORK: PRIME [ONLINE]
          </span>
        </div>
        <div class="flex items-center gap-space-xs font-label-data text-label-data text-text-secondary">
          <span>GRID COORD:</span>
          <span class="font-label-mono-caps text-accent-primary-hover">
            SEC-09 // LAT 43.190
          </span>
        </div>
        <div class="flex items-center gap-space-xs font-label-data text-label-data text-text-secondary">
          <span>MATCH PROTOCOL:</span>
          <span class="text-accent-secondary-hover font-bold">
            CYBER-CUP S4 // OVERDRIVE
          </span>
        </div>
      </div>

      <div class="flex items-center gap-space-md min-w-max">
        <div class="flex items-center gap-space-xs font-label-data text-label-data">
          <span class="text-text-muted">GLOBAL THREAT:</span>
          <span class="text-accent-secondary font-bold">CODE OMEGA</span>
        </div>
      </div>
    </div>
  );
};
