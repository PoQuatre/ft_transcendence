import { Title } from '@solidjs/meta';
import { createMemo, createSignal, For, onCleanup, Show } from 'solid-js';

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
    name: 'NEONVOID',
    kills: 4268,
    kd: 3.82,
    change: 2,
    rate: 72.8,
    wins: 582,
    delta: 48,
    elo: 2850,
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
    });
  }
  function resetFilters() {
    setMode('ffa');
    setPeriod('all');
    setSearch('');
    setMetric('elo');
    setDescending(true);
  }
  const filtered = createMemo(() =>
    ranked().filter((pilot) =>
      pilot.name.toLowerCase().includes(search().trim().toLowerCase()),
    ),
  );

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
    resetFilters,
    filtered,
    setStandingsBody,
  };
}

type LeaderboardState = ReturnType<typeof createLeaderboard>;

function RankingFilters(props: { state: LeaderboardState }) {
  return (
    <>
      <section
        class="
          arena-panel bg-surface-1 border border-border-subtle rounded-[14px] min-w-0 arena-filters mt-7 flex items-end
          gap-[23px] p-[11px_24px_10px_19px] min-h-[72px]
          animate-[arena-enter_0.6s_0.08s_cubic-bezier(0.22,_1,_0.36,_1)_both] [&_fieldset]:border-0
          [&_fieldset]:p-0 [&_fieldset]:m-0 [&_fieldset]:flex-1 [&_fieldset]:min-w-0
          [&_legend]:[font:10px_'IBM_Plex_Mono',_monospace] [&_legend]:text-text-muted [&_legend]:mb-[7px]
          [@media(max-width:1100px)]:flex-wrap [@media(max-width:1100px)]:[&_fieldset]:[flex-basis:100%]
          [@media(max-width:650px)]:p-[15px] [@media(max-width:650px)]:gap-[12px]
          [@media(min-width:1101px)_and_(max-width:1280px)]:gap-[12px]
          [@media(min-width:1101px)_and_(max-width:1280px)]:pr-[18px]
          [@media(max-width:650px)]:[&_fieldset]:min-w-0 [@media(max-width:650px)]:[&_fieldset]:w-full
        "
        aria-label="Ranking filters"
      >
        <fieldset>
          <legend>RANKING MODE</legend>
          <div
            class="
          arena-mode-buttons flex gap-[9px] max-w-[655px] [&_button]:flex-1 [&_button]:whitespace-nowrap
          [@media(max-width:650px)]:grid [@media(max-width:650px)]:grid-cols-[1fr_1fr]
          [@media(max-width:650px)]:max-w-none
          [@media(min-width:1101px)_and_(max-width:1280px)]:[&_button]:px-[8px]
          [@media(min-width:1101px)_and_(max-width:1280px)]:[&_button]:text-[10px]
          [@media(max-width:650px)]:[&_button]:min-w-0 [@media(max-width:650px)]:[&_button]:min-h-[44px]
        "
          >
            <For each={modes}>
              {(item) => (
                <button
                  type="button"
                  class={{ active: props.state.mode() === item.key }}
                  aria-pressed={
                    props.state.mode() === item.key ? 'true' : 'false'
                  }
                  onClick={() => props.state.setMode(item.key)}
                >
                  {item.label}
                </button>
              )}
            </For>
          </div>
        </fieldset>
        <label
          class="
          arena-period [font:10px_'IBM_Plex_Mono',_monospace] text-text-muted flex flex-col gap-[6px] w-[180px]
          [&_select]:h-[28px] [&_select]:border [&_select]:border-border-subtle [&_select]:rounded-[6px]
          [&_select]:bg-surface-2 [&_select]:text-text-primary [&_select]:text-[11px] [&_select]:p-[0_16px]
          [@media(max-width:650px)]:w-full [@media(min-width:1101px)_and_(max-width:1280px)]:w-[145px]
          [@media(pointer:coarse)]:[&_select]:min-h-[44px] [@media(max-width:650px)]:[&_select]:h-[44px]
        "
        >
          PERIOD
          <select
            aria-label="Ranking period"
            value={props.state.period()}
            onChange={(event) =>
              props.state.setPeriod(event.currentTarget.value)
            }
          >
            <For each={periods}>
              {(item) => <option value={item.key}>{item.label}</option>}
            </For>
          </select>
        </label>
        <label
          class="
          arena-search w-[275px] flex items-center gap-[12px] border border-border-subtle rounded-[6px] bg-background
          h-[28px] p-[0_15px] text-text-muted [&_input]:bg-none [&_input]:border-0 [&_input]:text-text-primary
          [&_input]:min-w-0 [&_input]:w-full [&_input]:text-[11px] [&_input::placeholder]:text-text-muted
          [@media(max-width:1100px)]:flex-1 [@media(max-width:650px)]:p-[0_8px] [@media(max-width:650px)]:gap-[5px]
          [@media(max-width:650px)]:[flex-basis:100%] [@media(max-width:650px)]:w-full
          [@media(max-width:650px)]:h-[44px] [&:focus-within]:[border-color:var(--color-accent-primary)]
          [&:focus-within]:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-accent-primary)_7.84%,transparent)] [&_input:focus-visible]:[outline:0]
          [@media(min-width:1101px)_and_(max-width:1280px)]:w-[220px] [@media(pointer:coarse)]:min-h-[44px]
          [@media(pointer:coarse)]:[&_input]:min-h-[42px] [@media(max-width:650px)]:[&_input]:h-[42px]
        "
        >
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Search pilot"
            placeholder="SEARCH PILOT..."
            value={props.state.search()}
            onInput={(event) =>
              props.state.setSearch(event.currentTarget.value)
            }
          />
        </label>
      </section>
      <section
        class="
          arena-panel bg-surface-1 border border-border-subtle rounded-[14px] min-w-0 arena-sort mt-[25px]
          p-[12px_22px_14px] animate-[arena-enter_0.6s_0.14s_cubic-bezier(0.22,_1,_0.36,_1)_both]
          [@media(max-width:650px)]:p-[15px]
        "
        aria-label="Sort standings"
      >
        <div
          class="
          arena-sort-heading flex items-center gap-[20px] [font:700_11px_'IBM_Plex_Mono',_monospace] text-accent-primary
          mb-[11px] [&_small]:font-normal [@media(max-width:650px)]:items-start [@media(max-width:650px)]:flex-col
          [@media(max-width:650px)]:gap-[5px] [@media(max-width:650px)]:[&_span]:text-[10px]
          [@media(max-width:650px)]:[&_small]:text-[9px]
        "
        >
          <span>SORT BY&nbsp; / &nbsp;COMPETITIVE METRICS</span>
          <small>
            {props.state.descending()
              ? '↓  DESCENDING · HIGHEST FIRST'
              : '↑  ASCENDING · LOWEST FIRST'}
          </small>
        </div>
        <div
          class="
          arena-sort-buttons flex items-center gap-[10px] [&_button]:w-[15%] [&_button]:max-w-[184px]
          [&_button]:min-h-[32px] [&_button]:pl-[17px] [&_small]:[align-self:flex-start] [&_small]:pt-[2px]
          [@media(max-width:1100px)]:[&_button]:flex-1 [@media(max-width:1100px)]:[&_button]:w-auto
          [@media(max-width:1100px)]:[&_>_small]:hidden [@media(max-width:650px)]:flex-wrap
          [@media(max-width:650px)]:gap-[8px] [@media(max-width:650px)]:[&_button]:[flex:1_0_28%]
          [@media(max-width:650px)]:[&_button]:text-[10px] [@media(max-width:650px)]:[&_button]:p-[7px]
          [@media(max-width:650px)]:[&_button]:min-h-[44px] [@media(max-width:650px)]:[&_button]:max-w-none
        "
        >
          <For each={metrics}>
            {(item) => (
              <button
                class={{ active: props.state.metric() === item.key }}
                aria-pressed={
                  props.state.metric() === item.key ? 'true' : 'false'
                }
                onClick={() => props.state.sortBy(item.key)}
              >
                {props.state.metric() === item.key ? '●  ' : ''}
                {item.label}
              </button>
            )}
          </For>
        </div>
      </section>
    </>
  );
}

function LeaderboardOverview(props: { state: LeaderboardState }) {
  return (
    <div
      class="
          arena-overview grid grid-cols-[1.9fr_1fr] gap-[24px] mt-[21px] [@media(max-width:1100px)]:grid-cols-[1fr]
          [&_>_*]:min-w-0
          [@media(min-width:1101px)_and_(max-width:1280px)]:grid-cols-[minmax(0,_1.65fr)_minmax(0,_1fr)]
          [@media(max-width:650px)]:gap-[20px]
        "
    >
      <section
        class="
          arena-panel bg-surface-1 border border-border-subtle rounded-[14px] min-w-0 arena-apex p-[18px_23px_25px]
          animate-[arena-enter_0.65s_0.2s_cubic-bezier(0.22,_1,_0.36,_1)_both]
          [@media(max-width:650px)]:p-[18px_14px]
        "
      >
        <div
          class="
          arena-apex-heading flex justify-between items-center [&_>_small]:pr-[78px]
          [@media(max-width:1100px)]:[&_>_small]:p-0 [@media(max-width:650px)]:gap-[15px]
          [@media(max-width:650px)]:[&_>_small]:text-[8px] [@media(max-width:650px)]:[&_>_small]:max-w-[80px]
          [@media(max-width:650px)]:[&_>_small]:text-right
        "
        >
          <div>
            <p class="arena-eyebrow font-ibm-plex-mono text-[11px] font-bold text-accent-primary tracking-[0.1px]">
              ◇ &nbsp;ELITE OPERATORS
            </p>
            <h2>THE APEX THREE</h2>
          </div>
          <small>HIGHEST ELO RATINGS</small>
        </div>
        <div
          class="
          arena-podium grid grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)] gap-3 items-end mt-8
          [@media(max-width:650px)]:grid-cols-1 [@media(max-width:650px)]:gap-5
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
              <article
                class={[
                  `
                    [--legendary-light:var(--color-accent-primary)]
                    isolate
                    [transition:transform_320ms_cubic-bezier(0.22,_1,_0.36,_1),_box-shadow_320ms_ease,_border-color_320ms_ease]
                    [&.arena-place-2]:[--legendary-light:var(--color-neutral-200)]
                    [&.arena-place-3]:[--legendary-light:#cd7f32]
                    before:content-['']
                    before:absolute
                    before:inset-0
                    before:rounded-[inherit]
                    before:pointer-events-none
                    before:opacity-0
                    before:[transition:opacity_320ms_ease]
                    after:content-['']
                    after:absolute
                    after:inset-0
                    after:rounded-[inherit]
                    after:pointer-events-none
                    after:opacity-0
                    after:[transition:opacity_320ms_ease]
                    before:[border:1px_solid_color-mix(in_oklab,_var(--legendary-light)_65%,_transparent)]
                    before:[background:radial-gradient(_ellipse_at_50%_0%,_color-mix(in_oklab,_var(--legendary-light)_12%,_transparent),_transparent_65%_)]
                    before:[box-shadow:inset_0_1px_0_color-mix(in_oklab,_var(--color-text-primary)_55%,_transparent),_inset_0_0_18px_color-mix(in_oklab,_var(--legendary-light)_10%,_transparent)]
                    after:[background-image:linear-gradient(_115deg,_transparent_35%,_color-mix(in_oklab,_var(--legendary-light)_8%,_transparent)_43%,_color-mix(in_oklab,_var(--color-text-primary)_24%,_transparent)_50%,_color-mix(in_oklab,_var(--legendary-light)_8%,_transparent)_57%,_transparent_65%_)]
                    after:[background-size:300%_100%]
                    after:[background-position:100%_0]
                    [@media(hover:hover)_and_(pointer:fine)]:hover:[transform:translateY(-6px)]
                    [@media(hover:hover)_and_(pointer:fine)]:hover:[border-color:var(--legendary-light)]
                    [@media(hover:hover)_and_(pointer:fine)]:hover:[box-shadow:0_18px_32px_-12px_rgb(0_0_0_/_75%),_0_0_28px_-6px_color-mix(in_oklab,_var(--legendary-light)_38%,_transparent)]
                    [@media(hover:hover)_and_(pointer:fine)]:hover:before:opacity-100
                    [@media(hover:hover)_and_(pointer:fine)]:hover:after:opacity-100
                    [@media(hover:hover)_and_(pointer:fine)]:hover:after:[animation:arena-legendary-sheen_850ms_ease-out_both]
                    [@media(hover:hover)_and_(pointer:fine)]:[&.arena-place-1]:hover:z-[2]
                    [@media(hover:hover)_and_(pointer:fine)]:[&.arena-place-1]:hover:[transform:translateY(-12px)_scale(1.035)]
                    [@media(hover:hover)_and_(pointer:fine)]:[&.arena-place-1]:hover:[box-shadow:0_30px_48px_-12px_rgb(0_0_0_/_85%),_0_0_48px_-2px_color-mix(in_oklab,_var(--legendary-light)_65%,_transparent),_0_0_90px_-16px_color-mix(in_oklab,_var(--legendary-light)_35%,_transparent)]
                    [@media(hover:hover)_and_(pointer:fine)]:[&.arena-place-1]:hover:before:[animation:arena-champion-aura_1800ms_ease-out_infinite]
                    [@media(hover:hover)_and_(pointer:fine)]:[&.arena-place-1]:hover:after:[background-image:linear-gradient(_115deg,_transparent_32%,_color-mix(in_oklab,_var(--legendary-light)_22%,_transparent)_43%,_color-mix(in_oklab,_var(--color-text-primary)_60%,_transparent)_50%,_color-mix(in_oklab,_var(--legendary-light)_22%,_transparent)_57%,_transparent_68%_)]
                    [@media(hover:hover)_and_(pointer:fine)]:[&.arena-place-1]:hover:after:[animation:arena-legendary-sheen_1100ms_cubic-bezier(0.22,_1,_0.36,_1)_both]
                    [@media(hover:hover)_and_(pointer:fine)]:[&.arena-place-1]:hover:[&_.material-symbols-outlined]:[filter:drop-shadow(0_0_12px_var(--legendary-light))]
                    [@media(hover:hover)_and_(pointer:fine)]:[&.arena-place-1]:hover:[&_.material-symbols-outlined]:[animation:arena-champion-crown_700ms_cubic-bezier(0.22,_1,_0.36,_1)_both]
                    motion-reduce:hover:transform-none!
                    motion-reduce:[&.arena-place-1]:hover:transform-none!
                    motion-reduce:hover:after:animate-none
                    motion-reduce:hover:after:[background-position:50%_0]
                    arena-pilot arena-legendary relative min-w-0 flex flex-col items-center text-center rounded-lg border border-current
                    bg-background p-4 pt-6 h-[310px] text-accent-primary
                    animate-[arena-enter_0.65s_0.24s_cubic-bezier(0.22,_1,_0.36,_1)_both]
                    [&:where(.arena-place-1)]:h-[360px] [&:where(.arena-place-1)]:shadow-glow-cyan
                    [&:where(.arena-place-1)]:bg-accent-primary-subtle/30
                    [&:where(.arena-place-2)]:text-neutral-200 [&:where(.arena-place-2)]:h-[320px]
                    [&:where(.arena-place-3)]:text-[#cd7f32]
                    [@media(max-width:650px)]:h-auto [@media(max-width:650px)]:min-h-[290px]
                    [@media(max-width:650px)]:[&:where(.arena-place-1)]:order-first
                    [@media(max-width:650px)]:[&:where(.arena-place-1)]:h-auto
                    [@media(max-width:650px)]:[&:where(.arena-place-2)]:h-auto
                    [@media(prefers-reduced-motion:reduce)]:[&:hover]:transform-none
                  `,
                  {
                    'arena-place-1': props.state.leaders().indexOf(pilot) === 0,
                    'arena-place-2': props.state.leaders().indexOf(pilot) === 1,
                    'arena-place-3': props.state.leaders().indexOf(pilot) === 2,
                  },
                ]}
              >
                <span class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-pill border border-current bg-background px-3 py-1 font-mono text-[10px] font-bold tracking-widest whitespace-nowrap">
                  {props.state.leaders().indexOf(pilot) === 0
                    ? 'APEX CHAMPION'
                    : `RANK 0${props.state.leaders().indexOf(pilot) + 1}`}
                </span>
                <Show when={props.state.leaders().indexOf(pilot) === 0}>
                  <span
                    class="material-symbols-outlined mb-2 text-accent-primary"
                    aria-hidden="true"
                  >
                    crown
                  </span>
                </Show>
                <div
                  class="grid place-items-center w-16 h-16 shrink-0 rounded-pill border border-current bg-surface-2 font-mono text-2xl font-bold shadow-[0_0_24px_color-mix(in_oklab,currentColor_18%,transparent)]"
                  aria-hidden="true"
                >
                  {pilot.name[0]}
                </div>
                <h3
                  class="mt-3 w-full truncate text-base font-bold tracking-wide text-text-primary"
                  title={pilot.name}
                >
                  {pilot.name}
                </h3>
                <div class="mt-3 font-mono">
                  <p class="text-[10px] tracking-widest text-text-muted">
                    ELO RATING
                  </p>
                  <p class="text-3xl font-bold tabular-nums tracking-tight">
                    {number(pilot.elo)}
                  </p>
                </div>
                <div class="mt-auto pt-5 w-full font-mono">
                  <div class="grid grid-cols-2 gap-2 border-t border-border-subtle pt-3">
                    <div>
                      <p class="text-[9px] tracking-widest text-text-muted">
                        WINS
                      </p>
                      <p class="mt-1 text-sm font-bold tabular-nums text-text-primary">
                        {number(pilot.wins)}
                      </p>
                    </div>
                    <div>
                      <p class="text-[9px] tracking-widest text-text-muted">
                        WIN RATE
                      </p>
                      <p class="mt-1 text-sm font-bold tabular-nums text-text-primary">
                        {pilot.rate}%
                      </p>
                    </div>
                  </div>
                  <div
                    class="mt-3 h-1 rounded-pill bg-border-subtle overflow-hidden"
                    aria-hidden="true"
                  >
                    <div
                      class="h-full rounded-pill bg-current"
                      style={{ width: `${pilot.rate}%` }}
                    />
                  </div>
                </div>
              </article>
            )}
          </For>
        </div>
      </section>
      <section
        class="arena-panel arena-telemetry relative min-w-0 flex flex-col items-center rounded-lg border border-accent-primary/40 bg-surface-1 p-6 text-center transition-shadow duration-200 hover:shadow-glow-cyan-sm animate-[arena-enter_0.65s_0.28s_cubic-bezier(0.22,_1,_0.36,_1)_both]"
        aria-labelledby="pilot-telemetry-title"
      >
        <h2
          id="pilot-telemetry-title"
          class="w-full font-mono text-xs! tracking-widest! text-accent-primary"
        >
          YOUR PILOT TELEMETRY
        </h2>
        <div
          class="mt-5 grid h-16 w-16 shrink-0 place-items-center rounded-pill border border-accent-primary bg-accent-primary-subtle font-mono text-2xl font-bold text-accent-primary shadow-glow-cyan-md"
          aria-hidden="true"
        >
          {pilotTelemetry.name[0]}
        </div>
        <h3
          class="mt-3 max-w-full truncate text-lg font-bold tracking-wide text-text-primary"
          title={pilotTelemetry.name}
        >
          {pilotTelemetry.name}
        </h3>
        <span class="mt-2 rounded-pill border border-accent-secondary/40 bg-accent-secondary-subtle px-3 py-1 font-mono text-[10px] font-bold tracking-widest text-accent-secondary">
          ◇ ELITE DIVISION
        </span>
        <div class="mt-5 font-mono">
          <p class="text-[10px] tracking-widest text-text-muted">CURRENT ELO</p>
          <p class="text-5xl font-bold tabular-nums tracking-tight text-accent-primary neon-text-cyan">
            {number(pilotTelemetry.elo)}
          </p>
          <p
            class={[
              'mt-2 text-[11px] font-bold',
              {
                'text-success-foreground': pilotTelemetry.delta >= 0,
                'text-error-foreground': pilotTelemetry.delta < 0,
              },
            ]}
          >
            {pilotTelemetry.delta >= 0 ? '↑ +' : '↓ '}
            {pilotTelemetry.delta} ELO
            <span class="text-text-muted">
              {' '}
              · {pilotTelemetry.gain >= 0 ? '+' : ''}
              {pilotTelemetry.gain} RANK
            </span>
          </p>
        </div>
        <dl class="my-5 grid w-full grid-cols-3 gap-2 border-y border-border-subtle py-4 font-mono">
          <div>
            <dt class="text-[9px] tracking-wider text-text-muted">RANK</dt>
            <dd class="mt-1 text-sm font-bold tabular-nums text-text-primary">
              #{pilotTelemetry.position}
            </dd>
          </div>
          <div>
            <dt class="text-[9px] tracking-wider text-text-muted">MATCHES</dt>
            <dd class="mt-1 text-sm font-bold tabular-nums text-text-primary">
              {number(pilotTelemetry.matches)}
            </dd>
          </div>
          <div>
            <dt class="text-[9px] tracking-wider text-text-muted">BEST ELO</dt>
            <dd class="mt-1 text-sm font-bold tabular-nums text-text-primary">
              {number(pilotTelemetry.best)}
            </dd>
          </div>
        </dl>
        <div class="arena-division mt-auto w-full rounded-md border border-accent-primary/30 bg-accent-primary-subtle/40 p-3 text-left font-mono">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px]">
            <span class="font-bold tracking-widest text-accent-primary">
              DIVISION PROGRESS
            </span>
            <span class="text-text-secondary">
              {pilotTelemetry.remaining} ELO TO APEX
            </span>
          </div>
          <div
            class="grid grid-cols-20 gap-1"
            role="progressbar"
            aria-label="Progress from Elite to Apex"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pilotTelemetry.progress}
            aria-valuetext={`${pilotTelemetry.progress}% — ${pilotTelemetry.remaining} ELO to Apex`}
          >
            <For each={Array.from({ length: 20 }, (_, index) => index)}>
              {(index) => (
                <div
                  class="h-3 overflow-hidden rounded-[2px] bg-border-subtle"
                  aria-hidden="true"
                >
                  <div
                    class="h-full bg-accent-secondary shadow-glow-magenta-xs"
                    style={{
                      width: `${Math.min(100, Math.max(0, (pilotTelemetry.progress - index * 5) * 20))}%`,
                    }}
                  />
                </div>
              )}
            </For>
          </div>
          <div class="mt-2 flex items-center justify-between text-[10px] font-bold tracking-widest">
            <span class="text-accent-secondary">◇ ELITE</span>
            <span class="text-accent-primary">APEX ◇</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function PilotStandings(props: { state: LeaderboardState }) {
  return (
    <section
      class="
          arena-panel bg-surface-1 border border-border-subtle rounded-[14px] min-w-0 arena-standings mt-[28px]
          p-[19px_21px_46px] animate-[arena-enter_0.65s_0.34s_cubic-bezier(0.22,_1,_0.36,_1)_both]
          [@media(max-width:650px)]:p-[18px_12px_28px] [@media(max-width:650px)]:min-h-0
          [@media(max-width:650px)]:mt-[20px] [&_tbody_tr]:animate-[arena-enter_0.4s_ease-out_both]
          [&_tbody_:where(tr)_>_*]:bg-surface-1
          [&_tbody_tr:where(:nth-child(odd))_>_*]:bg-surface-2
          [&_tbody_tr_>_*]:[transition:background-color_0.18s_ease]
          [@media(hover:hover)]:[&_tbody_tr:hover_>_*]:bg-accent-primary-subtle
          [&_tbody_tr:nth-child(2)]:[animation-delay:40ms] [&_tbody_tr:nth-child(3)]:[animation-delay:80ms]
          [&_tbody_tr:nth-child(4)]:[animation-delay:120ms] [&_tbody_tr:nth-child(5)]:[animation-delay:160ms]
          [&_tbody_tr:nth-child(6)]:[animation-delay:200ms]
        "
    >
      <div
        class="
          arena-table-heading flex justify-between items-center mb-[6px] [&_>_small]:m-[20px_145px_0_20px]
          [&_>_small]:font-bold [@media(max-width:1100px)]:[&_>_small]:mr-[0] [@media(max-width:650px)]:items-start
          [@media(max-width:650px)]:flex-col [@media(max-width:650px)]:gap-[6px]
          [@media(max-width:650px)]:[&_>_small]:m-0
        "
      >
        <div>
          <p class="arena-eyebrow font-ibm-plex-mono text-[11px] font-bold text-accent-primary tracking-[0.1px]">
            [ GLOBAL TOP {props.state.data().length} ]
          </p>
          <h2>PILOT STANDINGS</h2>
        </div>
        <small>
          SORTED BY{' '}
          {metrics.find((item) => item.key === props.state.metric())?.label}
          &nbsp; • &nbsp;{props.state.selectedMode().short}
        </small>
      </div>
      <p
        class="
          arena-scroll-hint hidden [font:10px_'IBM_Plex_Mono',_monospace] text-text-muted p-[8px_0]
          [@media(max-width:1100px)]:block
        "
      >
        ↔ Scroll the table to explore all pilot statistics.
      </p>
      <section
        class="
          arena-table-scroll overflow-x-auto [scrollbar-width:thin] [scrollbar-color:var(--color-border-default)_var(--color-surface-1)] rounded-[6px]
          [&:focus-visible]:outline-offset-[2px]
        "
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Enables keyboard scrolling of the overflow region.
        tabindex={0}
        aria-label="Pilot standings, scroll horizontally for all statistics"
      >
        <table>
          <caption
            class="
          arena-sr-only absolute w-[1px] h-[1px] p-0 m-[-1px] overflow-hidden [clip-path:inset(50%)]
          whitespace-nowrap border-0
        "
          >
            {props.state.selectedMode().label} standings ·{' '}
            {props.state.selectedPeriod().label}. Fixed mockup data, shared
            across all modes and periods.
          </caption>
          <thead>
            <tr>
              <th scope="col">RANK</th>
              <th scope="col">CALLSIGN</th>
              <th
                scope="col"
                aria-sort={
                  props.state.metric() === 'kills'
                    ? props.state.descending()
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                }
              >
                <button
                  type="button"
                  onClick={() => props.state.sortBy('kills')}
                >
                  KILLS{' '}
                  {props.state.metric() === 'kills'
                    ? props.state.descending()
                      ? '↓'
                      : '↑'
                    : ''}
                </button>
              </th>
              <th
                scope="col"
                aria-sort={
                  props.state.metric() === 'kd'
                    ? props.state.descending()
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                }
              >
                <button type="button" onClick={() => props.state.sortBy('kd')}>
                  K/D{' '}
                  {props.state.metric() === 'kd'
                    ? props.state.descending()
                      ? '↓'
                      : '↑'
                    : ''}
                </button>
              </th>
              <th scope="col">Δ RANK</th>
              <th
                scope="col"
                aria-sort={
                  props.state.metric() === 'rate'
                    ? props.state.descending()
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                }
              >
                <button
                  type="button"
                  onClick={() => props.state.sortBy('rate')}
                >
                  WIN RATE{' '}
                  {props.state.metric() === 'rate'
                    ? props.state.descending()
                      ? '↓'
                      : '↑'
                    : ''}
                </button>
              </th>
              <th
                scope="col"
                aria-sort={
                  props.state.metric() === 'wins'
                    ? props.state.descending()
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                }
              >
                <button
                  type="button"
                  onClick={() => props.state.sortBy('wins')}
                >
                  WINS{' '}
                  {props.state.metric() === 'wins'
                    ? props.state.descending()
                      ? '↓'
                      : '↑'
                    : ''}
                </button>
              </th>
              <th scope="col">Δ ELO</th>
              <th
                scope="col"
                aria-sort={
                  props.state.metric() === 'elo'
                    ? props.state.descending()
                      ? 'descending'
                      : 'ascending'
                    : 'none'
                }
              >
                <button type="button" onClick={() => props.state.sortBy('elo')}>
                  ELO{' '}
                  {props.state.metric() === 'elo'
                    ? props.state.descending()
                      ? '↓'
                      : '↑'
                    : ''}
                </button>
              </th>
            </tr>
          </thead>
          <tbody ref={props.state.setStandingsBody}>
            <For each={props.state.filtered()}>
              {(pilot) => (
                <tr
                  data-pilot={pilot.name}
                  class={{
                    'arena-rank-1': props.state.ranked().indexOf(pilot) === 0,
                    'arena-rank-2': props.state.ranked().indexOf(pilot) === 1,
                    'arena-rank-3': props.state.ranked().indexOf(pilot) === 2,
                  }}
                >
                  <td>
                    {String(props.state.ranked().indexOf(pilot) + 1).padStart(
                      2,
                      '0',
                    )}
                  </td>
                  <th scope="row">{pilot.name}</th>
                  <td>{number(pilot.kills)}</td>
                  <td>{pilot.kd.toFixed(2)}</td>
                  <td class="arena-cyan">
                    {pilot.change === 0
                      ? '—'
                      : `${pilot.change > 0 ? '↑' : '↓'} ${Math.abs(pilot.change)}`}
                  </td>
                  <td>{pilot.rate.toFixed(1)}%</td>
                  <td>{pilot.wins}</td>
                  <td class={{ 'arena-cyan': pilot.delta > 0 }}>
                    {pilot.delta > 0 ? '+' : ''}
                    {pilot.delta}
                  </td>
                  <td>{number(pilot.elo)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </section>
      <output
        class="
          arena-sr-only absolute w-[1px] h-[1px] p-0 m-[-1px] overflow-hidden [clip-path:inset(50%)]
          whitespace-nowrap border-0
        "
        aria-live="polite"
      >
        {props.state.filtered().length} pilots ·{' '}
        {props.state.selectedMode().label} ·{' '}
        {props.state.selectedPeriod().label} · sorted by {props.state.metric()}{' '}
        {props.state.descending() ? 'descending' : 'ascending'}
      </output>
      <Show when={props.state.filtered().length === 0}>
        <div class="arena-empty text-center p-[28px_12px] text-text-muted block leading-[1.6] [&_button]:mt-[12px]">
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
            <button type="button" onClick={() => props.state.setSearch('')}>
              CLEAR SEARCH
            </button>
          </Show>
        </div>
      </Show>
      <Show
        when={
          props.state.mode() !== 'ffa' ||
          props.state.period() !== 'all' ||
          props.state.search() !== '' ||
          props.state.metric() !== 'elo' ||
          !props.state.descending()
        }
      >
        <div
          class="
          arena-results flex justify-between items-center gap-[12px] pt-[16px]
          [font:10px_'IBM_Plex_Mono',_monospace] text-text-muted [@media(max-width:650px)]:items-start
          [@media(max-width:650px)]:flex-col
        "
        >
          <span>
            {props.state.filtered().length} / {props.state.data().length} PILOTS
            · {props.state.selectedPeriod().label}
          </span>
          <button type="button" onClick={() => props.state.resetFilters()}>
            RESET FILTERS ↺
          </button>
        </div>
      </Show>
    </section>
  );
}

export default function Leaderboard() {
  const state = createLeaderboard();
  return (
    <div
      class="
          arena-page relative overflow-x-hidden
          [--font-ibm-plex-mono:'IBM_Plex_Mono',monospace] text-text-primary bg-background min-h-screen
          text-left font-space-grotesk text-[14px] scheme-dark isolate [overflow-wrap:break-word] [&_*]:box-border
          [&_a]:no-underline [&_a]:text-[inherit] [&_button]:cursor-pointer [&_button]:font-ibm-plex-mono
          [&_button]:border [&_button]:border-border-subtle [&_button]:rounded-[6px] [&_button]:bg-surface-2
          [&_button]:text-text-muted [&_button]:text-[11px] [&_button]:font-bold [&_button]:p-[6px_12px]
          [&_button]:min-h-[28px] [&_button]:text-left
          [&_button]:[transition:transform_0.18s_ease,_background-color_0.18s_ease,_border-color_0.18s_ease,_color_0.18s_ease,_box-shadow_0.18s_ease]
          [&_input]:font-ibm-plex-mono [&_select]:cursor-pointer [&_select]:font-ibm-plex-mono
          [&_button:disabled]:cursor-not-allowed [&_:focus-visible]:[outline:2px_solid_var(--color-accent-primary)]
          [&_:focus-visible]:outline-offset-[4px] [&_h1]:m-0 [&_h2]:m-0 [&_h2]:text-[23px] [&_h2]:font-bold
          [&_h2]:tracking-[-0.7px] [&_h2]:mt-[6px] [&_h3]:m-0 [&_p]:m-0 [&_:where(small)]:font-ibm-plex-mono
          [&_:where(small)]:text-[10px] [&_:where(small)]:text-text-muted [&_table]:font-ibm-plex-mono
          [&_table]:w-full [&_table]:border-separate [&_table]:[border-spacing:0_8px] [&_table]:text-[11px]
          [&_table]:whitespace-nowrap [&_button.active]:[border-color:var(--color-accent-primary)] [&_button.active]:bg-accent-primary-subtle
          [&_button.active]:text-accent-primary [&_button.active]:shadow-[inset_0_0_16px_color-mix(in_oklab,var(--color-accent-primary)_3.92%,transparent)]
          [&_button:hover:not(:disabled)]:[border-color:var(--color-accent-primary)] [&_th]:text-left [&_th]:p-[12px_20px]
          [&_td]:text-left [&_td]:p-[12px_20px] [&_thead_th]:bg-surface-2 [&_thead_th]:text-text-muted
          [&_thead_th]:text-[10px] [&_tr_>_:first-child]:rounded-[6px_0_0_6px]
          [&_tr_>_:last-child]:rounded-[0_6px_6px_0]
          [&_tbody_th]:text-[12px] [&_tbody_th]:w-[25%] [&_tbody_th]:font-bold [&_tbody_td]:text-text-secondary
          [&_tbody_td:first-child]:text-text-muted [&_tbody_td:first-child]:font-bold
          [&_tbody_td:nth-child(6)]:text-text-muted [&_tbody_td:nth-child(6)]:font-bold
          [&_tbody_td:nth-child(8)]:text-text-muted [&_tbody_td:nth-child(8)]:font-bold
          [&_tbody_td:last-child]:font-bold [&_tbody_td:last-child]:text-[13px]
          [&_tbody_.arena-cyan]:text-information-foreground! [&_.arena-rank-1_td:first-child]:text-accent-primary
          [&_.arena-rank-1_td:last-child]:text-accent-primary [&_.arena-rank-2_td:first-child]:text-neutral-200
          [&_.arena-rank-2_td:last-child]:text-neutral-200 [&_.arena-rank-3_td:first-child]:text-[#cd7f32]
          [&_.arena-rank-3_td:last-child]:text-[#cd7f32] [@media(max-width:650px)]:[&_h2]:text-[20px]
          [@media(max-width:650px)]:[&_th]:p-[12px_14px] [@media(max-width:650px)]:[&_td]:p-[12px_14px]
          [&_:where(button,_a,_input,_select)]:[-webkit-tap-highlight-color:transparent]
          [&_:where(button,_a,_select,_input)]:[transition:background-color_0.18s_ease,_border-color_0.18s_ease,_color_0.18s_ease,_box-shadow_0.18s_ease]
          [&_button:active]:[transform:translateY(1px)] [&_thead_button]:border-0
          [&_thead_button]:border-[currentColor] [&_thead_button]:bg-transparent [&_thead_button]:rounded-[3px]
          [&_thead_button]:p-0 [&_thead_button]:min-h-[14px] [&_thead_button]:text-[10px]
          [&_thead_button]:text-[inherit] [&_thead_button]:whitespace-nowrap
          [&_th[aria-sort='ascending']]:text-accent-primary [&_th[aria-sort='descending']]:text-accent-primary
          [@media(pointer:coarse)]:[&_button]:min-h-[44px] [@media(pointer:coarse)]:[&_thead_button]:min-h-[44px]
          [@media(pointer:coarse)]:[&_thead_th]:py-[0] [@media(max-width:650px)]:[&_table]:min-w-[850px]
          [@media(max-width:650px)]:[&_thead_button]:min-h-[44px] [@media(max-width:650px)]:[&_thead_th]:py-[0]
          [@media(prefers-reduced-motion:reduce)]:[&_*]:animate-[none]!
          [@media(prefers-reduced-motion:reduce)]:[&_*]:[transition:none]!
          [@media(prefers-reduced-motion:reduce)]:[&_*]:[scroll-behavior:auto]!
          [@media(prefers-reduced-motion:reduce)]:[&_*::before]:animate-[none]!
          [@media(prefers-reduced-motion:reduce)]:[&_*::before]:[transition:none]!
          [@media(prefers-reduced-motion:reduce)]:[&_*::before]:[scroll-behavior:auto]!
          [@media(prefers-reduced-motion:reduce)]:[&_*::after]:animate-[none]!
          [@media(prefers-reduced-motion:reduce)]:[&_*::after]:[transition:none]!
          [@media(prefers-reduced-motion:reduce)]:[&_*::after]:[scroll-behavior:auto]!
        "
    >
      <style>{animationKeyframes}</style>
      <Title>Arena Leaderboard — Transcedance</Title>
      <div aria-hidden="true" class="fixed inset-0 z-0 pointer-events-none">
        <div class="absolute inset-0 tactical-grid opacity-80" />
        <div class="absolute -top-48 -left-32 w-96 h-96 bg-accent-primary/15 rounded-pill blur-3xl" />
        <div class="absolute top-1/3 -right-48 w-96 h-96 bg-accent-secondary/15 rounded-pill blur-3xl" />
        <div class="absolute -bottom-48 left-1/3 w-96 h-96 bg-accent-secondary/10 rounded-pill blur-3xl" />
      </div>
      <main class="arena-main relative z-10 w-full max-w-7xl mx-auto px-4 lg:px-8 pt-8 pb-8 md:pb-12">
        <section class="arena-intro mb-8 space-y-2 border-b border-border-subtle/85 pb-6 [&_h1]:mt-1 animate-[arena-enter_0.6s_cubic-bezier(0.22,_1,_0.36,_1)_both]">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center space-x-2">
              <span
                class="inline-block w-2.5 h-2.5 bg-accent-primary shadow-glow-cyan"
                aria-hidden="true"
              />
              <span class="font-mono text-xs font-bold tracking-widest text-accent-primary uppercase">
                // GLOBAL PILOT RANKINGS
              </span>
            </div>
          </div>
          <h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-text-primary uppercase">
            ARENA{' '}
            <span class="text-accent-primary neon-text-cyan">LEADERBOARD</span>
          </h1>
          <p class="arena-description font-mono text-text-muted text-xs md:text-sm max-w-3xl pt-1">
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

const animationKeyframes = `
@keyframes arena-reveal {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes arena-fill {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
@keyframes arena-enter {
  from {
    opacity: 0;
    translate: 0 16px;
  }
  to {
    opacity: 1;
    translate: 0 0;
  }
}
@keyframes arena-score {
  from {
    opacity: 0;
    filter: blur(5px);
  }
  to {
    opacity: 1;
    filter: blur(0);
  }
}
@keyframes arena-beacon {
  0%,
  100% {
    opacity: 1;
    box-shadow: 0 0 8px color-mix(in oklab,var(--color-accent-primary) 50.2%,transparent);
  }
  50% {
    opacity: 0.45;
    box-shadow: 0 0 14px color-mix(in oklab,var(--color-accent-primary) 25.1%,transparent);
  }
}
@keyframes arena-halo {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in oklab,var(--color-accent-primary) 0.0%,transparent);
  }
  50% {
    box-shadow: 0 0 18px 3px color-mix(in oklab,var(--color-accent-primary) 14.9%,transparent);
  }
}

@keyframes arena-legendary-sheen {
  from { background-position: 100% 0; }
  to { background-position: 0% 0; }
}

@keyframes arena-champion-aura {
  0% {
    box-shadow: 0 0 0 0 color-mix(in oklab, var(--legendary-light) 45%, transparent),
      inset 0 0 24px color-mix(in oklab, var(--legendary-light) 20%, transparent);
  }
  100% {
    box-shadow: 0 0 18px 16px color-mix(in oklab, var(--legendary-light) 0%, transparent),
      inset 0 0 12px color-mix(in oklab, var(--legendary-light) 8%, transparent);
  }
}

@keyframes arena-champion-crown {
  0% { transform: translateY(0) scale(1); }
  45% { transform: translateY(-6px) scale(1.3) rotate(-8deg); }
  75% { transform: translateY(-3px) scale(1.18) rotate(4deg); }
  100% { transform: translateY(-4px) scale(1.2); }
}
`;
