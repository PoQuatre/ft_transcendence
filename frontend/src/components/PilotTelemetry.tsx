import { createMemo } from 'solid-js';

import { Avatar, Badge, Card, SegmentedProgress } from '~/components/ui';
import { levelProgress } from '~/lib/level';

export type PilotTelemetryData = {
  name: string;
  position: number;
  xp: number;
  best: number;
  matches: number;
  delta: number;
  gain: number;
};

const number = (value: number) => value.toLocaleString('en-US');

export function PilotTelemetry(props: { telemetry: PilotTelemetryData }) {
  const level = createMemo(() => levelProgress(props.telemetry.xp));
  return (
    <Card
      class="arena-panel arena-telemetry relative min-w-0 flex flex-col items-center rounded-lg border border-accent-primary/40 bg-surface-1 p-6 text-center shadow-sm transition-shadow duration-200 hover:shadow-glow-cyan-soft"
      aria-labelledby="pilot-telemetry-title"
    >
      <h2
        id="pilot-telemetry-title"
        class="w-full font-label-mono-caps text-label-mono-caps! tracking-widest! text-accent-primary"
      >
        YOUR PILOT TELEMETRY
      </h2>
      <Avatar
        fallback={props.telemetry.name[0]}
        class="mt-5 h-16 w-16 border-accent-primary bg-accent-primary-subtle text-accent-primary shadow-glow-cyan-md [&>div]:text-current [&>div]:text-stat-counter"
        aria-hidden="true"
      />
      <h3
        class="mt-3 max-w-full truncate text-lg font-bold tracking-wide text-text-primary"
        title={props.telemetry.name}
      >
        {props.telemetry.name}
      </h3>
      <Badge
        variant="secondary"
        class="mt-2 rounded-pill border border-accent-secondary/40 bg-accent-secondary-subtle px-3 py-1 font-label-data text-label-data font-bold tracking-widest text-accent-secondary"
      >
        ◇ LEVEL {level().level}
      </Badge>
      <div class="mt-5 font-label-data">
        <p class="text-label-data tracking-widest text-text-muted">
          CURRENT XP
        </p>
        <p class="text-5xl font-bold tabular-nums tracking-tight text-accent-primary neon-text-cyan">
          {number(props.telemetry.xp)}
        </p>
        <p
          class={[
            'mt-2 text-label-data font-bold',
            {
              'text-success-foreground': props.telemetry.delta >= 0,
              'text-error-foreground': props.telemetry.delta < 0,
            },
          ]}
        >
          {props.telemetry.delta >= 0 ? '↑ +' : '↓ '}
          {number(props.telemetry.delta)} XP
          <span class="text-text-muted">
            {' '}
            · {props.telemetry.gain >= 0 ? '+' : ''}
            {props.telemetry.gain} RANK
          </span>
        </p>
      </div>
      <dl class="my-5 grid w-full grid-cols-3 gap-2 border-y border-border-subtle py-4 font-label-data">
        <div>
          <dt class="text-label-data tracking-wider text-text-muted">RANK</dt>
          <dd class="mt-1 text-sm font-bold tabular-nums text-text-primary">
            #{props.telemetry.position}
          </dd>
        </div>
        <div>
          <dt class="text-label-data tracking-wider text-text-muted">
            MATCHES
          </dt>
          <dd class="mt-1 text-sm font-bold tabular-nums text-text-primary">
            {number(props.telemetry.matches)}
          </dd>
        </div>
        <div>
          <dt class="text-label-data tracking-wider text-text-muted">
            BEST MATCH
          </dt>
          <dd class="mt-1 text-sm font-bold tabular-nums text-text-primary">
            {number(props.telemetry.best)}
          </dd>
        </div>
      </dl>
      <div class="arena-division mt-auto w-full rounded-md border border-accent-primary/30 bg-accent-primary-subtle/40 p-3 text-left font-label-data">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-label-data">
          <span class="font-bold tracking-widest text-accent-primary">
            LEVEL PROGRESS
          </span>
          <span class="text-text-secondary">
            {number(level().remaining)} XP TO LEVEL {level().next}
          </span>
        </div>
        <SegmentedProgress
          value={level().current}
          max={level().span}
          color="pink"
          striped
          label={`Progress from level ${level().level} to level ${level().next}`}
          valueText={`${number(level().current)} / ${number(level().span)} XP — ${number(level().remaining)} XP to level ${level().next}`}
        />
        <div class="mt-2 flex items-center justify-between text-label-data font-bold tracking-widest">
          <span class="text-accent-secondary">◇ LVL {level().level}</span>
          <span class="text-text-muted">
            {number(level().current)} / {number(level().span)} XP
          </span>
          <span class="text-accent-primary">LVL {level().next} ◇</span>
        </div>
      </div>
    </Card>
  );
}
