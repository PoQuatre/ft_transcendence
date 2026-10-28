import { Title } from '@solidjs/meta';
import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js';

import { PilotTelemetry } from '~/components/PilotTelemetry';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Progress,
  Select,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '~/components/ui';
import { paginate, PAGE_SIZES, type PageSize } from '~/lib/pagination';
import { cn } from '~/lib/utils';

import './leaderboard.css';

const ACTIVE_FILTER_CLASS =
  'active border-accent-primary bg-accent-primary-subtle text-accent-primary shadow-glow-cyan-sm';
const ACTION_BUTTON_CLASS =
  'min-h-11 rounded-md border-border-subtle bg-surface-2 font-label-data text-label-data text-text-secondary hover:border-accent-primary';
const COLUMN_HEADING_CLASS =
  'px-space-md text-left font-label-data text-label-data font-bold tracking-wider text-text-muted';
const SORT_BUTTON_CLASS =
  'cursor-pointer bg-transparent border-0 font-bold h-auto min-h-11 rounded-sm p-0 font-label-data text-label-data text-inherit md:min-h-8 pointer-coarse:min-h-11';

type Pilot = {
  name: string;
  kills: number;
  kd: number;
  change: number;
  rate: number;
  wins: number;
  delta: number;
  elo: number;
};

const pilots: readonly Pilot[] = [
  {
    name: 'NEOVIM',
    kills: 4268,
    kd: 5.82,
    change: 2,
    rate: 72.8,
    wins: 882,
    delta: 148,
    elo: 3850,
  },
  {
    name: 'V3X_PILOT',
    kills: 3981,
    kd: 3.54,
    change: 1,
    rate: 70.4,
    wins: 543,
    delta: 32,
    elo: 2725,
  },
  {
    name: 'KAIROS',
    kills: 3754,
    kd: 3.31,
    change: 0,
    rate: 68.9,
    wins: 509,
    delta: 21,
    elo: 2610,
  },
  {
    name: 'NULLBYTE',
    kills: 3412,
    kd: 3.05,
    change: -1,
    rate: 67.1,
    wins: 472,
    delta: -14,
    elo: 2490,
  },
  {
    name: 'ION_RIDER',
    kills: 3098,
    kd: 2.84,
    change: 1,
    rate: 64.5,
    wins: 431,
    delta: 16,
    elo: 2375,
  },
  {
    name: 'CHROMA',
    kills: 2856,
    kd: 2.62,
    change: -2,
    rate: 62.3,
    wins: 398,
    delta: -20,
    elo: 2260,
  },
  {
    name: 'GHOSTWIRE',
    kills: 2604,
    kd: 3.41,
    change: 0,
    rate: 60.1,
    wins: 362,
    delta: 5,
    elo: 2145,
  },
  {
    name: 'VSCODE',
    kills: 2317,
    kd: 1.18,
    change: 2,
    rate: 57.8,
    wins: 327,
    delta: 24,
    elo: 230,
  },
];

const pilotTelemetry = {
  name: 'V3X_PILOT',
  position: 2,
  elo: 2725,
  best: 2780,
  matches: 771,
  delta: 32,
  gain: 1,
  remaining: 75,
  progress: 81.25,
};

const metrics = [
  { key: 'elo', label: 'ELO RATING' },
  { key: 'kills', label: 'KILLS' },
  { key: 'kd', label: 'K/D RATIO' },
  { key: 'rate', label: 'WIN RATE' },
  { key: 'wins', label: 'WINS' },
] as const;
type Metric = (typeof metrics)[number]['key'];
const modes = [
  { key: 'ffa', label: 'FREE-FOR-ALL', short: 'FFA SOLO' },
  { key: 'squad', label: 'SQUAD 4V4', short: 'SQUAD 4V4' },
  { key: 'ctf', label: 'CTF', short: 'CAPTURE THE FLAG' },
  { key: 'overload', label: 'OVERLOAD', short: 'OVERLOAD' },
] as const;
const periods = [
  { key: 'all', label: 'ALL TIME' },
  { key: 'season', label: 'THIS SEASON' },
  { key: 'month', label: 'THIS MONTH' },
  { key: 'week', label: 'THIS WEEK' },
] as const;

const columns: readonly { label: string; metric?: Metric }[] = [
  { label: 'RANK' },
  { label: 'CALLSIGN' },
  { label: 'KILLS', metric: 'kills' },
  { label: 'K/D', metric: 'kd' },
  { label: 'Δ RANK' },
  { label: 'WIN RATE', metric: 'rate' },
  { label: 'WINS', metric: 'wins' },
  { label: 'Δ ELO' },
  { label: 'ELO', metric: 'elo' },
];

const number = (value: number) => value.toLocaleString('en-US');

function comparePilotNames(a: Pilot, b: Pilot) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

function createLeaderboard() {
  const [search, setSearch] = createSignal('');
  const [metric, setMetric] = createSignal<Metric>('elo');
  const [mode, setMode] = createSignal('ffa');
  const [period, setPeriod] = createSignal('all');
  const [descending, setDescending] = createSignal(true);
  const [page, setPage] = createSignal(1);
  const [pageSize, setPageSize] = createSignal<PageSize>(20);
  const selectedMode = createMemo(() =>
    modes.find((item) => item.key === mode())!,
  );
  const selectedPeriod = createMemo(() =>
    periods.find((item) => item.key === period())!,
  );
  const data = createMemo(() => pilots);
  const leaders = createMemo(() =>
    data()
      .toSorted((a, b) => b.elo - a.elo || comparePilotNames(a, b))
      .slice(0, 3),
  );
  const podium = createMemo(() => {
    const top = leaders();
    return top.length === 3 ? [top[1]!, top[0]!, top[2]!] : top;
  });
  const ranked = createMemo(() => {
    const key = metric();
    const direction = descending() ? -1 : 1;
    return data().toSorted(
      (a, b) => direction * (a[key] - b[key]) || comparePilotNames(a, b),
    );
  });
  let standingsBody: HTMLTableSectionElement | undefined;
  let animationFrame: number | undefined;
  onCleanup(() => {
    if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
  });
  function animateRanking(update: () => void) {
    const previous = new Map(
      Array.from(standingsBody?.rows ?? []).map((row) => [
        row.dataset.pilot,
        row.getBoundingClientRect().top,
      ]),
    );
    update();
    if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(() => {
      animationFrame = undefined;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      Array.from(standingsBody?.rows ?? []).forEach((row) => {
        const top = previous.get(row.dataset.pilot);
        if (top === undefined) return;
        const offset = top - row.getBoundingClientRect().top;
        if (Math.abs(offset) < 1) return;
        row.animate(
          [
            { transform: `translateY(${offset}px)`, opacity: 0.65 },
            { transform: 'translateY(0)', opacity: 1 },
          ],
          { duration: 460, easing: 'cubic-bezier(.22,1,.36,1)' },
        );
      });
    });
  }
  function sortBy(key: Metric) {
    const nextDescending = key === metric() ? !descending() : true;
    animateRanking(() => {
      setMetric(key);
      setDescending(nextDescending);
      setPage(1);
    });
  }

  const filtered = createMemo(() =>
    ranked().filter((pilot) =>
      pilot.name.toLowerCase().includes(search().trim().toLowerCase()),
    ),
  );
  const pagination = createMemo(() => paginate(filtered(), page(), pageSize()));

  function changePageSize(value: number) {
    if (PAGE_SIZES.some((size) => size === value)) {
      setPageSize(value as PageSize);
      setPage(1);
    }
  }

  const setStandingsBody = (element: HTMLTableSectionElement) => {
    standingsBody = element;
  };
  return {
    search,
    setSearch,
    metric,
    setMetric,
    mode,
    setMode,
    period,
    setPeriod,
    descending,
    selectedMode,
    selectedPeriod,
    data,
    leaders,
    podium,
    ranked,
    sortBy,
    filtered,
    pagination,
    pageSize,
    changePageSize,
    setPage,
    setStandingsBody,
  };
}

type LeaderboardState = ReturnType<typeof createLeaderboard>;

function RankingFilters(props: { state: LeaderboardState }) {
  return (
    <>
      <Card
        variant="panel"
        class={cn(
          ` arena-filters mt-7 flex flex-wrap items-end
          gap-3 p-space-md md:p-space-lg min-h-[72px] xl:flex-nowrap xl:gap-space-lg
        `,
        )}
        aria-label="Ranking filters"
      >
        <fieldset class="m-0 w-full min-w-0 flex-1 basis-full border-0 p-0 xl:w-auto xl:basis-auto">
          <legend class="mb-space-xs font-label-data text-label-data text-text-muted">
            RANKING MODE
          </legend>
          <div
            class="
          arena-mode-buttons grid grid-cols-2 gap-space-sm md:flex md:max-w-[655px]
        "
          >
            <For each={modes}>
              {(item) => (
                <Button
                  variant="filter"
                  size="sm"
                  type="button"
                  class={cn(
                    'arena-mode-button min-w-0 flex-1 whitespace-nowrap',
                    props.state.mode() === item.key && ACTIVE_FILTER_CLASS,
                  )}
                  aria-pressed={
                    props.state.mode() === item.key ? 'true' : 'false'
                  }
                  onClick={() => {
                    props.state.setMode(item.key);
                    props.state.setPage(1);
                  }}
                >
                  {item.label}
                </Button>
              )}
            </For>
          </div>
        </fieldset>
        <div
          class="
          arena-period font-label-data text-label-data text-text-muted flex flex-col gap-space-xs w-full md:w-[180px]
        "
        >
          PERIOD
          <Select
            aria-label="Ranking period"
            options={periods.map((item) => ({
              value: item.key,
              label: item.label,
            }))}
            value={props.state.period()}
            onChange={(value) => {
              props.state.setPeriod(value);
              props.state.setPage(1);
            }}
          />
        </div>
        <label
          class="
          arena-search w-full basis-full flex items-center gap-space-xs border border-border-subtle rounded-md bg-background
          h-11 px-2 text-text-muted md:h-7 md:basis-auto md:flex-1 md:gap-3 md:px-space-md xl:w-[275px] xl:flex-none
          focus-within:border-accent-primary focus-within:shadow-glow-cyan-sm pointer-coarse:min-h-11
        "
        >
          <span aria-hidden="true">⌕</span>
          <Input
            class="h-[42px] w-full min-w-0 border-0 bg-transparent px-0 py-0 text-label-data text-text-primary placeholder:text-text-muted focus:ring-0 focus-visible:outline-none md:h-auto pointer-coarse:min-h-[42px]"
            type="search"
            aria-label="Search pilot"
            placeholder="SEARCH PILOT..."
            value={props.state.search()}
            onInput={(event) => {
              props.state.setSearch(event.currentTarget.value);
              props.state.setPage(1);
            }}
          />
        </label>
      </Card>
      <Card
        variant="panel"
        class={cn(
          ` arena-sort mt-space-lg
          p-space-md md:p-space-lg
        `,
        )}
        aria-label="Sort standings"
      >
        <div
          class="
          arena-sort-heading flex flex-col items-start gap-space-xs md:flex-row md:items-center md:gap-5
          font-label-data text-label-data text-accent-primary mb-space-sm
        "
        >
          <span class="text-label-data">
            SORT BY&nbsp; / &nbsp;COMPETITIVE METRICS
          </span>
          <small class="font-normal text-label-data">
            {props.state.descending()
              ? '↓  DESCENDING · HIGHEST FIRST'
              : '↑  ASCENDING · LOWEST FIRST'}
          </small>
        </div>
        <div
          class="
          arena-sort-buttons flex flex-wrap items-center gap-2 md:flex-nowrap md:gap-2.5
        "
        >
          <For each={metrics}>
            {(item) => (
              <Button
                variant="filter"
                size="sm"
                class={cn(
                  'flex-[1_0_28%] md:flex-1 xl:w-[15%] xl:max-w-[184px] xl:flex-none',
                  props.state.metric() === item.key && ACTIVE_FILTER_CLASS,
                )}
                aria-pressed={
                  props.state.metric() === item.key ? 'true' : 'false'
                }
                onClick={() => props.state.sortBy(item.key)}
              >
                {props.state.metric() === item.key ? '●  ' : ''}
                {item.label}
              </Button>
            )}
          </For>
        </div>
      </Card>
    </>
  );
}

function PodiumCard(props: { pilot: Pilot; place: number }) {
  const place = () => props.place;
  return (
    <article
      class={cn(
        `arena-podium-item relative min-w-0 h-auto md:h-[310px]`,
        place() === 1 &&
          'order-first md:order-none md:h-[360px] text-accent-primary arena-podium-champion',
        place() === 2 && 'md:h-[320px] text-text-secondary',
        place() === 3 && 'text-podium-bronze',
      )}
    >
      <Badge
        variant="outline"
        class="z-10 absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill border border-current bg-background px-3 py-1 font-label-data text-label-data text-current font-bold tracking-widest whitespace-nowrap"
      >
        {place() === 1 ? 'APEX CHAMPION' : `RANK 0${place()}`}
      </Badge>
      <Card
        class={[
          `arena-pilot arena-legendary relative min-w-0 flex h-full min-h-[290px] flex-col items-center rounded-lg border border-current bg-background p-space-md pt-space-lg text-center text-accent-primary`,
          {
            'arena-place-1': place() === 1,
            'arena-place-2': place() === 2,
            'arena-place-3': place() === 3,
          },
        ]}
      >
        <Show when={place() === 1}>
          <svg
            class="arena-crown mb-space-sm h-6 w-6 shrink-0 text-accent-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m3 6 4 4 5-7 5 7 4-4-3 12H6L3 6Z" />
            <path d="M7 21h10" />
          </svg>
        </Show>
        <Avatar
          fallback={props.pilot.name[0]}
          class="arena-podium-avatar h-16 w-16 border-current bg-surface-2 [&>div]:text-current [&>div]:text-stat-counter"
          aria-hidden="true"
        />
        <h3
          class="mt-3 w-full truncate text-base font-bold tracking-wide text-text-primary"
          title={props.pilot.name}
        >
          {props.pilot.name}
        </h3>
        <div class="mt-3 font-label-data">
          <p class="text-label-data tracking-widest text-text-muted">
            ELO RATING
          </p>
          <p class="font-stat-counter text-stat-counter font-bold tabular-nums">
            {number(props.pilot.elo)}
          </p>
        </div>
        <div class="mt-auto pt-5 w-full font-label-data">
          <div class="grid grid-cols-2 gap-2 border-t border-border-subtle pt-3">
            <div>
              <p class="text-label-data tracking-widest text-text-muted">
                WINS
              </p>
              <p class="mt-1 text-sm font-bold tabular-nums text-text-primary">
                {number(props.pilot.wins)}
              </p>
            </div>
            <div>
              <p class="text-label-data tracking-widest text-text-muted">
                WIN RATE
              </p>
              <p class="mt-1 text-sm font-bold tabular-nums text-text-primary">
                {props.pilot.rate}%
              </p>
            </div>
          </div>
          <Progress
            value={props.pilot.rate}
            color={place() === 3 ? 'amber' : 'cyan'}
            class="mt-space-sm rounded-pill bg-border-subtle [&>div]:h-full [&>div]:bg-current"
            aria-hidden="true"
          />
        </div>
      </Card>
    </article>
  );
}

function LeaderboardOverview(props: { state: LeaderboardState }) {
  return (
    <div
      class="
          arena-overview grid grid-cols-1 gap-5 mt-space-lg md:gap-6
          xl:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]
        "
    >
      <Card
        variant="panel"
        class={cn(
          ` arena-apex overflow-visible p-space-md md:p-space-lg
        `,
        )}
      >
        <div
          class="
          arena-apex-heading flex justify-between items-center gap-space-md md:gap-0
        "
        >
          <div>
            <p class="arena-eyebrow font-label-data text-label-data font-bold text-accent-primary tracking-wide">
              ◇ &nbsp;ELITE OPERATORS
            </p>
            <h2 class="mt-space-xs font-headline-md text-headline-md font-bold">
              THE APEX THREE
            </h2>
          </div>
          <small class="max-w-20 text-right text-label-data md:max-w-none">
            HIGHEST ELO RATINGS
          </small>
        </div>
        <div
          class="
          arena-podium grid grid-cols-1 gap-5 items-end mt-8
          md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] md:gap-3
        "
        >
          <For
            each={props.state.podium()}
            fallback={
              <p class="col-span-full py-8 text-center text-sm leading-7 text-text-muted">
                No ranking data available yet.
              </p>
            }
          >
            {(pilot) => (
              <PodiumCard
                pilot={pilot}
                place={props.state.leaders().indexOf(pilot) + 1}
              />
            )}
          </For>
        </div>
      </Card>
      <PilotTelemetry telemetry={pilotTelemetry} />
    </div>
  );
}

function PilotStandings(props: { state: LeaderboardState }) {
  let tableScroll: HTMLElement | undefined;

  return (
    <Card
      variant="panel"
      class={cn(
        ` arena-standings mt-5 md:mt-7
          p-space-md md:p-space-lg
        `,
      )}
    >
      <div
        class="
          arena-table-heading flex flex-col items-start justify-between gap-space-xs mb-space-xs
          md:flex-row md:items-center md:gap-0
        "
      >
        <div>
          <p class="arena-eyebrow font-label-data text-label-data font-bold text-accent-primary tracking-wide">
            [ GLOBAL TOP {props.state.data().length} ]
          </p>
          <h2 class="mt-space-xs font-headline-md text-headline-md font-bold">
            PILOT STANDINGS
          </h2>
        </div>
        <small class="m-0 font-bold md:mt-5 md:ml-5">
          SORTED BY{' '}
          {metrics.find((item) => item.key === props.state.metric())?.label}
          &nbsp; • &nbsp;{props.state.selectedMode().short}
        </small>
      </div>
      <p
        class="
          arena-scroll-hint block xl:hidden font-label-data text-label-data text-text-muted py-space-sm
        "
      >
        ↔ Scroll the table to explore all pilot statistics.
      </p>
      <div
        class="flex gap-space-sm pb-space-sm xl:hidden"
        aria-label="Table scroll controls"
      >
        <Button
          variant="filter"
          size="sm"
          type="button"
          aria-label="Scroll standings left"
          aria-controls="pilot-standings-scroll"
          onClick={() =>
            tableScroll?.scrollBy({ left: -250, behavior: 'auto' })
          }
        >
          ←
        </Button>
        <Button
          variant="filter"
          size="sm"
          type="button"
          aria-label="Scroll standings right"
          aria-controls="pilot-standings-scroll"
          onClick={() => tableScroll?.scrollBy({ left: 250, behavior: 'auto' })}
        >
          →
        </Button>
      </div>
      <section
        ref={(element) => (tableScroll = element)}
        id="pilot-standings-scroll"
        class="
          arena-table-scroll overflow-x-auto [scrollbar-width:thin] [scrollbar-color:var(--color-border-default)_var(--color-surface-1)] rounded-md
          focus-visible:outline-offset-2
        "
        aria-label="Pilot standings, scroll horizontally for all statistics"
      >
        <table class="arena-standings-table w-full min-w-[850px] table-fixed border-separate border-spacing-y-2 whitespace-nowrap text-left font-label-data text-label-data">
          <caption class="sr-only">
            {props.state.selectedMode().label} standings ·{' '}
            {props.state.selectedPeriod().label}. Fixed mockup data, shared
            across all modes and periods.
          </caption>
          <colgroup>
            <col class="w-[8%]" />
            <col class="w-[20%]" />
            <col class="w-[10%]" />
            <col class="w-[9%]" />
            <col class="w-[9%]" />
            <col class="w-[12%]" />
            <col class="w-[9%]" />
            <col class="w-[10%]" />
            <col class="w-[13%]" />
          </colgroup>
          <thead>
            <tr>
              <For each={columns}>
                {(column) => (
                  <th
                    class={COLUMN_HEADING_CLASS}
                    scope="col"
                    aria-sort={
                      column.metric
                        ? props.state.metric() === column.metric
                          ? props.state.descending()
                            ? 'descending'
                            : 'ascending'
                          : 'none'
                        : undefined
                    }
                  >
                    <Show when={column.metric} fallback={column.label} keyed>
                      {(metric) => (
                        <button
                          class={SORT_BUTTON_CLASS}
                          type="button"
                          onClick={() => props.state.sortBy(metric)}
                        >
                          {column.label}{' '}
                          <Show when={props.state.metric() === metric}>
                            <Show when={props.state.descending()} fallback="↑">
                              ↓
                            </Show>
                          </Show>
                        </button>
                      )}
                    </Show>
                  </th>
                )}
              </For>
            </tr>
          </thead>
          <TableBody ref={props.state.setStandingsBody}>
            <For each={props.state.pagination().items}>
              {(pilot) => (
                <TableRow
                  data-pilot={pilot.name}
                  class={{
                    'arena-rank-1': props.state.ranked().indexOf(pilot) === 0,
                  }}
                >
                  <TableCell>
                    <Show
                      when={props.state.ranked().indexOf(pilot) === 0}
                      fallback={String(
                        props.state.ranked().indexOf(pilot) + 1,
                      ).padStart(2, '0')}
                    >
                      <span class="sr-only">Rank 1</span>
                      <svg
                        class="h-5 w-5 text-accent-primary"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.75"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m3 6 4 4 5-7 5 7 4-4-3 12H6L3 6Z" />
                        <path d="M7 21h10" />
                      </svg>
                    </Show>
                  </TableCell>
                  <TableHead
                    scope="row"
                    class="truncate text-text-primary"
                    title={pilot.name}
                  >
                    {pilot.name}
                  </TableHead>
                  <TableCell>{number(pilot.kills)}</TableCell>
                  <TableCell>{pilot.kd.toFixed(2)}</TableCell>
                  <TableCell
                    class={{
                      'text-success-foreground!': pilot.change > 0,
                      'text-error-foreground!': pilot.change < 0,
                    }}
                  >
                    {pilot.change === 0
                      ? '—'
                      : `${pilot.change > 0 ? '↑' : '↓'} ${Math.abs(pilot.change)}`}
                  </TableCell>
                  <TableCell>{pilot.rate.toFixed(1)}%</TableCell>
                  <TableCell>{pilot.wins}</TableCell>
                  <TableCell class={{ 'arena-cyan': pilot.delta > 0 }}>
                    {pilot.delta > 0 ? '+' : ''}
                    {pilot.delta}
                  </TableCell>
                  <TableCell>{number(pilot.elo)}</TableCell>
                </TableRow>
              )}
            </For>
          </TableBody>
        </table>
      </section>
      <output class="sr-only" aria-live="polite">
        {props.state.filtered().length} pilots ·{' '}
        {props.state.selectedMode().label} ·{' '}
        {props.state.selectedPeriod().label} · sorted by {props.state.metric()}{' '}
        {props.state.descending() ? 'descending' : 'ascending'}
      </output>
      <Show when={props.state.filtered().length === 0}>
        <div class="arena-empty text-center p-space-lg text-text-muted block leading-[1.6]">
          <Show
            when={props.state.data().length > 0}
            fallback={
              <p>
                No ranking data available yet. Match statistics will appear when
                the data source is connected.
              </p>
            }
          >
            <p>No pilots found for “{props.state.search()}”.</p>
            <Button
              variant="outline"
              size="sm"
              class={cn(ACTION_BUTTON_CLASS, 'mt-3')}
              type="button"
              onClick={() => props.state.setSearch('')}
            >
              CLEAR SEARCH
            </Button>
          </Show>
        </div>
      </Show>
      <div class="mt-space-lg flex flex-wrap items-center justify-between gap-space-md font-label-data text-label-data text-text-muted">
        <div class="flex items-center gap-space-sm">
          PILOTS PER PAGE
          <Select
            aria-label="Pilots per page"
            options={PAGE_SIZES.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            value={String(props.state.pageSize())}
            onChange={(value) => props.state.changePageSize(Number(value))}
          />
        </div>
        <span aria-live="polite">
          {props.state.pagination().start}–{props.state.pagination().end} /{' '}
          {props.state.filtered().length} PILOTS
          {' · '}PAGE {props.state.pagination().page} /{' '}
          {props.state.pagination().totalPages}
        </span>
        <nav aria-label="Standings pagination" class="flex gap-space-sm">
          <Button
            variant="filter"
            size="sm"
            type="button"
            disabled={props.state.pagination().page <= 1}
            onClick={() =>
              props.state.setPage(props.state.pagination().page - 1)
            }
          >
            PREVIOUS
          </Button>
          <Button
            variant="filter"
            size="sm"
            type="button"
            disabled={
              props.state.pagination().page >=
              props.state.pagination().totalPages
            }
            onClick={() =>
              props.state.setPage(props.state.pagination().page + 1)
            }
          >
            NEXT
          </Button>
        </nav>
      </div>
    </Card>
  );
}

export default function Leaderboard() {
  const state = createLeaderboard();
  return (
    <div
      class="
          arena-page relative overflow-x-hidden min-h-screen isolate bg-background text-text-primary
          font-body-sm text-body-sm scheme-dark
        "
    >
      <Title>Arena Leaderboard — Transcedance</Title>
      <div aria-hidden="true" class="fixed inset-0 z-0 pointer-events-none">
        <div class="absolute inset-0 tactical-grid opacity-80" />
        <div class="absolute -top-48 -left-32 w-96 h-96 bg-accent-primary/15 rounded-pill blur-3xl" />
        <div class="absolute top-1/3 -right-48 w-96 h-96 bg-accent-secondary/15 rounded-pill blur-3xl" />
        <div class="absolute -bottom-48 left-1/3 w-96 h-96 bg-accent-secondary/10 rounded-pill blur-3xl" />
      </div>
      <main class="arena-main container relative z-10 mx-auto max-w-7xl px-4 lg:px-8 pt-8 pb-8 md:pb-12">
        <section class="arena-intro mb-8 space-y-2 border-b border-border-subtle/85 pb-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center space-x-2">
              <span
                class="inline-block w-2.5 h-2.5 bg-accent-primary shadow-glow-cyan"
                aria-hidden="true"
              />
              <span class="font-label-mono-caps text-label-mono-caps font-bold tracking-widest text-accent-primary uppercase">
                // GLOBAL PILOT RANKINGS
              </span>
            </div>
          </div>
          <h1 class="mt-1 font-display-hero text-display-hero-mobile md:text-display-hero font-bold text-text-primary uppercase">
            ARENA{' '}
            <span class="text-accent-primary neon-text-cyan">LEADERBOARD</span>
          </h1>
          <p class="arena-description font-label-data text-text-muted text-body-sm max-w-3xl pt-1">
            Track the deadliest pilots. Dominate the arena. Climb the global
            rankings.
          </p>
        </section>
        <LeaderboardOverview state={state} />
        <RankingFilters state={state} />
        <PilotStandings state={state} />
      </main>
    </div>
  );
}
