import { createMemo, For } from 'solid-js';

import { Badge, SegmentedProgress } from '~/components/ui';
import { levelProgress, pilotXp } from '~/lib/level';
import { formatNumber, type PilotStats } from '~/lib/profile';

import { PANEL, PanelHeading } from './shared';

const COMING_SOON = 'COMING SOON';

// Tuile de stat : surface-2 pour se détacher de la carte (surface-1), rayon md.
const TILE = 'rounded-md border border-border-subtle/60 bg-surface-2/40';

// Bloc de stats inspiré de PilotTelemetry (front-leaderboard).
// Tout ce qui dépend de l'ELO, ainsi que les matchs, le taux de victoire et le
// ratio K/D, est affiché en « coming soon » : seule l'expérience (XP / niveau)
// est suivie pour l'instant. L'XP et le niveau suivent les règles du
// leaderboard (lib/level.ts).
export function PilotStatsPanel(props: { stats: PilotStats }) {
  const xp = createMemo(() => pilotXp(props.stats));
  const level = createMemo(() => levelProgress(xp()));

  const cells = () => [
    { label: 'TOTAL XP', value: formatNumber(xp()) },
    { label: 'MATCHES', value: COMING_SOON, soon: true },
    { label: 'WIN RATE', value: COMING_SOON, soon: true },
    { label: 'KILLS', value: formatNumber(props.stats.kills) },
    { label: 'K/D', value: COMING_SOON, soon: true },
    { label: 'RANK', value: COMING_SOON, soon: true },
  ];

  return (
    <section aria-labelledby="pilot-stats-title" class={PANEL}>
      <PanelHeading
        id="pilot-stats-title"
        eyebrow="TELEMETRY"
        title="Pilot stats"
      />

      <div class="mt-space-md grid gap-space-md md:grid-cols-[auto_1fr]">
        <div class="flex flex-col items-center justify-center rounded-md border border-accent-primary/40 bg-accent-primary-subtle/40 px-space-lg py-space-md text-center shadow-glow-cyan-sm">
          <p class="font-label-data text-label-data text-text-muted">
            PILOT LEVEL
          </p>
          <p class="font-stat-counter text-display-hero-mobile font-bold tabular-nums text-accent-primary neon-text-cyan md:text-display-hero">
            {level().level}
          </p>
          <p class="mt-space-xs font-label-data text-label-data font-bold tabular-nums text-text-secondary">
            {formatNumber(level().current)} / {formatNumber(level().span)} XP
          </p>
        </div>

        <dl class="grid grid-cols-2 gap-space-sm sm:grid-cols-3">
          <For each={cells()}>
            {(cell) => (
              <div class={`${TILE} px-space-md py-space-sm`}>
                <dt class="font-label-data text-label-data text-text-muted">
                  {cell.label}
                </dt>
                <dd
                  class={[
                    'mt-space-xs font-label-data font-bold tabular-nums',
                    cell.soon
                      ? 'text-label-data text-text-muted'
                      : 'text-body-lg text-text-primary',
                  ]}
                >
                  {cell.value}
                </dd>
              </div>
            )}
          </For>
        </dl>
      </div>

      <div class="mt-space-md rounded-md border border-accent-primary/30 bg-accent-primary-subtle/40 p-space-md">
        <div class="mb-space-sm flex flex-wrap items-center justify-between gap-space-sm font-label-data text-label-data">
          <span class="font-bold text-accent-primary">LEVEL PROGRESS</span>
          <span class="tabular-nums text-text-secondary">
            {formatNumber(level().remaining)} XP TO LVL {level().next}
          </span>
        </div>
        <SegmentedProgress
          value={level().current}
          max={level().span}
          color="pink"
          striped
          label={`Progress from level ${level().level} to level ${level().next}`}
          valueText={`${formatNumber(level().current)} / ${formatNumber(level().span)} XP — ${formatNumber(level().remaining)} XP to level ${level().next}`}
        />
        <div class="mt-space-sm flex items-center justify-between font-label-data text-label-data font-bold">
          <span class="text-accent-secondary">◇ LVL {level().level}</span>
          <span class="text-accent-primary">LVL {level().next} ◇</span>
        </div>
      </div>

      <div class="mt-space-md flex flex-wrap items-center justify-between gap-space-sm rounded-md border border-dashed border-border-default/60 p-space-md">
        <span class="font-label-data text-label-data font-bold text-text-muted">
          RANKED // ELO &amp; DIVISIONS
        </span>
        <Badge variant="outline">{COMING_SOON}</Badge>
      </div>
    </section>
  );
}
