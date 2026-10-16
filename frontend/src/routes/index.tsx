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
      hex: '#00f0ff',
      glow: 'rgba(0, 240, 255, 0.75)',
      ref: '#00F0FF',
      name: 'Electric Cyan',
    },
    {
      hex: '#ff4a8d',
      glow: 'rgba(255, 74, 141, 0.75)',
      ref: '#FF4A8D',
      name: 'Hot Pink',
    },
    {
      hex: '#39ff14',
      glow: 'rgba(57, 255, 20, 0.75)',
      ref: '#39FF14',
      name: 'Neon Green',
    },
    {
      hex: '#ffb703',
      glow: 'rgba(255, 183, 3, 0.75)',
      ref: '#FFB703',
      name: 'Electric Amber',
    },
    {
      hex: '#dcb8ff',
      glow: 'rgba(220, 184, 255, 0.75)',
      ref: '#DCB8FF',
      name: 'Active Violet',
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
      class="flex flex-col w-full relative overflow-x-hidden min-h-screen bg-hud-deep text-slate-200"
      style={{
        '--tank-glow-color': selectedColor().glow,
        '--tank-stroke-color': selectedColor().hex,
      }}
    >
      <Title>CYBERCORE // Tactical Net Arena</Title>

      {/* Arrière-plans d'ambiance et grille tactique */}
      <div class="fixed inset-0 tactical-grid pointer-events-none opacity-80 z-0" />
      <div class="fixed -top-40 -left-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div class="fixed top-1/3 -right-40 w-96 h-96 bg-fuchsia-600/15 rounded-full blur-3xl pointer-events-none" />
      <div class="fixed -bottom-40 left-1/3 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Conteneur principal */}
      <div class="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 py-7 space-y-7">
        {/* =================================================================
            1. SECTION HERO & TITRE
            ================================================================= */}
        <section class="space-y-2 border-b border-hud-line/85 pb-5">
          <div class="flex items-center space-x-2">
            <span class="inline-block w-2.5 h-2.5 bg-neon-cyan shadow-glow-cyan" />
            <span class="font-mono text-xs font-bold tracking-widest text-neon-cyan uppercase">
              // TRANSCENDANCE ARENA
            </span>
          </div>
          <h1 class="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-white uppercase mt-1">
            ENTER THE <span class="text-neon-cyan neon-text-cyan">ARENA</span>
          </h1>
          <p class="font-mono text-slate-400 text-xs md:text-sm max-w-3xl pt-1">
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
            class="lg:col-span-8 bg-hud-card/90 backdrop-blur-md border-hud-line/85 rounded-xl p-5 sm:p-6 shadow-card-inner flex flex-col justify-between"
          >
            <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Colonne commandes modes (6 cols internes) */}
              <div class="md:col-span-6 space-y-5 flex flex-col justify-between">
                <div>
                  {/* Protocole Pilote */}
                  <div class="flex items-center justify-between font-mono text-[11px] mb-2">
                    <div class="flex items-center gap-1.5 text-slate-400">
                      <span class="material-symbols-outlined text-xs text-neon-cyan">
                        badge
                      </span>
                      <span class="font-bold tracking-wider uppercase">
                        OPERATOR PILOT PROTOCOL
                      </span>
                    </div>
                    <div class="flex items-center gap-1.5 text-neon-green font-bold">
                      <span class="w-1.5 h-1.5 rounded-full bg-neon-green shadow-[0_0_6px_#39ff14]" />
                      <span>12,482 PILOTS</span>
                    </div>
                  </div>

                  {/* Call-sign (lecture seule) */}
                  <div class="flex items-center px-3.5 py-2.5 rounded-lg bg-hud-deep border border-hud-line/85 font-mono text-xs">
                    <div class="flex items-center space-x-2 text-white">
                      <span class="text-neon-cyan font-bold">[</span>
                      <span class="font-bold tracking-widest text-neon-cyan">
                        {callsign()}
                      </span>
                      <span class="text-neon-cyan font-bold">]</span>
                    </div>
                  </div>

                  {/* Classe Active */}
                  <div class="mt-3 px-3 py-2 rounded-lg bg-hud-panel border border-hud-line/85 flex items-center justify-between font-mono text-xs">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-sm text-neon-cyan">
                        view_in_ar
                      </span>
                      <span class="text-slate-400 text-[11px]">
                        CHASSIS CLASS:
                      </span>
                    </div>
                    <span class="text-neon-cyan font-bold tracking-wider">
                      {activeChassis()} Mk.IV
                    </span>
                  </div>

                  {/* En-tête des Modes */}
                  <div class="mt-4 flex items-center justify-between">
                    <h2 class="text-xs font-mono font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                      <span class="material-symbols-outlined text-sm text-neon-cyan">
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
                                'border-neon-cyan bg-neon-cyan/15 shadow-[0_0_15px_rgba(0,240,255,0.25)] text-white':
                                  isActive(),
                                'border-hud-line/85 bg-hud-raised text-slate-300 hover:text-white hover:border-neon-cyan/60':
                                  !isActive(),
                              },
                            ]}
                          >
                            <div class="flex items-center justify-between">
                              <span
                                class={[
                                  'text-xs font-mono font-bold tracking-wider',
                                  {
                                    'text-neon-cyan': isActive(),
                                    'group-hover:text-neon-cyan': !isActive(),
                                  },
                                ]}
                              >
                                {mode.label}
                              </span>
                              <span
                                class={[
                                  'material-symbols-outlined text-xs',
                                  {
                                    'text-neon-cyan': isActive(),
                                    'text-slate-500 group-hover:text-neon-cyan':
                                      !isActive(),
                                  },
                                ]}
                              >
                                {mode.icon}
                              </span>
                            </div>
                            <div class="text-[10px] text-slate-400 font-mono mt-0.5">
                              {mode.sub}
                            </div>
                          </button>
                        );
                      }}
                    </For>
                  </div>

                  {/* Commutateur Casual vs Ranked */}
                  <div class="mt-4 bg-hud-panel p-1 rounded-lg border border-hud-line/85 flex items-center">
                    <button
                      type="button"
                      onClick={() => setSubMode('casual')}
                      class={[
                        'flex-1 py-1.5 text-xs font-mono font-bold rounded text-center transition-all cursor-pointer',
                        {
                          'text-neon-cyan bg-cyan-950/60 border border-neon-cyan/60 shadow-[0_0_10px_rgba(0,240,255,0.25)]':
                            subMode() === 'casual',
                          'text-slate-400 hover:text-white':
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
                          'text-neon-cyan bg-cyan-950/60 border border-neon-cyan/60 shadow-[0_0_10px_rgba(0,240,255,0.25)]':
                            subMode() === 'ranked',
                          'text-slate-400 hover:text-white':
                            subMode() !== 'ranked',
                        },
                      ]}
                    >
                      [ RANKED ARENA ]
                    </button>
                  </div>
                </div>

                {/* Description du Mode */}
                <div class="space-y-1.5 pt-3 border-t border-hud-line/85">
                  <div class="font-mono text-xs font-bold text-neon-cyan tracking-wider flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 bg-neon-cyan shadow-[0_0_6px_#00f0ff]" />
                    <span>{modeDetails[selectedMode()].badge}</span>
                  </div>
                  <p class="text-xs text-slate-300 leading-relaxed font-mono">
                    {modeDetails[selectedMode()].desc}
                  </p>
                </div>
              </div>

              {/* Colonne droite HUD Radar (6 cols internes) */}
              <div class="md:col-span-6 flex flex-col justify-between bg-hud-raised rounded-xl border border-hud-line/85 p-4 relative overflow-hidden">
                <div class="absolute inset-0 striped-pattern opacity-30 pointer-events-none z-20" />

                {/* En-tête télémétrique */}
                <div class="flex items-center justify-end z-10 font-mono text-[11px]">
                  <span class="text-neon-cyan font-bold tracking-wider">
                    AIM LOCK: MOUSE
                  </span>
                </div>

                {/* Viseur Radar & Tank Interactif */}
                <div class="relative w-full aspect-square max-w-[250px] mx-auto my-1 flex items-center justify-center">
                  <div class="absolute inset-2 rounded-full border border-cyan-950/70 pointer-events-none" />
                  <div class="absolute inset-6 rounded-full border border-cyan-900/40 pointer-events-none" />
                  <div class="absolute inset-10 rounded-full border border-cyan-800/40 border-dashed pointer-events-none" />

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
                  <div class="flex items-center justify-between text-slate-400">
                    <span>
                      VELOCITY <strong class="text-white ml-1">85%</strong>
                    </span>
                    <span>
                      DAMAGE <strong class="text-neon-magenta ml-1">92%</strong>
                    </span>
                    <span>
                      BARRIER <strong class="text-neon-green ml-1">74%</strong>
                    </span>
                  </div>
                  <div class="w-full bg-hud-panel h-1.5 rounded-full overflow-hidden flex gap-0.5">
                    <div
                      class="bg-neon-cyan h-full rounded-l transition-all duration-300"
                      style={{ width: '45%' }}
                    />
                    <div
                      class="bg-neon-magenta h-full transition-all duration-300"
                      style={{ width: '35%' }}
                    />
                    <div
                      class="bg-neon-green h-full rounded-r transition-all duration-300"
                      style={{ width: '20%' }}
                    />
                  </div>
                  <div class="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                    <span>SHIELDS: 100%</span>
                    <span class="tracking-widest">
                      CORE REF: {selectedColor().ref}
                    </span>
                  </div>
                </div>

                {/* Sélecteur de couleur du cœur */}
                <div class="mt-3 z-10 pt-2 border-t border-hud-line/70 flex items-center justify-between font-mono text-xs">
                  <div class="flex items-center gap-3">
                    <span class="text-[11px] text-slate-400 font-mono tracking-wider">
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
                                  'w-6 h-6 ring-2 ring-offset-2 ring-offset-hud-raised':
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
            <div class="mt-6 pt-5 border-t border-hud-line/85 flex flex-col sm:flex-row items-center justify-between gap-4">
              <Button
                variant="default"
                onClick={handleDeploy}
                disabled={deploying()}
                class="w-full sm:w-80 py-3.5 px-6 rounded-lg bg-neon-cyan hover:bg-cyan-300 text-hud-deep font-extrabold text-sm md:text-base tracking-wider font-mono uppercase shadow-glow-cyan hover:shadow-glow-cyan-lg transform active:scale-95 transition-all flex items-center justify-center gap-3 border border-cyan-100"
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
            class="lg:col-span-4 bg-hud-card/90 backdrop-blur-md border-hud-line/85 rounded-xl p-5 sm:p-6 shadow-card-inner flex flex-col justify-between"
          >
            <div>
              {/* En-tête Défis */}
              <div class="flex items-center justify-between border-b border-hud-line/85 pb-2.5">
                <div>
                  <div class="flex items-center space-x-2">
                    <span class="material-symbols-outlined text-sm text-neon-magenta">
                      flag
                    </span>
                    <span class="font-mono text-xs font-bold text-neon-magenta tracking-wider uppercase">
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
                <div class="bg-hud-panel border border-hud-line/85 rounded-lg p-3 space-y-1.5">
                  <div class="flex items-center justify-between text-xs font-mono">
                    <span class="text-slate-200">
                      First strike: Destroy 5 predator tanks in FFA
                    </span>
                    <span class="text-neon-cyan font-bold">[ 3 / 5 ]</span>
                  </div>
                  <Progress
                    value={60}
                    color="cyan"
                    class="h-1.5 shadow-[0_0_8px_#00f0ff]"
                  />
                </div>

                {/* Quête 2 (Accomplie avec bouton CLAIM) */}
                <div class="bg-hud-panel border border-hud-line/85 rounded-lg p-3 space-y-2">
                  <div class="flex items-center justify-between text-xs font-mono">
                    <span class="text-slate-200">
                      Core harvester: Absorb 50 radiant pentagons
                    </span>
                    <span class="text-neon-green font-bold">[ 50 / 50 ]</span>
                  </div>
                  <div class="flex items-center justify-between pt-0.5 gap-3">
                    <div class="w-3/5">
                      <Progress
                        value={100}
                        color="lime"
                        class="h-1.5 shadow-[0_0_8px_#12ee83]"
                      />
                    </div>
                    <Button
                      variant="default"
                      size="sm"
                      disabled={claimedReward()}
                      onClick={() => setClaimedReward(true)}
                      class="px-2.5 py-1 text-[10px] font-mono font-bold bg-neon-green hover:bg-neon-green/80 text-hud-deep rounded shadow-[0_0_10px_rgba(18,238,131,0.5)] transition-colors uppercase tracking-wider flex items-center gap-1 shrink-0"
                    >
                      <span class="material-symbols-outlined text-[11px]">
                        redeem
                      </span>
                      {claimedReward() ? 'CLAIMED' : 'CLAIM REWARD'}
                    </Button>
                  </div>
                </div>

                {/* Quête 3 */}
                <div class="bg-hud-panel border border-hud-line/85 rounded-lg p-3 space-y-1.5">
                  <div class="flex items-center justify-between text-xs font-mono">
                    <span class="text-slate-200">
                      Apex predator: Reach top 3 on leaderboard
                    </span>
                    <span class="text-neon-magenta font-bold">
                      +250 CREDITS
                    </span>
                  </div>
                  <Progress
                    value={25}
                    color="pink"
                    class="h-1.5 shadow-[0_0_8px_#ff50df]"
                  />
                </div>
              </div>
            </div>

            {/* Pied Quêtes */}
            <div class="pt-3 mt-3 border-t border-hud-line/85 text-[11px] font-mono text-slate-500 flex items-center justify-between">
              <span>RESETS IN: 04H 21M</span>
              <span class="text-neon-cyan font-bold tracking-wider">
                [ TIER 4 BONUS ACTIVE ]
              </span>
            </div>
          </Card>
        </section>

        {/* =================================================================
            3. SECTION COMBAT EVOLUTION (3 Châssis)
            ================================================================= */}
        <section class="space-y-4" id="classes">
          <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-hud-line/85 pb-3">
            <div>
              <div class="flex items-center space-x-2">
                <span class="material-symbols-outlined text-sm text-neon-cyan">
                  account_tree
                </span>
                <span class="font-mono text-xs font-bold tracking-widest text-neon-cyan uppercase">
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
                      'bg-hud-raised backdrop-blur-md border rounded-xl p-5 shadow-card-inner flex flex-col justify-between relative overflow-hidden group transition-all cursor-pointer',
                      {
                        'border-neon-cyan ring-1 ring-neon-cyan': isSelected(),
                        'border-hud-line/85 hover:border-neon-cyan/60':
                          !isSelected(),
                      },
                    ]}
                  >
                    <div class="space-y-4">
                      {/* Badge Haut */}
                      <div class="flex items-center justify-between font-mono text-[11px]">
                        <Badge
                          variant="default"
                          class="shadow-[0_0_8px_rgba(0,240,255,0.35)]"
                        >
                          {chassis.badge}
                        </Badge>
                        <span class="material-symbols-outlined text-neon-cyan text-sm">
                          {chassis.icon}
                        </span>
                      </div>

                      {/* Baie d'illustration Vectorielle */}
                      <div class="relative w-full aspect-[4/3] rounded-lg bg-hud-panel border border-hud-line/85 group-hover:border-neon-cyan/40 flex items-center justify-center overflow-hidden transition-colors">
                        <div class="absolute inset-0 tactical-grid opacity-50 pointer-events-none" />
                        <div class="absolute inset-4 rounded-full border border-neon-cyan/20 pointer-events-none" />
                        <div class="absolute inset-10 rounded-full border border-neon-cyan/30 border-dashed pointer-events-none" />

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
                          <h3 class="text-xl font-extrabold text-white tracking-wider uppercase font-mono group-hover:text-neon-cyan transition-colors">
                            {chassis.id}
                          </h3>
                          <span class="text-[11px] font-mono text-neon-cyan uppercase font-bold">
                            {chassis.subtitle}
                          </span>
                        </div>
                        <p class="text-xs text-slate-300 font-mono mt-1.5 leading-relaxed">
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
            class="lg:col-span-7 bg-hud-card/90 backdrop-blur-md border-hud-line/85 rounded-xl p-5 sm:p-6 shadow-card-inner space-y-4"
          >
            <div class="flex items-center justify-between border-b border-hud-line/85 pb-2.5">
              <div>
                <div class="flex items-center space-x-2">
                  <span class="material-symbols-outlined text-sm text-neon-cyan">
                    keyboard
                  </span>
                  <span class="font-mono text-xs font-bold text-neon-cyan tracking-wider uppercase">
                    KEY MAP TELEMETRY
                  </span>
                </div>
                <h2 class="text-xl font-bold text-white tracking-wide mt-0.5">
                  Move. Aim. Evolve.
                </h2>
              </div>
              <div class="font-mono text-[10px] text-slate-400">
                TACTICAL CONTROL SCHEME
              </div>
            </div>

            {/* Grille des raccourcis Kbd */}
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 font-mono">
              {/* 1. THRUST */}
              <div class="bg-hud-panel border border-hud-line/85 hover:border-neon-cyan/50 rounded-lg p-3 sm:p-3.5 transition-colors flex flex-col justify-between">
                <div class="flex items-center justify-between gap-1 w-full">
                  <span class="text-[11px] font-bold text-slate-300 font-mono tracking-wide truncate">
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
                <div class="text-[11px] text-slate-400 mt-2 font-mono leading-relaxed">
                  Multi-directional thrusters
                </div>
              </div>

              {/* 2. AIM TURRET */}
              <div class="bg-hud-panel border border-hud-line/85 hover:border-neon-cyan/50 rounded-lg p-3 sm:p-3.5 transition-colors flex flex-col justify-between">
                <div class="flex items-center justify-between gap-1 w-full">
                  <span class="text-[11px] font-bold text-slate-300 font-mono tracking-wide truncate">
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
                <div class="text-[11px] text-slate-400 mt-2 font-mono leading-relaxed">
                  Turret lock & track
                </div>
              </div>

              {/* 3. UPGRADE HUD */}
              <div class="bg-hud-panel border border-hud-line/85 hover:border-neon-cyan/50 rounded-lg p-3 sm:p-3.5 transition-colors flex flex-col justify-between">
                <div class="flex items-center justify-between gap-1 w-full">
                  <span class="text-[11px] font-bold text-slate-300 font-mono tracking-wide truncate">
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
                <div class="text-[11px] text-slate-400 mt-2 font-mono leading-relaxed">
                  Chassis tree matrix
                </div>
              </div>

              {/* 4. PRIMARY FIRE (spans 2 cols on md) */}
              <div class="bg-hud-panel border border-hud-line/85 hover:border-neon-cyan/50 rounded-lg p-3 sm:p-3.5 transition-colors md:col-span-2 flex flex-col justify-between">
                <div class="flex items-center justify-between gap-2 w-full">
                  <span class="text-[11px] font-bold text-slate-300 font-mono tracking-wide">
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
                  <Badge
                    variant="success"
                    class="shadow-[0_0_8px_rgba(18,238,131,0.25)]"
                  >
                    AUTO-FIRE READY
                  </Badge>
                </div>
                <div class="text-[11px] text-slate-400 mt-2 font-mono leading-relaxed">
                  Primary cannon barrage & projectile acceleration burst
                </div>
              </div>

              {/* 5. STAT MATRIX */}
              <div class="bg-hud-panel border border-hud-line/85 hover:border-neon-cyan/50 rounded-lg p-3 sm:p-3.5 transition-colors flex flex-col justify-between">
                <div class="flex items-center justify-between gap-1 w-full">
                  <span class="text-[11px] font-bold text-slate-300 font-mono tracking-wide truncate">
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
                <div class="text-[11px] text-slate-400 mt-2 font-mono leading-relaxed">
                  Stat allocation points
                </div>
              </div>
            </div>

            {/* Détection Manette */}
            <div class="pt-2 text-[11px] font-mono text-slate-400 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-neon-cyan shadow-glow-cyan animate-pulse" />
              <span>CONTROLLER: DETECTED (DUAL ANALOG OVERDRIVE ACTIVE)</span>
            </div>
          </Card>

          {/* CARTE DROITE : ARENA APEX LEADERBOARD (5 colonnes) */}
          <Card
            variant="default"
            class="lg:col-span-5 bg-hud-card/90 backdrop-blur-md border-hud-line/85 rounded-xl p-5 shadow-card-inner flex flex-col justify-between"
          >
            <div>
              {/* En-tête Apex */}
              <div class="flex items-center justify-between font-mono text-xs mb-2">
                <div class="flex items-center gap-2 font-bold text-neon-cyan tracking-wider uppercase">
                  <span class="material-symbols-outlined text-sm">trophy</span>
                  <span>ARENA APEX</span>
                </div>
                <Badge variant="danger" class="animate-pulse">
                  <span class="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1" />
                  LIVE TELEMETRY
                </Badge>
              </div>

              {/* Sous-titre */}
              <div class="flex items-center justify-between border-b border-hud-line/85 pb-2.5">
                <h2 class="text-lg font-bold text-white tracking-wide font-sans">
                  Ranked Free-for-all
                </h2>
                <span class="font-mono text-[11px] text-slate-400">
                  GLOBAL TOP 10
                </span>
              </div>

              {/* Liste Top 5 */}
              <div class="mt-3.5 space-y-2 font-mono text-xs">
                {/* 01 */}
                <div class="flex items-center justify-between px-3 py-2.5 rounded-lg bg-hud-raised border border-neon-cyan/50 text-white shadow-[0_0_12px_rgba(0,240,255,0.2)]">
                  <div class="flex items-center space-x-2.5">
                    <span class="text-neon-cyan font-extrabold px-1 bg-cyan-950/80 rounded border border-neon-cyan/40">
                      01
                    </span>
                    <span class="material-symbols-outlined text-xs text-neon-cyan">
                      verified
                    </span>
                    <span class="font-bold tracking-wider">NEONVOID</span>
                    <span class="text-[10px] text-slate-400 font-normal">
                      PHANTOM
                    </span>
                  </div>
                  <span class="text-neon-cyan font-bold tracking-wider">
                    248,475
                  </span>
                </div>

                {/* 02 */}
                <div class="flex items-center justify-between px-3 py-2.5 rounded-lg bg-hud-raised border border-neon-magenta/40 text-slate-200 shadow-[0_0_10px_rgba(255,0,127,0.15)]">
                  <div class="flex items-center space-x-2.5">
                    <span class="text-neon-magenta font-extrabold px-1 bg-fuchsia-950/80 rounded border border-neon-magenta/40">
                      02
                    </span>
                    <span class="material-symbols-outlined text-xs text-neon-magenta">
                      target
                    </span>
                    <span class="font-bold tracking-wider">V3X_PILOT</span>
                    <span class="text-[10px] text-slate-400 font-normal">
                      STRIKER
                    </span>
                  </div>
                  <span class="text-neon-magenta font-bold tracking-wider">
                    221,840
                  </span>
                </div>

                {/* 03 */}
                <div class="flex items-center justify-between px-3 py-2.5 rounded-lg bg-hud-raised border border-neon-purple/40 text-slate-300">
                  <div class="flex items-center space-x-2.5">
                    <span class="text-neon-purple font-extrabold px-1 bg-purple-950/80 rounded border border-neon-purple/40">
                      03
                    </span>
                    <span class="material-symbols-outlined text-xs text-neon-purple">
                      military_tech
                    </span>
                    <span class="tracking-wider">KAIROS</span>
                    <span class="text-[10px] text-slate-400 font-normal">
                      OVERSEER
                    </span>
                  </div>
                  <span class="font-bold text-slate-200 tracking-wider">
                    198,248
                  </span>
                </div>

                {/* 04 */}
                <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-hud-panel border border-hud-line/85 text-slate-400">
                  <div class="flex items-center space-x-2.5">
                    <span class="text-slate-500 font-bold">04</span>
                    <span class="tracking-wide text-slate-300">NULLBYTE</span>
                    <span class="text-[10px] text-slate-500">TITAN</span>
                  </div>
                  <span class="text-slate-300">183,991</span>
                </div>

                {/* 05 */}
                <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-hud-panel border border-hud-line/85 text-slate-400">
                  <div class="flex items-center space-x-2.5">
                    <span class="text-slate-500 font-bold">05</span>
                    <span class="tracking-wide text-slate-300">SYNTAX_ERR</span>
                    <span class="text-[10px] text-slate-500">REAPER</span>
                  </div>
                  <span class="text-slate-300">162,483</span>
                </div>

                {/* Ligne Joueur Actuel (#142) */}
                <div class="mt-3 flex items-center justify-between px-3 py-2.5 rounded-lg bg-gradient-to-r from-fuchsia-950/40 via-hud-raised to-cyan-950/40 border border-neon-magenta shadow-glow-magenta text-white">
                  <div class="flex items-center space-x-2.5">
                    <span class="text-neon-magenta font-extrabold tracking-wider">
                      #142
                    </span>
                    <span class="font-bold tracking-wider text-pink-100">
                      YOU [{callsign()}]
                    </span>
                  </div>
                  <span class="text-neon-magenta font-extrabold tracking-wider">
                    124,179
                  </span>
                </div>
              </div>
            </div>

            {/* Pied de Carte Leaderboard */}
            <div class="pt-4 mt-4 border-t border-hud-line/70 flex items-center justify-between font-mono text-xs">
              <span class="text-slate-500">
                YOUR ARENA RANK: <strong class="text-white">#142</strong>
              </span>
              <a
                href="#leaderboard"
                class="inline-flex items-center gap-1.5 font-bold text-neon-cyan hover:text-white transition-colors group no-underline"
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
