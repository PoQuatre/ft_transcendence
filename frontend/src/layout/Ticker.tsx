import type { Component } from "solid-js";

export const Ticker: Component = () => {
  return (
    <div class="relative z-10 w-full bg-surface-container-low/90 backdrop-blur-md px-margin py-space-xs flex items-center justify-between overflow-x-auto shadow-sm border-b border-surface-container-high/30">
      <div class="flex items-center gap-space-lg min-w-max">
        <div class="flex items-center gap-space-xs">
          <span class="w-2 h-2 rounded-full bg-[#39ff14] animate-ping" />
          <span class="font-label-mono-caps text-label-mono-caps text-primary tracking-widest">
            NETWORK: PRIME [ONLINE]
          </span>
        </div>
        <div class="flex items-center gap-space-xs font-label-data text-label-data text-on-surface-variant">
          <span>GRID COORD:</span>
          <span class="font-label-mono-caps text-primary-fixed">
            SEC-09 // LAT 43.190
          </span>
        </div>
        <div class="flex items-center gap-space-xs font-label-data text-label-data text-on-surface-variant">
          <span>MATCH PROTOCOL:</span>
          <span class="text-tertiary-fixed font-bold">
            CYBER-CUP S4 // OVERDRIVE
          </span>
        </div>
      </div>

      <div class="flex items-center gap-space-md min-w-max">
        <div class="flex items-center gap-space-xs font-label-data text-label-data">
          <span class="text-outline">TICKRATE:</span>
          <span class="text-primary-container font-mono font-bold">64.0 Hz</span>
        </div>
        <div class="flex items-center gap-space-xs font-label-data text-label-data">
          <span class="text-outline">GLOBAL THREAT:</span>
          <span class="text-secondary-fixed-dim font-bold">CODE OMEGA</span>
        </div>
      </div>
    </div>
  );
};


