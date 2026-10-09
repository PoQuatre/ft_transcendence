// src/routes/index.tsx
import { Title } from '@solidjs/meta';
import { useNavigate } from '@solidjs/router';
import { createSignal, onSettled, For } from 'solid-js';

import { Ticker } from '~/layout/Ticker';
import { Badge, Button, Card, Input, Kbd, Progress } from '~/components/ui';

export default function Home() {
  const navigate = useNavigate();

  // --- Signaux d'état ---
  const [callsign, setCallsign] = createSignal('NEXUS_VIPER');
  const [selectedMode, setSelectedMode] = createSignal('FFA');
  const [selectedColor, setSelectedColor] = createSignal('#00f0ff');
  const [selectedClass, setSelectedClass] = createSignal('STRIKER');
  const [deploying, setDeploying] = createSignal(false);
  const [deployText, setDeployText] = createSignal('DEPLOY');

  // Scores en direct du Leaderboard
  const [scores, setScores] = createSignal([
    248391, 221840, 198204, 183991, 162400, 149110, 138550, 124090,
  ]);

  // Références Canvas
  let arenaCanvasRef: HTMLCanvasElement | undefined;
  let tankCanvasRef: HTMLCanvasElement | undefined;
  let bgAnimId: number;
  let tankAnimId: number;

  // --- Générateur de callsign aléatoire ---
  const handleRandomCallsign = () => {
    const prefixes = ['NEXUS', 'VORTEX', 'CYBER', 'VOID', 'PHANTOM', 'ZERO', 'NEON', 'TITAN'];
    const suffixes = ['VIPER', 'WRAITH', 'STRIKE', 'PULSE', 'SHADOW', 'PRIME', 'CORE', 'GHOST'];
    const p = prefixes[Math.floor(Math.random() * prefixes.length)];
    const s = suffixes[Math.floor(Math.random() * suffixes.length)];
    const n = Math.floor(Math.random() * 99);
    setCallsign(`${p}_${s}${n < 10 ? '0' + n : n}`);
  };

  // --- Lancement du Déploiement / Connexion au Jeu ---
  const handleDeploy = () => {
    if (deploying()) return;
    setDeploying(true);
    setDeployText('CONNECTING...');

    setTimeout(() => {
      setDeployText('WARPING...');
      setTimeout(() => {
        navigate(
          `/game?pilot=${encodeURIComponent(callsign())}&class=${selectedClass()}&color=${encodeURIComponent(selectedColor())}`,
        );
      }, 800);
    }, 800);
  };

  // --- Cycles de vie Canvas & Raccourcis Clavier ---
  onSettled(() => {
    // 1. Raccourci touche Entrée pour déployer
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') handleDeploy();
    };
    window.addEventListener('keydown', handleKeyDown);

    // 2. Simulation de scores animés
    const scoreInterval = setInterval(() => {
      const idx = Math.floor(Math.random() * 8);
      setScores((prev) => {
        const next = [...prev];
        const current = next[idx];
        if (current !== undefined) {
          next[idx] = current + Math.floor(Math.random() * 75) + 15;
        }
        return next;
      });
    }, 1400);

    // 3. Canvas d'arrière-plan (simulation radar)
    if (arenaCanvasRef) {
      const ctx = arenaCanvasRef.getContext('2d');
      if (ctx) {
        let w = (arenaCanvasRef.width = window.innerWidth);
        let h = (arenaCanvasRef.height = window.innerHeight);

        const onResize = () => {
          if (!arenaCanvasRef) return;
          w = arenaCanvasRef.width = window.innerWidth;
          h = arenaCanvasRef.height = window.innerHeight;
        };
        window.addEventListener('resize', onResize);

        const shapes = Array.from({ length: 35 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          angle: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 0.02,
          size: 8 + Math.random() * 12,
          color: ['#00f0ff', '#ff4a8d', '#39ff14', '#dcb8ff', '#ffb703'][
            Math.floor(Math.random() * 5)
          ],
        }));

        const loopBg = () => {
          ctx.fillStyle = '#070a14';
          ctx.fillRect(0, 0, w, h);

          // Grille radar
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.035)';
          ctx.lineWidth = 1;
          for (let x = 0; x < w; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
          }
          for (let y = 0; y < h; y += 60) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          // Particules
          for (const s of shapes) {
            s.x = (s.x + s.vx + w) % w;
            s.y = (s.y + s.vy + h) % h;
            s.angle += s.vRot;

            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.angle);
            ctx.strokeStyle = s.color ?? '#00f0ff';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-s.size / 2, -s.size / 2, s.size, s.size);
            ctx.restore();
          }
          bgAnimId = requestAnimationFrame(loopBg);
        };
        loopBg();
      }
    }

    // 4. Canvas d'aperçu du tank (orientation souris fluide)
    let handleMouseMove: ((e: MouseEvent) => void) | undefined;
    if (tankCanvasRef) {
      const pCtx = tankCanvasRef.getContext('2d');
      if (pCtx) {
        let targetAngle = 0;
        let currentAngle = 0;

        handleMouseMove = (e: MouseEvent) => {
          if (!tankCanvasRef) return;
          const rect = tankCanvasRef.getBoundingClientRect();
          const mx = e.clientX - (rect.left + rect.width / 2);
          const my = e.clientY - (rect.top + rect.height / 2);
          targetAngle = Math.atan2(my, mx);
        };
        window.addEventListener('mousemove', handleMouseMove);

        const loopTank = () => {
          pCtx.clearRect(0, 0, 256, 256);

          let diff = targetAngle - currentAngle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          currentAngle += diff * 0.12;

          pCtx.save();
          pCtx.translate(128, 128);
          pCtx.rotate(currentAngle);

          const col = selectedColor();
          pCtx.shadowColor = col;
          pCtx.shadowBlur = 14;

          const currentClass = selectedClass();
          pCtx.fillStyle = '#191b26';
          pCtx.strokeStyle = col;
          pCtx.lineWidth = 3;

          // Rendu selon la classe
          if (currentClass === 'STRIKER') {
            pCtx.fillRect(10, -18, 55, 12);
            pCtx.strokeRect(10, -18, 55, 12);
            pCtx.fillRect(10, 6, 55, 12);
            pCtx.strokeRect(10, 6, 55, 12);
          } else if (currentClass === 'PHANTOM') {
            pCtx.beginPath();
            pCtx.moveTo(0, -25);
            pCtx.lineTo(65, 0);
            pCtx.lineTo(0, 25);
            pCtx.closePath();
            pCtx.fill();
            pCtx.stroke();
          } else if (currentClass === 'TITAN') {
            pCtx.fillRect(5, -14, 52, 28);
            pCtx.strokeRect(5, -14, 52, 28);
          } else if (currentClass === 'REAPER') {
            pCtx.fillRect(10, -5, 75, 10);
            pCtx.strokeRect(10, -5, 75, 10);
          } else {
            pCtx.fillRect(10, -8, 50, 16);
            pCtx.strokeRect(10, -8, 50, 16);
          }

          // Châssis central
          pCtx.beginPath();
          pCtx.arc(0, 0, 32, 0, Math.PI * 2);
          pCtx.fillStyle = '#0b0e18';
          pCtx.fill();
          pCtx.strokeStyle = col;
          pCtx.lineWidth = 4;
          pCtx.stroke();

          // Réacteur
          pCtx.beginPath();
          pCtx.arc(0, 0, 14, 0, Math.PI * 2);
          pCtx.fillStyle = col;
          pCtx.fill();

          pCtx.beginPath();
          pCtx.arc(0, 0, 5, 0, Math.PI * 2);
          pCtx.fillStyle = '#ffffff';
          pCtx.fill();

          pCtx.restore();
          tankAnimId = requestAnimationFrame(loopTank);
        };
        loopTank();
      }
    }

    // Nettoyage retourné directement (SolidJS 2.0)
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (handleMouseMove) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      clearInterval(scoreInterval);
      cancelAnimationFrame(bgAnimId);
      cancelAnimationFrame(tankAnimId);
    };
  });

  return (
    <div class="flex flex-col w-full relative overflow-hidden bg-surface-container-lowest text-on-surface">
      <Title>CYBERCORE // ARENA LOBBY</Title>

      {/* Fond Canvas Radar animé */}
      <canvas
        ref={(el) => {
          arenaCanvasRef = el;
        }}
        class="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-80"
      />

      {/* Halos de lumière néon */}
      <div class="absolute -top-32 left-1/4 w-[500px] h-[500px] bg-primary-container/10 blur-[130px] rounded-full pointer-events-none z-0" />
      <div class="absolute top-1/2 -right-40 w-[600px] h-[600px] bg-secondary-container/10 blur-[140px] rounded-full pointer-events-none z-0" />

      {/* Ticker télémétrique horizontal */}
      <Ticker />

      {/* Conteneur principal HUD */}
      <div class="relative z-10 w-full px-margin-mobile md:px-margin pt-space-lg pb-space-xl flex flex-col gap-space-xl max-w-7xl mx-auto">
        {/* Section Combat Core & Hero */}
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
          {/* Colonne Gauche : Terminal de déploiement (7 cols) */}
          <div class="lg:col-span-7 flex flex-col gap-space-lg">
            <div class="flex flex-col gap-space-xs">
              <div class="flex flex-wrap items-center gap-space-sm">
                <Badge variant="default">SEASON 04: OVERDRIVE</Badge>
                <Badge variant="secondary">RANKED ARENA V2.8.4</Badge>
                <span class="flex items-center gap-1 font-label-data text-label-data text-outline">
                  <span class="material-symbols-outlined text-[14px] text-primary">sensors</span>{' '}
                  US-CENTRAL
                </span>
              </div>
              <h1 class="font-display-hero text-display-hero md:text-[64px] font-black tracking-tight text-white uppercase drop-shadow-[0_0_25px_rgba(0,240,255,0.35)] leading-none mt-2">
                CYBER<span class="text-primary-container">CORE</span>
                <span class="block text-headline-xl text-outline tracking-wider font-light mt-1">
                  // NEURAL ARENA
                </span>
              </h1>
              <p class="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
                High-density real-time tactical geometry. Neutralize hostiles, assimilate radiant cores, and mutate combat chassis along live evolution trees.
              </p>
            </div>

            {/* Panneau Opérateur */}
            <Card variant="default" class="p-space-lg flex flex-col gap-space-md">
              <div class="flex items-center justify-between pb-space-xs">
                <div class="flex items-center gap-space-xs font-label-mono-caps text-label-mono-caps text-primary">
                  <span class="material-symbols-outlined text-[16px]">terminal</span>
                  <span>OPERATOR PILOT PROTOCOL</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="w-1.5 h-1.5 rounded-full bg-[#39ff14]" />
                  <span class="font-label-data text-label-data text-on-surface-variant tracking-wider">
                    12,482 PILOTS IN ARENA
                  </span>
                </div>
              </div>

              {/* Saisie Callsign & Bouton Deploy */}
              <div class="flex flex-col sm:flex-row items-stretch gap-space-sm">
                <div class="relative flex-1 group">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-primary font-bold">
                    [
                  </span>
                  <Input
                    class="px-8"
                    maxlength={16}
                    value={callsign()}
                    onInput={(e) => setCallsign(e.currentTarget.value)}
                    placeholder="ENTER_CALLSIGN..."
                  />
                  <span class="absolute right-10 top-1/2 -translate-y-1/2 font-mono text-primary font-bold">
                    ]
                  </span>
                  <button
                    type="button"
                    onClick={handleRandomCallsign}
                    title="Générer un pseudo"
                    class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                  >
                    <span class="material-symbols-outlined text-[20px]">casino</span>
                  </button>
                </div>

                <Button
                  variant="default"
                  size="lg"
                  onClick={handleDeploy}
                  disabled={deploying()}
                  class="font-headline-md tracking-widest gap-space-sm font-bold shadow-[0_0_24px_rgba(0,240,255,0.45)]"
                >
                  <span class="material-symbols-outlined text-[24px]">radar</span>
                  <span>{deployText()}</span>
                  <Kbd size="sm" class="hidden sm:inline-flex bg-black/30 border-white/20 text-white">
                    ENTER
                  </Kbd>
                </Button>
              </div>

              {/* Sélecteur de Mode */}
              <div class="flex flex-col gap-space-xs pt-space-xs">
                <span class="font-label-mono-caps text-label-mono-caps text-outline tracking-wider">
                  SELECT SIMULATION MODE:
                </span>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-space-xs">
                  <For
                    each={[
                      { id: 'FFA', label: 'FFA SOLO', icon: 'sports_kabaddi' },
                      { id: 'TEAMS', label: 'SQUAD 4v4', icon: 'groups' },
                      { id: 'DOM', label: 'DOMINATION', icon: 'flag_circle' },
                      { id: 'SURV', label: 'OVERLOAD', icon: 'warning' },
                    ]}
                  >
                    {(mode) => (
                      <button
                        type="button"
                        onClick={() => setSelectedMode(mode.id)}
                        class={[
                          'px-space-sm py-space-xs rounded font-label-mono-caps text-label-mono-caps text-center transition-all flex flex-col items-center gap-1 cursor-pointer',
                          {
                            'bg-primary-container/20 text-primary-container shadow-[0_0_12px_rgba(0,240,255,0.25)] border border-primary-container/50':
                              selectedMode() === mode.id,
                            'bg-surface-container-high/60 hover:bg-surface-container-high text-on-surface-variant hover:text-white border border-transparent':
                              selectedMode() !== mode.id,
                          },
                        ]}
                      >
                        <span class="material-symbols-outlined text-[18px]">{mode.icon}</span>
                        <span>{mode.label}</span>
                      </button>
                    )}
                  </For>
                </div>
              </div>

              {/* Mini Télémétrie */}
              <div class="grid grid-cols-3 gap-space-sm pt-space-xs font-label-data text-label-data text-on-surface-variant">
                <div class="bg-surface-container-lowest/60 p-space-xs rounded flex flex-col">
                  <span class="text-outline">PING</span>
                  <span class="text-[#39ff14] font-bold font-mono">14 MS</span>
                </div>
                <div class="bg-surface-container-lowest/60 p-space-xs rounded flex flex-col">
                  <span class="text-outline">CHASSIS CLASS</span>
                  <span class="text-primary font-bold font-mono">{selectedClass()} Mk.IV</span>
                </div>
                <div class="bg-surface-container-lowest/60 p-space-xs rounded flex flex-col">
                  <span class="text-outline">CURRENT LOADOUT</span>
                  <span class="text-secondary-fixed-dim font-bold font-mono">TWIN-ACCELERATOR</span>
                </div>
              </div>
            </Card>

            {/* Sélecteur de couleur */}
            <div class="flex items-center justify-between bg-surface-container-low/70 backdrop-blur p-space-sm rounded-lg border border-surface-container-high/40">
              <div class="flex items-center gap-space-sm">
                <span class="font-label-mono-caps text-label-mono-caps text-outline">CORE COLOR:</span>
                <div class="flex items-center gap-1.5">
                  <For each={['#00f0ff', '#ff4a8d', '#39ff14', '#ffb703', '#dcb8ff']}>
                    {(col) => (
                      <button
                        type="button"
                        aria-label={`Select color ${col}`}
                        onClick={() => setSelectedColor(col)}
                        style={{ 'background-color': col }}
                        class={[
                          'w-6 h-6 rounded-full transition-transform active:scale-95 cursor-pointer',
                          {
                            'ring-2 ring-primary-container shadow-[0_0_8px_#00f0ff] scale-110':
                              selectedColor() === col,
                            'opacity-60 hover:opacity-100': selectedColor() !== col,
                          },
                        ]}
                      />
                    )}
                  </For>
                </div>
              </div>
              <a
                href="#class-section"
                class="font-label-mono-caps text-label-mono-caps text-primary hover:text-primary-fixed flex items-center gap-1 transition-colors no-underline"
              >
                <span>MUTATION MATRIX</span>
                <span class="material-symbols-outlined text-[16px]">arrow_downward</span>
              </a>
            </div>
          </div>

          {/* Colonne Droite : Visualiseur Tank & Leaderboard (5 cols) */}
          <div class="lg:col-span-5 flex flex-col gap-space-md">
            {/* Visualiseur Tank */}
            <Card variant="default" class="p-space-md flex flex-col items-center justify-center min-h-[300px]">
              <span class="absolute top-2 left-2 font-mono text-[10px] text-outline">
                [SYS_DIAG // MK.4]
              </span>
              <span class="absolute top-2 right-2 font-mono text-[10px] text-primary-fixed-dim tracking-wider">
                AIM LOCK: MOUSE
              </span>
              <span class="absolute bottom-2 left-2 font-mono text-[10px] text-outline">
                SHIELDS: 100%
              </span>
              <span class="absolute bottom-2 right-2 font-mono text-[10px] text-outline">
                CORE REF: #284-F
              </span>

              <div class="relative w-64 h-64 flex items-center justify-center">
                <canvas
                  ref={(el) => {
                    tankCanvasRef = el;
                  }}
                  width="256"
                  height="256"
                  class="cursor-crosshair relative z-10"
                />
                <div class="absolute inset-0 border border-primary-container/15 rounded-full pointer-events-none animate-spin [animation-duration:40s]" />
                <div class="absolute inset-6 border border-dashed border-primary-container/20 rounded-full pointer-events-none animate-spin [animation-duration:25s] [animation-direction:reverse]" />
              </div>

              {/* Barres télémétriques */}
              <div class="w-full grid grid-cols-3 gap-space-sm pt-space-xs mt-space-xs">
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between font-label-data text-[10px] text-outline">
                    <span>VELOCITY</span>
                    <span class="text-primary font-mono">92%</span>
                  </div>
                  <Progress value={92} color="cyan" />
                </div>
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between font-label-data text-[10px] text-outline">
                    <span>DAMAGE</span>
                    <span class="text-secondary font-mono">88%</span>
                  </div>
                  <Progress value={88} color="pink" />
                </div>
                <div class="flex flex-col gap-1">
                  <div class="flex justify-between font-label-data text-[10px] text-outline">
                    <span>BARRIER</span>
                    <span class="text-[#39ff14] font-mono">74%</span>
                  </div>
                  <Progress value={74} color="lime" />
                </div>
              </div>
            </Card>

            {/* Leaderboard en direct */}
            <Card variant="default" class="p-space-md flex flex-col gap-space-sm" id="leaderboard">
              <div class="flex items-center justify-between pb-space-xs">
                <div class="flex items-center gap-space-xs">
                  <span class="material-symbols-outlined text-primary text-[18px]">trophy</span>
                  <span class="font-headline-md text-headline-md text-white">ARENA APEX</span>
                </div>
                <Badge variant="danger" class="animate-pulse">
                  LIVE TELEMETRY
                </Badge>
              </div>

              <div class="flex flex-col gap-1.5">
                <For
                  each={[
                    { rank: '01', name: 'NEONVOID', class: 'PHANTOM', variant: 'text-primary-container bg-primary-container/20' },
                    { rank: '02', name: 'V3X_PILOT', class: 'STRIKER', variant: 'text-secondary bg-secondary-container/20' },
                    { rank: '03', name: 'KAIROS', class: 'OVERSEER', variant: 'text-tertiary-fixed bg-tertiary-fixed/20' },
                    { rank: '04', name: 'NULLBYTE', class: 'TITAN', variant: 'text-on-surface bg-surface-container-high/40' },
                    { rank: '05', name: 'SYNTAX_ERR', class: 'REAPER', variant: 'text-on-surface bg-surface-container-high/40' },
                    { rank: '06', name: 'AXIOM_9', class: 'PULSE', variant: 'text-on-surface bg-surface-container-high/40' },
                    { rank: '07', name: 'CYBER_GHOST', class: 'STRIKER', variant: 'text-on-surface bg-surface-container-high/40' },
                    { rank: '08', name: 'ZERO_COOL', class: 'TITAN', variant: 'text-on-surface bg-surface-container-high/40' },
                  ]}
                >
                  {(player, i) => (
                    <div class={`flex items-center justify-between p-2 rounded ${player.variant}`}>
                      <div class="flex items-center gap-space-sm min-w-0">
                        <span class="font-label-mono-caps text-label-mono-caps font-black w-5">
                          {player.rank}
                        </span>
                        <span class="font-label-mono-caps text-body-sm font-bold truncate">
                          {player.name}
                        </span>
                        <span class="text-[9px] font-mono px-1 py-0.2 bg-surface-container-lowest text-outline rounded">
                          {player.class}
                        </span>
                      </div>
                      <span class="font-stat-counter text-[14px] font-mono tracking-tight">
                        {(scores()[i()] ?? 0).toLocaleString()}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Card>
          </div>
        </div>

        {/* Barre de statistiques globales */}
        <div class="grid grid-cols-2 md:grid-cols-6 gap-space-sm bg-surface-container/60 backdrop-blur p-space-md rounded-xl border border-surface-container-high/40">
          <div class="flex flex-col items-center justify-center p-space-xs text-center">
            <span class="font-label-mono-caps text-label-mono-caps text-outline">ARENA COMBATANTS</span>
            <span class="font-stat-counter text-stat-counter text-primary-container font-mono">12.4K</span>
            <span class="text-[10px] text-[#39ff14] font-mono">ONLINE NOW</span>
          </div>
          <div class="flex flex-col items-center justify-center p-space-xs text-center">
            <span class="font-label-mono-caps text-label-mono-caps text-outline">CORE CONFLICTS</span>
            <span class="font-stat-counter text-stat-counter text-white font-mono">84.2M</span>
            <span class="text-[10px] text-outline font-mono">LIFETIME ROUNDS</span>
          </div>
          <div class="flex flex-col items-center justify-center p-space-xs text-center">
            <span class="font-label-mono-caps text-label-mono-caps text-outline">ACTIVE NODES</span>
            <span class="font-stat-counter text-stat-counter text-secondary font-mono">7 REGIONS</span>
            <span class="text-[10px] text-[#39ff14] font-mono">LOW PACKET DROP</span>
          </div>
          <div class="flex flex-col items-center justify-center p-space-xs text-center">
            <span class="font-label-mono-caps text-label-mono-caps text-outline">UPGRADE CHASSIS</span>
            <span class="font-stat-counter text-stat-counter text-tertiary-fixed font-mono">32 BUILDS</span>
            <span class="text-[10px] text-outline font-mono">5 TIERS EVOLUTION</span>
          </div>
          <div class="flex flex-col items-center justify-center p-space-xs text-center">
            <span class="font-label-mono-caps text-label-mono-caps text-outline">NETWORK UPTIME</span>
            <span class="font-stat-counter text-stat-counter text-white font-mono">99.98%</span>
            <span class="text-[10px] text-[#39ff14] font-mono">DDoS SHIELDED</span>
          </div>
          <div class="flex flex-col items-center justify-center p-space-xs text-center">
            <span class="font-label-mono-caps text-label-mono-caps text-outline">ARENA TICKRATE</span>
            <span class="font-stat-counter text-stat-counter text-primary-fixed-dim font-mono">64 HZ</span>
            <span class="text-[10px] text-outline font-mono">SUB-PIXEL SYNC</span>
          </div>
        </div>

        {/* Catalogue d'Architecture des Châssis (Classes) */}
        <div class="flex flex-col gap-space-lg" id="class-section">
          <div>
            <div class="flex items-center gap-space-xs text-primary font-label-mono-caps text-label-mono-caps">
              <span class="material-symbols-outlined text-[16px]">account_tree</span>
              <span>CHASSIS ARCHITECTURE</span>
            </div>
            <h2 class="font-headline-xl text-headline-xl text-white font-bold tracking-tight">
              CHOOSE YOUR COMBAT EVOLUTION
            </h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter-lg">
            <For
              each={[
                {
                  id: 'STRIKER',
                  role: 'ASSAULT // MK.IV',
                  icon: 'bolt',
                  desc: 'High-velocity twin kinetic cannons configured for relentless strafing runs and sustained target lockdown.',
                  stat1: { label: 'FIREPOWER', val: 92, color: 'cyan' as const },
                  stat2: { label: 'VELOCITY', val: 85, color: 'cyan' as const },
                },
                {
                  id: 'PHANTOM',
                  role: 'STEALTH // INFILTRATOR',
                  icon: 'visibility_off',
                  desc: 'Optical camouflage active cloaking with sudden hyper-damage plasma spikes from behind enemy blind spots.',
                  stat1: { label: 'BURST DAMAGE', val: 98, color: 'pink' as const },
                  stat2: { label: 'AGILITY', val: 95, color: 'pink' as const },
                },
                {
                  id: 'OVERSEER',
                  role: 'DRONE SWARM // LOGIC',
                  icon: 'hub',
                  desc: 'Deploys self-guided micro-drone triangles that harass targets, protect flank angles, and breach enemy shields.',
                  stat1: { label: 'CONTROL RANGE', val: 94, color: 'purple' as const },
                  stat2: { label: 'UTILITY', val: 90, color: 'purple' as const },
                },
                {
                  id: 'TITAN',
                  role: 'JUGGERNAUT // ARMOR',
                  icon: 'shield',
                  desc: 'Extreme reactive hull plates absorb sustained artillery, crushing opposition via continuous point-blank battery fire.',
                  stat1: { label: 'DURABILITY', val: 100, color: 'lime' as const },
                  stat2: { label: 'KNOCKBACK', val: 92, color: 'lime' as const },
                },
                {
                  id: 'REAPER',
                  role: 'SNIPER // RAILGUN',
                  icon: 'filter_center_focus',
                  desc: 'Off-screen projectile range. Pinpoint electromagnetic rail bursts that cleanly puncture nested force shields.',
                  stat1: { label: 'MAX RANGE', val: 100, color: 'pink' as const },
                  stat2: { label: 'PIERCE RATIO', val: 96, color: 'pink' as const },
                },
                {
                  id: 'PULSE',
                  role: 'DISRUPTOR // AoE',
                  icon: 'radio_button_checked',
                  desc: 'Generates continuous ionic shockwaves that disarm enemy munitions, deflect drones, and overload thrusters.',
                  stat1: { label: 'DEFLECTION', val: 94, color: 'cyan' as const },
                  stat2: { label: 'AoE RADIUS', val: 89, color: 'cyan' as const },
                },
              ]}
            >
              {(chassis) => (
                <Card
                  variant="interactive"
                  class={[
                    'p-space-lg flex flex-col justify-between',
                    {
                      'border-primary-container ring-1 ring-primary-container':
                        selectedClass() === chassis.id,
                    },
                  ]}
                  onClick={() => setSelectedClass(chassis.id)}
                >
                  <div class="flex flex-col gap-space-md">
                    <div class="flex items-center justify-between">
                      <Badge variant="default">{chassis.role}</Badge>
                      <span class="material-symbols-outlined text-primary-container text-[20px]">
                        {chassis.icon}
                      </span>
                    </div>

                    <div>
                      <h3 class="font-headline-md text-headline-md text-white font-bold">
                        {chassis.id}
                      </h3>
                      <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">
                        {chassis.desc}
                      </p>
                    </div>

                    <div class="space-y-1.5 font-label-data text-[10px]">
                      <div class="flex justify-between text-outline">
                        <span>{chassis.stat1.label}</span>
                        <span class="text-white font-mono">{chassis.stat1.val}/100</span>
                      </div>
                      <Progress value={chassis.stat1.val} color={chassis.stat1.color} />

                      <div class="flex justify-between text-outline">
                        <span>{chassis.stat2.label}</span>
                        <span class="text-white font-mono">{chassis.stat2.val}/100</span>
                      </div>
                      <Progress value={chassis.stat2.val} color={chassis.stat2.color} />
                    </div>
                  </div>

                  <Button
                    variant={selectedClass() === chassis.id ? 'default' : 'secondary'}
                    class="mt-space-md w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClass(chassis.id);
                    }}
                  >
                    {selectedClass() === chassis.id ? 'EQUIPPED' : 'EQUIP CHASSIS'}
                  </Button>
                </Card>
              )}
            </For>
          </div>
        </div>

        {/* Section Patch Notes & Raccourcis Clavier */}
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-stretch" id="patch-notes">
          <Card variant="default" class="lg:col-span-8 p-space-lg flex flex-col gap-space-md">
            <div class="flex items-center justify-between pb-space-xs">
              <div class="flex items-center gap-space-xs">
                <span class="material-symbols-outlined text-primary text-[20px]">terminal</span>
                <span class="font-headline-md text-headline-md text-white font-bold">
                  SYSTEM // PATCH 2.8.4 [HOTFIX]
                </span>
              </div>
              <span class="font-label-data text-label-data text-outline">
                TIMESTAMP: 2025.02.24_04:12_UTC
              </span>
            </div>

            <div class="flex flex-col gap-space-sm font-body-sm text-body-sm">
              <div class="flex items-start gap-space-sm p-space-sm bg-surface-container-high/40 rounded">
                <Badge variant="default">BALANCE</Badge>
                <div>
                  <p class="text-on-surface font-medium">
                    Phantom evolution branch: Phase Dash overdrive module unlocked.
                  </p>
                  <p class="text-outline text-xs mt-0.5">
                    Allows 0.8s dimensional rift bypass through hostile kinetic barrages.
                  </p>
                </div>
              </div>
              <div class="flex items-start gap-space-sm p-space-sm bg-surface-container-high/40 rounded">
                <Badge variant="secondary">TUNING</Badge>
                <div>
                  <p class="text-on-surface font-medium">
                    Striker railgun velocity adjusted +8%; Overseer recall command latency -15%.
                  </p>
                  <p class="text-outline text-xs mt-0.5">
                    Optimizes counter-play during sustained midfield dogfights.
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card variant="default" class="lg:col-span-4 p-space-lg flex flex-col justify-between gap-space-md">
            <div class="flex flex-col gap-space-xs">
              <div class="flex items-center gap-space-xs text-primary">
                <span class="material-symbols-outlined text-[18px]">keyboard</span>
                <span class="font-headline-md text-headline-md text-white font-bold">
                  KEY MAP TELEMETRY
                </span>
              </div>
              <span class="font-label-data text-label-data text-outline">
                TACTICAL CONTROL SCHEME
              </span>
            </div>

            <div class="flex flex-col gap-2 font-mono text-[11px]">
              <div class="flex items-center justify-between py-1 bg-surface-container-lowest/50 px-2 rounded">
                <span class="text-outline">THRUST / MOVE</span>
                <div class="flex gap-1">
                  <Kbd size="sm">W</Kbd>
                  <Kbd size="sm">A</Kbd>
                  <Kbd size="sm">S</Kbd>
                  <Kbd size="sm">D</Kbd>
                </div>
              </div>
              <div class="flex items-center justify-between py-1 bg-surface-container-lowest/50 px-2 rounded">
                <span class="text-outline">AIM TURRET</span>
                <span class="text-primary-fixed">MOUSE CURSOR</span>
              </div>
              <div class="flex items-center justify-between py-1 bg-surface-container-lowest/50 px-2 rounded">
                <span class="text-outline">PRIMARY FIRE</span>
                <div class="flex gap-1">
                  <Kbd size="sm">L-CLICK</Kbd>
                  <Kbd size="sm">SPACE</Kbd>
                </div>
              </div>
              <div class="flex items-center justify-between py-1 bg-surface-container-lowest/50 px-2 rounded">
                <span class="text-outline">UPGRADE MATRIX</span>
                <div class="flex gap-1">
                  <Kbd size="sm">1</Kbd>
                  <Kbd size="sm">2</Kbd>
                  <Kbd size="sm">3</Kbd>
                </div>
              </div>
            </div>

            <div class="bg-surface-container-lowest p-space-xs rounded flex items-center justify-center gap-2">
              <span class="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
              <span class="font-label-mono-caps text-[10px] text-primary">
                CONTROLLER: DETECTED (DUAL ANALOG)
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
