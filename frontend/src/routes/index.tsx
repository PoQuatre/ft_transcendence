import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createSignal, onSettled, For } from 'solid-js';

import { ChassisVector } from '~/components/ChassisVectors';
import { Badge, Button, Card, Kbd, Progress } from '~/components/ui';
import { currentUser } from '~/lib/auth';

//champ de saisie
const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

// Call-sign d'invité : ANONYM_ + 4 hexadécimaux, généré une fois et conservé
// dans localStorage pour survivre au rechargement.
const GUEST_CALLSIGN_KEY = 'cybercore.guest-callsign';
const loadGuestCallsign = () => {
  try {
    const saved = localStorage.getItem(GUEST_CALLSIGN_KEY);
    if (saved) return saved;
  } catch {
    // Stockage indisponible (navigation privée, etc.) : on régénère.
  }
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(2)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  )
    .join('')
    .toUpperCase();
  const generated = `ANONYM_${hex}`;
  try {
    localStorage.setItem(GUEST_CALLSIGN_KEY, generated);
  } catch {
    // Idem : le nom ne sera pas conservé entre deux visites.
  }
  return generated;
};

export default function Home() {
  const navigate = useNavigate();

  // --- Signaux d'état ---
  // Call-sign affiché : le username du compte connecté, sinon le nom d'invité.
  // Tant que la session n'est pas vérifiée (SSR, getMe() en cours) : « … ».
  const [guestCallsign, setGuestCallsign] = createSignal('');
  const callsign = () => {
    const user = currentUser();
    if (user === undefined) return '…';
    return user?.username ?? (guestCallsign() || '…');
  };

  const [selectedMode, setSelectedMode] = createSignal<
    'ffa' | 'tdm' | 'ctf' | 'br'
  >('ctf');
  const [subMode, setSubMode] = createSignal<'casual' | 'ranked'>('ranked');
  const [activeChassis, setActiveChassis] = createSignal<
    'STRIKER' | 'PHANTOM' | 'OVERSEER'
  >('STRIKER');

  // Palette de couleur du cœur
  const colorOptions = [
    {
      hex: '#00e5ff',
      glow: 'rgba(0, 229, 255, 0.75)',
      ref: '#00E5FF',
      name: 'Electric Cyan',
    },
    {
      hex: '#ff50df',
      glow: 'rgba(255, 80, 223, 0.75)',
      ref: '#FF50DF',
      name: 'Hot Pink',
    },
    {
      hex: '#12ee83',
      glow: 'rgba(18, 238, 131, 0.75)',
      ref: '#12EE83',
      name: 'Neon Green',
    },
    {
      hex: '#ffbb24',
      glow: 'rgba(255, 187, 36, 0.75)',
      ref: '#FFBB24',
      name: 'Electric Amber',
    },
    {
      hex: '#ff80ed',
      glow: 'rgba(255, 128, 237, 0.75)',
      ref: '#FF80ED',
      name: 'Soft Pink',
    },
  ];
  const [selectedColor, setSelectedColor] = createSignal(colorOptions[4]!);

  const [deploying, setDeploying] = createSignal(false);
  const [deployText, setDeployText] = createSignal('DEPLOY [ENTER]');

  // Quêtes journalières réactives
  const [claimedReward, setClaimedReward] = createSignal(false);

  // Descriptions dynamiques des modes
  const modeDetails = {
    ffa: {
      badge: 'FFA SOLO // CONTINUOUS APEX ARENA',
      desc: 'Chaque tank pour soi. Assimilez les orbes, faites évoluer votre châssis et dominez le classement apex.',
    },
    tdm: {
      badge: 'SQUAD 4v4 // TACTICAL NODE CONTROL',
      desc: 'Coordonnez vos tirs en escouade. Contrôlez les nœuds régionaux et anéantissez les forces ennemies.',
    },
    ctf: {
      badge: 'EXTRACTION / HIGH-DENSITY CORE HEIST',
      desc: 'Infiltrez les secteurs hostiles, récupérez les cœurs singuliers haute densité et défendez les sanctuaires d’extraction.',
    },
    br: {
      badge: 'OVERLOAD // SHRINKING PERIMETER ARENA',
      desc: 'Trente blindés déployés. Collectez les composants rares avant que l’orage ionique ne referme le périmètre.',
    },
  };

  // Référence visuelle Tank Radar
  let tankPivotRef: HTMLDivElement | undefined;
  let animId: number;

  const handleDeploy = () => {
    if (deploying()) return;
    setDeploying(true);
    setDeployText('CONNECTING TO ARENA...');

    setTimeout(() => {
      setDeployText('WARPING...');
      setTimeout(() => {
        navigate(
          `/game?pilot=${encodeURIComponent(callsign())}&class=${activeChassis()}&color=${encodeURIComponent(selectedColor().hex)}`,
        );
      }, 700);
    }, 800);
  };

  onSettled(() => {
    setGuestCallsign(loadGuestCallsign());
    //Raccourci Déploiement
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      if (isEditableTarget(e.target)) return;
      handleDeploy();
    };
    window.addEventListener('keydown', onKeyDown);
    // Suivi dynamique de la visée tourelle vers la souris (60fps lerp)
    let currentAngle = 0;
    let targetAngle = 0;
    const SPRITE_HEADING_OFFSET = Math.PI / 2;
    const onMouseMove = (e: MouseEvent) => {
      if (!tankPivotRef) return;
      const rect = tankPivotRef.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      targetAngle =
        Math.atan2(e.clientY - centerY, e.clientX - centerX) +
        SPRITE_HEADING_OFFSET;
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
      class="flex flex-col w-full relative overflow-x-hidden min-h-screen bg-background text-text-primary"
      style={{
        '--tank-glow-color': selectedColor().glow,
        '--tank-stroke-color': selectedColor().hex,
      }}
    >
      <Title>CYBERCORE // Tactical Net Arena</Title>

      {/* Arrière-plans d'ambiance et grille tactique */}
      <div class="fixed inset-0 tactical-grid pointer-events-none opacity-80 z-0" />
      <div class="fixed -top-40 -left-32 w-96 h-96 bg-accent-primary/15 rounded-full blur-3xl pointer-events-none" />
      <div class="fixed top-1/3 -right-40 w-96 h-96 bg-accent-secondary/15 rounded-full blur-3xl pointer-events-none" />
      <div class="fixed -bottom-40 left-1/3 w-96 h-96 bg-accent-secondary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Conteneur principal */}
      <div class="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-7 space-y-7">
        {/* =================================================================
            1. SECTION HERO & TITRE
            ================================================================= */}
        <section class="space-y-2 border-b border-border-subtle/85 pb-5">
          <div class="flex items-center space-x-2">
            <span class="inline-block w-2.5 h-2.5 bg-accent-primary shadow-glow-cyan" />
            <span class="font-mono text-xs font-bold tracking-widest text-accent-primary uppercase">
              // TRANSCENDANCE ARENA
            </span>
          </div>
          <h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white uppercase mt-1">
            ENTER THE{' '}
            <span class="text-accent-primary neon-text-cyan">ARENA</span>
          </h1>
          <p class="font-mono text-text-muted text-xs md:text-sm max-w-3xl pt-1">
            High-density real-time tactical geometry. Neutralize hostiles,
            assimilate radiant cores, and mutate combat chassis along live
            evolution trees.
          </p>
        </section>

        {/* =================================================================
            2. SECTION COMBAT DASHBOARD : MODES & DAILY CHALLENGES (8 cols + 4 cols)
            ================================================================= */}
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* CARTE GAUCHE : SÉLECTEUR DE MODE & RADAR (8 colonnes) */}
          <Card
            variant="default"
            class="lg:col-span-8 bg-surface-1/90 backdrop-blur-md border-border-subtle/85 rounded-xl p-5 sm:p-6 shadow-card-inner flex flex-col justify-between"
          >
            <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Colonne commandes modes (6 cols internes) */}
              <div class="md:col-span-6 space-y-5 flex flex-col justify-between">
                <div>
                  {/* Protocole Pilote */}
                  <div class="flex items-center justify-between font-mono text-[11px] mb-2">
                    <div class="flex items-center gap-1.5 text-text-muted">
                      <span class="material-symbols-outlined text-xs text-accent-primary">
                        badge
                      </span>
                      <span class="font-bold tracking-wider uppercase">
                        OPERATOR PILOT PROTOCOL
                      </span>
                    </div>
                    <div class="flex items-center gap-1.5 text-success-foreground font-bold">
                      <span class="w-1.5 h-1.5 rounded-full bg-success-foreground shadow-glow-green-xs" />
                      <span>12,482 PILOTS</span>
                    </div>
                  </div>

                  {/* Call-sign (lecture seule) */}
                  <div class="flex items-center px-3.5 py-2.5 rounded-lg bg-background border border-border-subtle/85 font-mono text-xs">
                    <div class="flex items-center space-x-2 text-white">
                      <span class="text-accent-primary font-bold">[</span>
                      <span class="font-bold tracking-widest text-accent-primary">
                        {callsign()}
                      </span>
                      <span class="text-accent-primary font-bold">]</span>
                    </div>
                  </div>

                  {/* Classe Active */}
                  <div class="mt-3 px-3 py-2 rounded-lg bg-surface-1 border border-border-subtle/85 flex items-center justify-between font-mono text-xs">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-sm text-accent-primary">
                        view_in_ar
                      </span>
                      <span class="text-text-muted text-[11px]">
                        CHASSIS CLASS:
                      </span>
                    </div>
                    <span class="text-accent-primary font-bold tracking-wider">
                      {activeChassis()} Mk.IV
                    </span>
                  </div>

                  {/* En-tête des Modes */}
                  <div class="mt-4 flex items-center justify-between">
                    <h2 class="text-xs font-mono font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
                      <span class="material-symbols-outlined text-sm text-accent-primary">
                        tune
                      </span>
                      SELECT SIMULATION MODE:
                    </h2>
                  </div>

                  {/* Grille 2x2 des Modes */}
                  <div class="grid grid-cols-2 gap-2.5 mt-2.5">
                    <For
                      each={[
                        {
                          id: 'ffa' as const,
                          label: 'FFA SOLO',
                          sub: 'Solo Domination',
                          icon: 'groups_3',
                        },
                        {
                          id: 'tdm' as const,
                          label: 'SQUAD 4v4',
                          sub: 'Team Combat',
                          icon: 'shield',
                        },
                        {
                          id: 'ctf' as const,
                          label: 'EXTRACTION',
                          sub: 'Objective Hunt',
                          icon: 'flag',
                        },
                        {
                          id: 'br' as const,
                          label: 'OVERLOAD',
                          sub: 'Shrinking Zone',
                          icon: 'warning',
                        },
                      ]}
                    >
                      {(mode) => {
                        const isActive = () => selectedMode() === mode.id;
                        return (
                          <button
                            type="button"
                            onClick={() => setSelectedMode(mode.id)}
                            class={[
                              'group text-left px-3 py-2.5 rounded-lg border transition-all relative overflow-hidden cursor-pointer',
                              {
                                'border-accent-primary bg-accent-primary/15 shadow-glow-cyan-md text-white':
                                  isActive(),
                                'border-border-subtle/85 bg-surface-2 text-text-secondary hover:text-white hover:border-accent-primary/60':
                                  !isActive(),
                              },
                            ]}
                          >
                            <div class="flex items-center justify-between">
                              <span
                                class={[
                                  'text-xs font-mono font-bold tracking-wider',
                                  {
                                    'text-accent-primary': isActive(),
                                    'group-hover:text-accent-primary':
                                      !isActive(),
                                  },
                                ]}
                              >
                                {mode.label}
                              </span>
                              <span
                                class={[
                                  'material-symbols-outlined text-xs',
                                  {
                                    'text-accent-primary': isActive(),
                                    'text-text-muted group-hover:text-accent-primary':
                                      !isActive(),
                                  },
                                ]}
                              >
                                {mode.icon}
                              </span>
                            </div>
                            <div class="text-[10px] text-text-muted font-mono mt-0.5">
                              {mode.sub}
                            </div>
                          </button>
                        );
                      }}
                    </For>
                  </div>

                  {/* Commutateur Casual vs Ranked */}
                  <div class="mt-4 bg-surface-1 p-1 rounded-lg border border-border-subtle/85 flex items-center">
                    <button
                      type="button"
                      onClick={() => setSubMode('casual')}
                      class={[
                        'flex-1 py-1.5 text-xs font-mono font-bold rounded text-center transition-all cursor-pointer',
                        {
                          'text-accent-primary bg-accent-primary-subtle/60 border border-accent-primary/60 shadow-glow-cyan-sm':
                            subMode() === 'casual',
                          'text-text-muted hover:text-white':
                            subMode() !== 'casual',
                        },
                      ]}
                    >
                      [ CASUAL SIM ]
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubMode('ranked')}
                      class={[
                        'flex-1 py-1.5 text-xs font-mono font-bold rounded text-center transition-all cursor-pointer',
                        {
                          'text-accent-primary bg-accent-primary-subtle/60 border border-accent-primary/60 shadow-glow-cyan-sm':
                            subMode() === 'ranked',
                          'text-text-muted hover:text-white':
                            subMode() !== 'ranked',
                        },
                      ]}
                    >
                      [ RANKED ARENA ]
                    </button>
                  </div>
                </div>

                {/* Description du Mode */}
                <div class="space-y-1.5 pt-3 border-t border-border-subtle/85">
                  <div class="font-mono text-xs font-bold text-accent-primary tracking-wider flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 bg-accent-primary shadow-glow-cyan-xs" />
                    <span>{modeDetails[selectedMode()].badge}</span>
                  </div>
                  <p class="text-xs text-text-secondary leading-relaxed font-mono">
                    {modeDetails[selectedMode()].desc}
                  </p>
                </div>
              </div>

              {/* Colonne droite HUD Radar (6 cols internes) */}
              <div class="md:col-span-6 flex flex-col justify-between bg-surface-2 rounded-xl border border-border-subtle/85 p-4 relative overflow-hidden">
                <div class="absolute inset-0 striped-pattern opacity-30 pointer-events-none z-20" />

                {/* En-tête télémétrique */}
                <div class="flex items-center justify-end z-10 font-mono text-[11px]">
                  <span class="text-accent-primary font-bold tracking-wider">
                    AIM LOCK: MOUSE
                  </span>
                </div>

                {/* Viseur Radar & Tank Interactif */}
                <div class="relative w-full aspect-square max-w-[250px] mx-auto my-1 flex items-center justify-center">
                  <div class="absolute inset-2 rounded-full border border-accent-primary-subtle/70 pointer-events-none" />
                  <div class="absolute inset-6 rounded-full border border-accent-primary-pressed/40 pointer-events-none" />
                  <div class="absolute inset-10 rounded-full border border-accent-primary-pressed/40 border-dashed pointer-events-none" />

                  {/* Pivot de rotation vers la souris */}
                  <div
                    ref={(el) => (tankPivotRef = el)}
                    class="relative z-10 w-36 h-36 flex items-center justify-center cursor-crosshair will-change-transform"
                  >
                    <ChassisVector
                      type={activeChassis()}
                      color={selectedColor().hex}
                      glow={selectedColor().glow}
                      class="w-32 h-32 tank-soft-halo pointer-events-none"
                    />
                  </div>
                </div>

                {/* Barres Télémétriques */}
                <div class="z-10 pt-1 font-mono text-[10px] space-y-1">
                  <div class="flex items-center justify-between text-text-muted">
                    <span>
                      VELOCITY <strong class="text-white ml-1">85%</strong>
                    </span>
                    <span>
                      DAMAGE{' '}
                      <strong class="text-accent-secondary ml-1">92%</strong>
                    </span>
                    <span>
                      BARRIER{' '}
                      <strong class="text-success-foreground ml-1">74%</strong>
                    </span>
                  </div>
                  <div class="w-full bg-surface-1 h-1.5 rounded-full overflow-hidden flex gap-0.5">
                    <div
                      class="bg-accent-primary h-full rounded-l transition-all duration-300"
                      style={{ width: '45%' }}
                    />
                    <div
                      class="bg-accent-secondary h-full transition-all duration-300"
                      style={{ width: '35%' }}
                    />
                    <div
                      class="bg-success-foreground h-full rounded-r transition-all duration-300"
                      style={{ width: '20%' }}
                    />
                  </div>
                  <div class="flex items-center justify-between text-[10px] text-text-muted pt-0.5">
                    <span>SHIELDS: 100%</span>
                    <span class="tracking-widest">
                      CORE REF: {selectedColor().ref}
                    </span>
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
                                'rounded-full relative transition-transform hover:scale-110 focus:outline-none cursor-pointer',
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
                              <span class="striped-pattern absolute inset-0 rounded-full opacity-40" />
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bouton DEPLOY CTA */}
            <div class="mt-6 pt-5 border-t border-border-subtle/85 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Button
                variant="default"
                onClick={handleDeploy}
                disabled={deploying()}
                class="w-full sm:w-80 py-3.5 px-6 rounded-lg bg-accent-primary hover:bg-accent-primary-hover text-accent-primary-on font-extrabold text-sm md:text-base tracking-wider font-mono uppercase shadow-glow-cyan hover:shadow-glow-cyan-lg transform active:scale-95 transition-all flex items-center justify-center gap-3 border border-accent-primary-hover"
              >
                <span class="material-symbols-outlined font-extrabold text-lg">
                  bolt
                </span>
                <span class="tracking-widest">{deployText()}</span>
              </Button>
            </div>
          </Card>

          {/* CARTE DROITE : DAILY CHALLENGES (4 colonnes) */}
          <Card
            variant="default"
            class="lg:col-span-4 bg-surface-1/90 backdrop-blur-md border-border-subtle/85 rounded-xl p-5 sm:p-6 shadow-card-inner flex flex-col justify-between"
          >
            <div>
              {/* En-tête Défis */}
              <div class="flex items-center justify-between border-b border-border-subtle/85 pb-2.5">
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="material-symbols-outlined text-sm text-accent-secondary">
                      flag
                    </span>
                    <span class="font-mono text-xs font-bold text-accent-secondary tracking-wider uppercase">
                      DAILY CHALLENGES
                    </span>
                  </div>
                  <h2 class="text-xl font-bold text-white tracking-wide mt-0.5">
                    Make every match count
                  </h2>
                </div>
                <Badge variant="success">+1,500 CREDITS</Badge>
              </div>

              {/* Liste des Quêtes */}
              <div class="mt-4 space-y-3">
                {/* Quête 1 */}
                <div class="bg-surface-1 border border-border-subtle/85 rounded-lg p-3 space-y-1.5">
                  <div class="flex items-center justify-between text-xs font-mono">
                    <span class="text-text-primary">
                      First strike: Destroy 5 predator tanks in FFA
                    </span>
                    <span class="text-accent-primary font-bold">[ 3 / 5 ]</span>
                  </div>
                  <Progress
                    value={60}
                    color="cyan"
                    class="h-1.5 shadow-glow-cyan-xs"
                  />
                </div>

                {/* Quête 2 (Accomplie avec bouton CLAIM) */}
                <div class="bg-surface-1 border border-border-subtle/85 rounded-lg p-3 space-y-2">
                  <div class="flex items-center justify-between text-xs font-mono">
                    <span class="text-text-primary">
                      Core harvester: Absorb 50 radiant pentagons
                    </span>
                    <span class="text-success-foreground font-bold">
                      [ 50 / 50 ]
                    </span>
                  </div>
                  <div class="flex items-center justify-between pt-0.5 gap-3">
                    <div class="w-3/5">
                      <Progress
                        value={100}
                        color="lime"
                        class="h-1.5 shadow-glow-green-xs"
                      />
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={claimedReward()}
                      onClick={() => setClaimedReward(true)}
                      class="px-2.5 py-1 text-[10px] font-mono font-bold bg-success-foreground hover:bg-success-foreground/80 text-accent-primary-on rounded shadow-glow-green-sm transition-colors uppercase tracking-wider flex items-center gap-1 shrink-0"
                    >
                      <span class="material-symbols-outlined text-[11px]">
                        redeem
                      </span>
                      {claimedReward() ? 'CLAIMED' : 'CLAIM REWARD'}
                    </Button>
                  </div>
                </div>

                {/* Quête 3 */}
                <div class="bg-surface-1 border border-border-subtle/85 rounded-lg p-3 space-y-1.5">
                  <div class="flex items-center justify-between text-xs font-mono">
                    <span class="text-text-primary">
                      Apex predator: Reach top 3 on leaderboard
                    </span>
                    <span class="text-accent-secondary font-bold">
                      +250 CREDITS
                    </span>
                  </div>
                  <Progress
                    value={25}
                    color="pink"
                    class="h-1.5 shadow-glow-magenta-xs"
                  />
                </div>
              </div>
            </div>

            {/* Pied Quêtes */}
            <div class="pt-3 mt-3 border-t border-border-subtle/85 text-[11px] font-mono text-text-muted flex items-center justify-between">
              <span>RESETS IN: 04H 21M</span>
              <span class="text-accent-primary font-bold tracking-wider">
                [ TIER 4 BONUS ACTIVE ]
              </span>
            </div>
          </Card>
        </section>

        {/* =================================================================
            3. SECTION COMBAT EVOLUTION (3 Châssis)
            ================================================================= */}
        <section class="space-y-4" id="classes">
          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-border-subtle/85 pb-3">
            <div>
              <div class="flex items-center space-x-2">
                <span class="material-symbols-outlined text-sm text-accent-primary">
                  account_tree
                </span>
                <span class="font-mono text-xs font-bold tracking-widest text-accent-primary uppercase">
                  CHASSIS ARCHITECTURE
                </span>
              </div>
              <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight text-white uppercase mt-1">
                VIEW YOUR COMBAT EVOLUTION
              </h2>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <For
              each={[
                {
                  id: 'STRIKER' as const,
                  badge: 'ASSAULT // MK.IV',
                  icon: 'bolt',
                  subtitle: 'TWIN CANNON',
                  desc: 'High-velocity twin kinetic cannons configured for relentless strafing runs and sustained target lockdown.',
                },
                {
                  id: 'PHANTOM' as const,
                  badge: 'STEALTH // INFILTRATOR',
                  icon: 'visibility_off',
                  subtitle: 'PRECISION SPIKE',
                  desc: 'Optical camouflage active cloaking with sudden hyper-damage plasma spikes from behind enemy blind spots.',
                },
                {
                  id: 'OVERSEER' as const,
                  badge: 'DRONE SWARM // LOGIC',
                  icon: 'hub',
                  subtitle: 'DRONE CONTROL',
                  desc: 'Deploys self-guided micro-drone triangles that harass targets, protect flank angles, and breach enemy shields.',
                },
              ]}
            >
              {(chassis) => {
                const isSelected = () => activeChassis() === chassis.id;
                return (
                  <Card
                    variant="interactive"
                    onClick={() => setActiveChassis(chassis.id)}
                    class={[
                      'bg-surface-2 backdrop-blur-md border rounded-xl p-5 shadow-card-inner flex flex-col justify-between relative overflow-hidden group transition-all cursor-pointer',
                      {
                        'border-accent-primary ring-1 ring-focus-primary':
                          isSelected(),
                        'border-border-subtle/85 hover:border-accent-primary/60':
                          !isSelected(),
                      },
                    ]}
                  >
                    <div class="space-y-4">
                      {/* Badge Haut */}
                      <div class="flex items-center justify-between font-mono text-[11px]">
                        <Badge variant="default" class="shadow-glow-cyan-sm">
                          {chassis.badge}
                        </Badge>
                        <span class="material-symbols-outlined text-accent-primary text-sm">
                          {chassis.icon}
                        </span>
                      </div>

                      {/* Baie d'illustration Vectorielle */}
                      <div class="relative w-full aspect-[4/3] rounded-lg bg-surface-1 border border-border-subtle/85 group-hover:border-accent-primary/40 flex items-center justify-center overflow-hidden transition-colors">
                        <div class="absolute inset-0 tactical-grid opacity-50 pointer-events-none" />
                        <div class="absolute inset-4 rounded-full border border-accent-primary/20 pointer-events-none" />
                        <div class="absolute inset-10 rounded-full border border-accent-primary/30 border-dashed pointer-events-none" />

                        <div class="relative z-10 w-28 h-28 flex items-center justify-center">
                          <ChassisVector
                            type={chassis.id}
                            color={selectedColor().hex}
                            glow={selectedColor().glow}
                            class="w-24 h-24 group-hover:scale-110 transition-transform duration-300"
                          />
                        </div>
                      </div>

                      {/* Spécifications & Description */}
                      <div>
                        <div class="flex items-baseline justify-between">
                          <h3 class="text-xl font-extrabold text-white tracking-wider uppercase font-mono group-hover:text-accent-primary transition-colors">
                            {chassis.id}
                          </h3>
                          <span class="text-[11px] font-mono text-accent-primary uppercase font-bold">
                            {chassis.subtitle}
                          </span>
                        </div>
                        <p class="text-xs text-text-secondary font-mono mt-1.5 leading-relaxed">
                          {chassis.desc}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              }}
            </For>
          </div>
        </section>

        {/* =================================================================
            4. SECTION INFÉRIEURE : KEY MAP & ARENA APEX (7 cols + 5 cols)
            ================================================================= */}
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* CARTE GAUCHE : CONTRÔLES TACTIQUES (7 colonnes) */}
          <Card
            variant="default"
            class="lg:col-span-7 bg-surface-1/90 backdrop-blur-md border-border-subtle/85 rounded-xl p-5 sm:p-6 shadow-card-inner space-y-4"
          >
            <div class="flex items-center justify-between border-b border-border-subtle/85 pb-2.5">
              <div>
                <div class="flex items-center space-x-2">
                  <span class="material-symbols-outlined text-sm text-accent-primary">
                    keyboard
                  </span>
                  <span class="font-mono text-xs font-bold text-accent-primary tracking-wider uppercase">
                    KEY MAP TELEMETRY
                  </span>
                </div>
                <h2 class="text-xl font-bold text-white tracking-wide mt-0.5">
                  Move. Aim. Evolve.
                </h2>
              </div>
              <div class="font-mono text-[10px] text-text-muted">
                TACTICAL CONTROL SCHEME
              </div>
            </div>

            {/* Grille des raccourcis Kbd */}
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono">
              {/* 1. THRUST */}
              <div class="bg-surface-1 border border-border-subtle/85 hover:border-accent-primary/50 rounded-lg p-3 sm:p-3.5 transition-colors flex flex-col justify-between">
                <div class="flex items-center justify-between gap-1 w-full">
                  <span class="text-[11px] font-bold text-text-secondary font-mono tracking-wide truncate">
                    THRUST / MOVE
                  </span>
                  <Kbd
                    variant="glow"
                    size="sm"
                    class="shrink-0 whitespace-nowrap"
                  >
                    [ W A S D ]
                  </Kbd>
                </div>
                <div class="text-[11px] text-text-muted mt-2 font-mono leading-relaxed">
                  Multi-directional thrusters
                </div>
              </div>

              {/* 2. AIM TURRET */}
              <div class="bg-surface-1 border border-border-subtle/85 hover:border-accent-primary/50 rounded-lg p-3 sm:p-3.5 transition-colors flex flex-col justify-between">
                <div class="flex items-center justify-between gap-1 w-full">
                  <span class="text-[11px] font-bold text-text-secondary font-mono tracking-wide truncate">
                    AIM TURRET
                  </span>
                  <Kbd
                    variant="glow"
                    size="sm"
                    class="shrink-0 whitespace-nowrap"
                  >
                    [ MOUSE ]
                  </Kbd>
                </div>
                <div class="text-[11px] text-text-muted mt-2 font-mono leading-relaxed">
                  Turret lock & track
                </div>
              </div>

              {/* 3. UPGRADE HUD */}
              <div class="bg-surface-1 border border-border-subtle/85 hover:border-accent-primary/50 rounded-lg p-3 sm:p-3.5 transition-colors flex flex-col justify-between">
                <div class="flex items-center justify-between gap-1 w-full">
                  <span class="text-[11px] font-bold text-text-secondary font-mono tracking-wide truncate">
                    UPGRADE HUD
                  </span>
                  <Kbd
                    variant="glow"
                    size="sm"
                    class="shrink-0 whitespace-nowrap"
                  >
                    [ TAB / ESC ]
                  </Kbd>
                </div>
                <div class="text-[11px] text-text-muted mt-2 font-mono leading-relaxed">
                  Chassis tree matrix
                </div>
              </div>

              {/* 4. PRIMARY FIRE (spans 2 cols on md) */}
              <div class="bg-surface-1 border border-border-subtle/85 hover:border-accent-primary/50 rounded-lg p-3 sm:p-3.5 transition-colors md:col-span-2 flex flex-col justify-between">
                <div class="flex items-center justify-between gap-2 w-full">
                  <span class="text-[11px] font-bold text-text-secondary font-mono tracking-wide">
                    PRIMARY FIRE
                  </span>
                  <Kbd
                    variant="glow"
                    size="sm"
                    class="shrink-0 whitespace-nowrap"
                  >
                    [ L-CLICK / SPACE ]
                  </Kbd>
                </div>
                <div class="mt-2.5">
                  <Badge variant="success" class="shadow-glow-green-sm">
                    AUTO-FIRE READY
                  </Badge>
                </div>
                <div class="text-[11px] text-text-muted mt-2 font-mono leading-relaxed">
                  Primary cannon barrage & projectile acceleration burst
                </div>
              </div>

              {/* 5. STAT MATRIX */}
              <div class="bg-surface-1 border border-border-subtle/85 hover:border-accent-primary/50 rounded-lg p-3 sm:p-3.5 transition-colors flex flex-col justify-between">
                <div class="flex items-center justify-between gap-1 w-full">
                  <span class="text-[11px] font-bold text-text-secondary font-mono tracking-wide truncate">
                    STAT MATRIX
                  </span>
                  <Kbd
                    variant="glow"
                    size="sm"
                    class="shrink-0 whitespace-nowrap"
                  >
                    [ 1 - 6 ]
                  </Kbd>
                </div>
                <div class="text-[11px] text-text-muted mt-2 font-mono leading-relaxed">
                  Stat allocation points
                </div>
              </div>
            </div>

            {/* Détection Manette */}
            <div class="pt-2 text-[11px] font-mono text-text-muted flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-accent-primary shadow-glow-cyan animate-pulse" />
              <span>CONTROLLER: DETECTED (DUAL ANALOG OVERDRIVE ACTIVE)</span>
            </div>
          </Card>

          {/* CARTE DROITE : ARENA APEX LEADERBOARD (5 colonnes) */}
          <Card
            variant="default"
            class="lg:col-span-5 bg-surface-1/90 backdrop-blur-md border-border-subtle/85 rounded-xl p-5 shadow-card-inner flex flex-col justify-between"
          >
            <div>
              {/* En-tête Apex */}
              <div class="flex items-center justify-between font-mono text-xs mb-2">
                <div class="flex items-center gap-2 font-bold text-accent-primary tracking-wider uppercase">
                  <span class="material-symbols-outlined text-sm">trophy</span>
                  <span>ARENA APEX</span>
                </div>
                <Badge variant="danger" class="animate-pulse">
                  <span class="w-1.5 h-1.5 rounded-full bg-error-foreground mr-1" />
                  LIVE TELEMETRY
                </Badge>
              </div>

              {/* Sous-titre */}
              <div class="flex items-center justify-between border-b border-border-subtle/85 pb-2.5">
                <h2 class="text-lg font-bold text-white tracking-wide font-sans">
                  Ranked Free-for-all
                </h2>
                <span class="font-mono text-[11px] text-text-muted">
                  GLOBAL TOP 10
                </span>
              </div>

              {/* Liste Top 5 */}
              <div class="mt-3.5 space-y-2 font-mono text-xs">
                {/* 01 */}
                <div class="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-2 border border-accent-primary/50 text-white shadow-glow-cyan-sm">
                  <div class="flex items-center space-x-2.5">
                    <span class="text-accent-primary font-extrabold px-1 bg-accent-primary-subtle/80 rounded border border-accent-primary/40">
                      01
                    </span>
                    <span class="material-symbols-outlined text-xs text-accent-primary">
                      verified
                    </span>
                    <span class="font-bold tracking-wider">NEONVOID</span>
                    <span class="text-[10px] text-text-muted font-normal">
                      PHANTOM
                    </span>
                  </div>
                  <span class="text-accent-primary font-bold tracking-wider">
                    248,475
                  </span>
                </div>

                {/* 02 */}
                <div class="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-2 border border-accent-secondary/40 text-text-primary shadow-glow-magenta-sm">
                  <div class="flex items-center space-x-2.5">
                    <span class="text-accent-secondary font-extrabold px-1 bg-accent-secondary-subtle/80 rounded border border-accent-secondary/40">
                      02
                    </span>
                    <span class="material-symbols-outlined text-xs text-accent-secondary">
                      target
                    </span>
                    <span class="font-bold tracking-wider">V3X_PILOT</span>
                    <span class="text-[10px] text-text-muted font-normal">
                      STRIKER
                    </span>
                  </div>
                  <span class="text-accent-secondary font-bold tracking-wider">
                    221,840
                  </span>
                </div>

                {/* 03 */}
                <div class="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-2 border border-accent-secondary-hover/40 text-text-secondary">
                  <div class="flex items-center space-x-2.5">
                    <span class="text-accent-secondary-hover font-extrabold px-1 bg-accent-secondary-subtle/80 rounded border border-accent-secondary-hover/40">
                      03
                    </span>
                    <span class="material-symbols-outlined text-xs text-accent-secondary-hover">
                      military_tech
                    </span>
                    <span class="tracking-wider">KAIROS</span>
                    <span class="text-[10px] text-text-muted font-normal">
                      OVERSEER
                    </span>
                  </div>
                  <span class="font-bold text-text-primary tracking-wider">
                    198,248
                  </span>
                </div>

                {/* 04 */}
                <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-1 border border-border-subtle/85 text-text-muted">
                  <div class="flex items-center space-x-2.5">
                    <span class="text-text-muted font-bold">04</span>
                    <span class="tracking-wide text-text-secondary">
                      NULLBYTE
                    </span>
                    <span class="text-[10px] text-text-muted">TITAN</span>
                  </div>
                  <span class="text-text-secondary">183,991</span>
                </div>

                {/* 05 */}
                <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-1 border border-border-subtle/85 text-text-muted">
                  <div class="flex items-center space-x-2.5">
                    <span class="text-text-muted font-bold">05</span>
                    <span class="tracking-wide text-text-secondary">
                      SYNTAX_ERR
                    </span>
                    <span class="text-[10px] text-text-muted">REAPER</span>
                  </div>
                  <span class="text-text-secondary">162,483</span>
                </div>

                {/* Ligne Joueur Actuel (#142) */}
                <div class="mt-3 flex items-center justify-between px-3 py-2.5 rounded-lg bg-gradient-to-r from-accent-secondary-subtle/40 via-surface-2 to-accent-primary-subtle/40 border border-accent-secondary shadow-glow-magenta text-white">
                  <div class="flex items-center space-x-2.5">
                    <span class="text-accent-secondary font-extrabold tracking-wider">
                      #142
                    </span>
                    <span class="font-bold tracking-wider text-text-primary">
                      YOU [{callsign()}]
                    </span>
                  </div>
                  <span class="text-accent-secondary font-extrabold tracking-wider">
                    124,179
                  </span>
                </div>
              </div>
            </div>

            {/* Pied de Carte Leaderboard */}
            <div class="pt-4 mt-4 border-t border-border-subtle/70 flex items-center justify-between font-mono text-xs">
              <span class="text-text-muted">
                YOUR ARENA RANK: <strong class="text-white">#142</strong>
              </span>
              <a
                href="#leaderboard"
                class="inline-flex items-center gap-1.5 font-bold text-accent-primary hover:text-white transition-colors group no-underline"
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
