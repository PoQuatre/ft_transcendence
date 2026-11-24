import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createSignal, onSettled, For, Show } from 'solid-js';

import { pivotShift, type TankKind, TankSprite } from '~/components/TankSprite';
import { Badge, Button, Card, Kbd } from '~/components/ui';
import { paths } from '~/router';

//champ de saisie
const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// Seul le FFA tourne côté serveur (lobby Quick Play) : les autres modes arrivent.
const MODES = [
  { label: 'FFA SOLO', sub: 'Solo Domination', icon: 'groups_3', live: true },
  { label: 'SQUAD 4v4', sub: 'Team Combat', icon: 'shield', live: false },
  { label: 'EXTRACTION', sub: 'Objective Hunt', icon: 'flag', live: false },
  { label: 'OVERLOAD', sub: 'Shrinking Zone', icon: 'warning', live: false },
];

// Règles de backend/internal/game/simulation.
const STATS = [
  { label: 'PLAYERS', value: 'UP TO 8' },
  { label: 'HULL', value: '100 HP' },
  { label: 'DASH', value: 'EVERY 2 S' },
];

// Le jeu démarre en BASIC, les autres tanks sont ses évolutions.
const ROSTER: TankKind[] = ['basic', 'twin', 'heavy', 'quad', 'drone'];

// Contrôles du jeu (game/src/platform/raylib_platform.cpp).
const CONTROLS = [
  { action: 'THRUST / MOVE', key: 'W A S D', hint: 'Move in 8 directions' },
  { action: 'AIM TURRET', key: 'MOUSE', hint: 'Turret follows the cursor' },
  { action: 'DASH', key: 'SHIFT', hint: 'Short burst of speed, every 2 s' },
];

export default function Home() {
  const navigate = useNavigate();

  // Palette de couleur du cœur
  const colorOptions = [
    {
      hex: '#00e5ff',
      glow: 'rgba(0, 229, 255, 0.75)',
      name: 'Electric Cyan',
    },
    {
      hex: '#ff50df',
      glow: 'rgba(255, 80, 223, 0.75)',
      name: 'Hot Pink',
    },
    {
      hex: '#12ee83',
      glow: 'rgba(18, 238, 131, 0.75)',
      name: 'Neon Green',
    },
    {
      hex: '#ffbb24',
      glow: 'rgba(255, 187, 36, 0.75)',
      name: 'Electric Amber',
    },
  ];
  const [selectedColor, setSelectedColor] = createSignal(colorOptions[1]!);
  // Aperçu seulement : en jeu, tout le monde démarre en BASIC.
  const [previewTank, setPreviewTank] = createSignal<TankKind>('basic');

  // Référence visuelle Tank Radar
  let tankPivotRef: HTMLDivElement | undefined;
  let animId: number;

  const quickPlay = () => navigate('/game');

  onSettled(() => {
    //Raccourci Quick Play
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (isEditableTarget(e.target)) return;
      quickPlay();
    };
    window.addEventListener('keydown', onKeyDown);
    // Suivi dynamique de la visée tourelle vers la souris (60fps lerp)
    let currentAngle = 0;
    let targetAngle = 0;
    const onMouseMove = (e: MouseEvent) => {
      if (!tankPivotRef) return;
      const rect = tankPivotRef.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      targetAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
    };
    window.addEventListener('mousemove', onMouseMove);
    const updateAim = () => {
      if (tankPivotRef) {
        let diff = targetAngle - currentAngle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        currentAngle += diff * 0.18;
        const deg = currentAngle * (180 / Math.PI);
        tankPivotRef.style.transform = `rotate(${deg}deg)`;
      }
      animId = requestAnimationFrame(updateAim);
    };
    animId = requestAnimationFrame(updateAim);
    // Nettoyage retourné directement (SolidJS 2.0)
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(animId);
    };
  });

  return (
    <div
      class="flex flex-col w-full relative overflow-x-clip min-h-screen bg-background text-text-primary"
      style={{
        '--tank-glow-color': selectedColor().glow,
        '--tank-stroke-color': selectedColor().hex,
      }}
    >
      <Title>FT_TRANSCENDENCE</Title>

      {/* Arrière-plans d'ambiance et grille tactique */}
      <div class="fixed inset-0 tactical-grid pointer-events-none opacity-80 z-0" />
      <div class="fixed -top-48 -left-32 w-96 h-96 bg-accent-primary/15 rounded-pill blur-3xl pointer-events-none" />
      <div class="fixed top-1/3 -right-48 w-96 h-96 bg-accent-secondary/15 rounded-pill blur-3xl pointer-events-none" />
      <div class="fixed -bottom-48 left-1/3 w-96 h-96 bg-accent-secondary/10 rounded-pill blur-3xl pointer-events-none" />

      {/* Conteneur principal */}
      <div class="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
        {/* =================================================================
            1. SECTION HERO & TITRE
            ================================================================= */}
        <section class="space-y-2 border-b border-border-subtle/85 pb-6">
          <div class="flex items-center space-x-2">
            <span class="inline-block w-2.5 h-2.5 bg-accent-primary shadow-glow-cyan" />
            <span class="font-mono text-xs font-bold tracking-widest text-accent-primary uppercase">
              // FT_TRANSCENDENCE
            </span>
          </div>
          <h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white uppercase mt-1">
            ENTER THE{' '}
            <span class="text-accent-primary neon-text-cyan">ARENA</span>
          </h1>
          <p class="font-mono text-text-muted text-xs md:text-sm max-w-3xl pt-1">
            Up to 8 tanks share one arena: shoot drifting shapes and rival
            pilots in real time.
          </p>
        </section>

        {/* =================================================================
            2. QUICK PLAY : SEUL MODE JOUABLE POUR L'INSTANT
            ================================================================= */}
        <section>
          <Card
            variant="default"
            class="bg-surface-1/90 backdrop-blur-md border-border-subtle/85 rounded-lg p-6 sm:p-6 shadow-card-inner"
          >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div class="space-y-4">
                <div class="font-mono text-xs font-bold text-accent-primary tracking-wider flex items-center gap-2">
                  <span class="w-1.5 h-1.5 bg-accent-primary shadow-glow-cyan-xs" />
                  <span>QUICK PLAY // FREE-FOR-ALL ARENA</span>
                </div>
                <p class="text-xs text-text-secondary leading-relaxed font-mono">
                  Join a running arena. Each shot deals 25 damage, so 4 hits
                  destroy a tank, which respawns at full health. Squares and
                  circles drift across the map and come back 10 s after being
                  destroyed.
                </p>
                <dl class="grid grid-cols-3 gap-3 font-mono">
                  <For each={STATS}>
                    {(stat) => (
                      <div class="rounded-md border border-border-subtle/85 bg-background px-3 py-2">
                        <dt class="text-[10px] text-text-muted">
                          {stat.label}
                        </dt>
                        <dd class="mt-1 text-xs font-bold text-white">
                          {stat.value}
                        </dd>
                      </div>
                    )}
                  </For>
                </dl>

                <div class="space-y-2">
                  <h2 class="font-mono text-[11px] font-bold tracking-widest text-text-muted">
                    GAME MODES
                  </h2>
                  <ul class="grid grid-cols-2 gap-3">
                    <For each={MODES}>
                      {(mode) => (
                        <li
                          class={[
                            'relative overflow-hidden rounded-md border px-3 py-3 font-mono',
                            mode.live
                              ? 'border-accent-primary bg-accent-primary/15 shadow-glow-cyan-md'
                              : 'border-border-subtle/85 bg-surface-2',
                          ]}
                        >
                          <div
                            class={[
                              'flex items-center justify-between',
                              { 'opacity-25': !mode.live },
                            ]}
                          >
                            <span
                              class={[
                                'text-xs font-bold tracking-wider',
                                mode.live
                                  ? 'text-accent-primary'
                                  : 'text-text-secondary',
                              ]}
                            >
                              {mode.label}
                            </span>
                            <span
                              class="material-symbols-outlined text-xs text-text-muted"
                              aria-hidden="true"
                            >
                              {mode.icon}
                            </span>
                          </div>
                          <div
                            class={[
                              'text-[10px] text-text-muted mt-1',
                              { 'opacity-25': !mode.live },
                            ]}
                          >
                            {mode.sub}
                          </div>
                          <Show when={!mode.live}>
                            <span class="absolute inset-0 flex items-center justify-center bg-background/70">
                              <span class="rounded-sm border border-accent-secondary/60 bg-accent-secondary-subtle px-2 py-0.5 text-[10px] font-bold tracking-widest text-accent-secondary">
                                COMING SOON
                              </span>
                            </span>
                          </Show>
                        </li>
                      )}
                    </For>
                  </ul>
                </div>
              </div>

              {/* Aperçu du tank : la tourelle suit la souris */}
              <div class="flex flex-col justify-between bg-surface-2 rounded-lg border border-border-subtle/85 p-4 relative overflow-hidden">
                <div class="absolute inset-0 striped-pattern opacity-30 pointer-events-none z-20" />

                {/* En-tête télémétrique */}
                <div class="flex items-center justify-between z-10 font-mono text-[11px]">
                  <span class="text-text-muted tracking-wider uppercase">
                    PREVIEW // {previewTank()}
                  </span>
                  <span class="text-accent-primary font-bold tracking-wider">
                    AIM LOCK: MOUSE
                  </span>
                </div>

                {/* Viseur Radar & Tank Interactif */}
                <div class="relative w-full aspect-square max-w-[250px] mx-auto my-1 flex items-center justify-center">
                  <div class="absolute inset-2 rounded-pill border border-accent-primary-subtle/70 pointer-events-none" />
                  <div class="absolute inset-6 rounded-pill border border-accent-primary-pressed/40 pointer-events-none" />
                  <div class="absolute inset-12 rounded-pill border border-accent-primary-pressed/40 border-dashed pointer-events-none" />

                  {/* Pivot de rotation vers la souris */}
                  <div
                    ref={(el) => (tankPivotRef = el)}
                    class="relative z-10 w-36 h-36 flex items-center justify-center cursor-crosshair will-change-transform"
                  >
                    {/* Rotation autour du centre de la coque, pas du dessin */}
                    <div
                      class="w-32 h-32 tank-soft-halo pointer-events-none"
                      style={{
                        color: selectedColor().hex,
                        filter: `drop-shadow(0 0 12px ${selectedColor().glow})`,
                        transform: `translateX(${pivotShift(previewTank())})`,
                      }}
                    >
                      <TankSprite kind={previewTank()} class="w-full h-full" />
                    </div>
                  </div>
                </div>

                {/* Sélecteur de couleur du cœur */}
                <div class="mt-3 z-10 pt-2 border-t border-border-subtle/70 flex items-center justify-between font-mono text-xs">
                  <div class="flex items-center gap-3">
                    <span class="text-[11px] text-text-muted font-mono tracking-wider">
                      CORE COLOR:
                    </span>
                    <div class="flex items-center gap-2">
                      <For each={colorOptions}>
                        {(col) => {
                          const isColActive = () =>
                            selectedColor().hex === col.hex;
                          return (
                            <button
                              type="button"
                              aria-label={col.name}
                              onClick={() => setSelectedColor(col)}
                              title={col.name}
                              class={[
                                'rounded-pill relative transition-transform hover:scale-110 focus:outline-none cursor-pointer',
                                {
                                  'w-6 h-6 ring-2 ring-offset-2 ring-offset-surface-2':
                                    isColActive(),
                                  'w-5 h-5': !isColActive(),
                                },
                              ]}
                              style={{
                                'background-color': col.hex,
                                'box-shadow': isColActive()
                                  ? `0 0 12px ${col.hex}`
                                  : 'none',
                              }}
                            >
                              <span class="striped-pattern absolute inset-0 rounded-pill opacity-40" />
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-6 pt-6 border-t border-border-subtle/85">
              <Button
                variant="default"
                onClick={quickPlay}
                class="w-full sm:w-80 py-4 px-6 rounded-md bg-accent-primary hover:bg-accent-primary-hover text-accent-primary-on font-extrabold text-sm md:text-base tracking-wider font-mono uppercase shadow-glow-cyan hover:shadow-glow-cyan-lg transform active:scale-95 transition-all flex items-center justify-center gap-3 border border-accent-primary-hover"
              >
                <span
                  class="material-symbols-outlined font-extrabold text-lg"
                  aria-hidden="true"
                >
                  bolt
                </span>
                <span class="tracking-widest">QUICK PLAY [ENTER]</span>
              </Button>
            </div>
          </Card>
        </section>

        {/* =================================================================
            3. TANK ROSTER : LE TANK DE DÉPART ET SES ÉVOLUTIONS
            ================================================================= */}
        <section class="space-y-4">
          <div class="border-b border-border-subtle/85 pb-3">
            <div class="flex items-center space-x-2">
              <span
                class="material-symbols-outlined text-sm text-accent-primary"
                aria-hidden="true"
              >
                account_tree
              </span>
              <span class="font-mono text-xs font-bold tracking-widest text-accent-primary uppercase">
                TANK ROSTER
              </span>
            </div>
            <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight text-white uppercase mt-1">
              START AS A BASIC TANK, EVOLVE OVER TIME
            </h2>
          </div>

          <ul class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <For each={ROSTER}>
              {(kind) => (
                <li
                  class={[
                    'relative bg-surface-2 backdrop-blur-md border rounded-lg p-4 shadow-card-inner space-y-3 transition-colors',
                    previewTank() === kind
                      ? 'border-accent-primary ring-1 ring-focus-primary'
                      : 'border-border-subtle/85 hover:border-accent-primary/60',
                  ]}
                >
                  <Badge variant={kind === 'basic' ? 'success' : 'default'}>
                    {kind === 'basic' ? 'STARTING TANK' : 'EVOLUTION'}
                  </Badge>
                  <div class="relative aspect-square rounded-md bg-surface-1 border border-border-subtle/85 flex items-center justify-center overflow-hidden">
                    <div class="absolute inset-0 tactical-grid opacity-50 pointer-events-none" />
                    <div
                      class="relative w-3/5 h-3/5"
                      style={{
                        color: selectedColor().hex,
                        filter: `drop-shadow(0 0 8px ${selectedColor().glow})`,
                      }}
                    >
                      <TankSprite kind={kind} class="w-full h-full" />
                    </div>
                  </div>
                  <h3 class="font-mono text-lg font-extrabold tracking-wider text-white uppercase">
                    {/* Le bouton couvre toute la carte grâce à son ::after */}
                    <button
                      type="button"
                      aria-pressed={previewTank() === kind ? 'true' : 'false'}
                      onClick={() => setPreviewTank(kind)}
                      class="uppercase cursor-pointer after:absolute after:inset-0"
                    >
                      {kind}
                    </button>
                  </h3>
                </li>
              )}
            </For>
          </ul>
        </section>

        {/* =================================================================
            4. SECTION INFÉRIEURE : KEY MAP & ARENA APEX (7 cols + 5 cols)
            ================================================================= */}
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CARTE GAUCHE : CONTRÔLES (7 colonnes) */}
          <Card
            variant="default"
            class="lg:col-span-7 bg-surface-1/90 backdrop-blur-md border-border-subtle/85 rounded-lg p-6 sm:p-6 shadow-card-inner space-y-4"
          >
            <div class="flex items-center justify-between border-b border-border-subtle/85 pb-3">
              <div>
                <div class="flex items-center space-x-2">
                  <span
                    class="material-symbols-outlined text-sm text-accent-primary"
                    aria-hidden="true"
                  >
                    keyboard
                  </span>
                  <span class="font-mono text-xs font-bold text-accent-primary tracking-wider uppercase">
                    KEY MAP TELEMETRY
                  </span>
                </div>
                <h2 class="text-xl font-bold text-white tracking-wide mt-1">
                  Move. Aim. Fire.
                </h2>
              </div>
              <div class="font-mono text-[10px] text-text-muted">
                TACTICAL CONTROL SCHEME
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono">
              <For each={CONTROLS}>
                {(control) => (
                  <div class="bg-surface-1 border border-border-subtle/85 hover:border-accent-primary/50 rounded-md p-3 sm:p-4 transition-colors flex flex-col justify-between">
                    <div class="flex items-center justify-between gap-1 w-full">
                      <span class="text-[11px] font-bold text-text-secondary font-mono tracking-wide truncate">
                        {control.action}
                      </span>
                      <Kbd
                        variant="glow"
                        size="sm"
                        class="shrink-0 whitespace-nowrap"
                      >
                        [ {control.key} ]
                      </Kbd>
                    </div>
                    <div class="text-[11px] text-text-muted mt-2 font-mono leading-relaxed">
                      {control.hint}
                    </div>
                  </div>
                )}
              </For>

              <div class="bg-surface-1 border border-border-subtle/85 hover:border-accent-primary/50 rounded-md p-3 sm:p-4 transition-colors flex flex-col justify-between md:col-span-2">
                <div class="flex items-center justify-between gap-2 w-full">
                  <span class="text-[11px] font-bold text-text-secondary font-mono tracking-wide">
                    PRIMARY FIRE
                  </span>
                  <Kbd
                    variant="glow"
                    size="sm"
                    class="shrink-0 whitespace-nowrap"
                  >
                    [ L-CLICK ]
                  </Kbd>
                </div>
                <div class="mt-3">
                  <Badge variant="success" class="shadow-glow-green-sm">
                    HOLD TO FIRE
                  </Badge>
                </div>
                <div class="text-[11px] text-text-muted mt-2 font-mono leading-relaxed">
                  3 shots per second, 25 damage each
                </div>
              </div>
            </div>
            <div class="pt-4 border-t border-border-subtle/70 flex items-center justify-between font-mono text-xs">
              <span class="text-text-muted">DEFAULT LAYOUT</span>
              <a
                href={`${paths.settings()}?tab=combat`}
                class="inline-flex items-center gap-2 font-bold text-accent-primary hover:text-white transition-colors group no-underline"
              >
                <span>REMAP KEYS</span>
                <span class="transform group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </a>
            </div>
          </Card>

          {/* CARTE DROITE : ARENA APEX (5 colonnes) */}
          <Card
            variant="default"
            class="lg:col-span-5 bg-surface-1/90 backdrop-blur-md border-border-subtle/85 rounded-lg p-6 shadow-card-inner flex flex-col justify-between"
          >
            <div>
              <div class="flex items-center gap-2 font-mono text-xs font-bold text-accent-primary tracking-wider uppercase mb-2">
                <span
                  class="material-symbols-outlined text-sm"
                  aria-hidden="true"
                >
                  trophy
                </span>
                <span>ARENA APEX</span>
              </div>
              <div class="flex items-center justify-between border-b border-border-subtle/85 pb-3">
                <h2 class="text-lg font-bold text-white tracking-wide font-sans">
                  Quick Play · Arena
                </h2>
                <span class="font-mono text-[10px] text-text-muted">TOP 5</span>
              </div>

              <div class="mt-4 flex flex-col items-center gap-2 rounded-md border border-dashed border-border-subtle/85 px-4 py-10 text-center font-mono">
                <span
                  class="material-symbols-outlined text-2xl text-text-muted"
                  aria-hidden="true"
                >
                  leaderboard
                </span>
                <p class="text-xs font-bold tracking-widest text-text-secondary">
                  NO RANKING YET
                </p>
                <p class="text-[11px] text-text-muted">
                  Scores are not tracked in the arena yet.
                </p>
              </div>
            </div>

            <div class="pt-4 mt-4 border-t border-border-subtle/70 flex items-center justify-between font-mono text-xs">
              <span class="text-text-muted">RANKING COMING SOON</span>
              <a
                href={paths.leaderboard()}
                class="inline-flex items-center gap-2 font-bold text-accent-primary hover:text-white transition-colors group no-underline"
              >
                <span>FULL RANKINGS</span>
                <span class="transform group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </a>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
