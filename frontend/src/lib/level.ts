// XP earned per action, following the diep-style progression. Shared by the
// leaderboard and the profile page so both compute the same XP and level.
export const XP_PER_KILL = 5;
export const XP_PER_SHAPE = 1;

export const pilotXp = (pilot: { kills: number; shapes: number }) =>
  pilot.kills * XP_PER_KILL + pilot.shapes * XP_PER_SHAPE;

// Total XP needed to reach a level: 0, 100, 400, 900, … (100 × (level − 1)²).
export const XP_LEVEL_FACTOR = 100;

export const xpForLevel = (level: number) => XP_LEVEL_FACTOR * (level - 1) ** 2;

export type LevelProgress = {
  level: number;
  next: number;
  /** XP earned since the current level was reached. */
  current: number;
  /** XP the current level spans, up to the next one. */
  span: number;
  remaining: number;
  /** Percentage towards the next level, from 0 to 100. */
  progress: number;
};

export function levelProgress(xp: number): LevelProgress {
  const total = Math.max(0, Math.floor(xp));
  const level = Math.floor(Math.sqrt(total / XP_LEVEL_FACTOR)) + 1;
  const floor = xpForLevel(level);
  const span = xpForLevel(level + 1) - floor;
  const current = total - floor;
  return {
    level,
    next: level + 1,
    current,
    span,
    remaining: span - current,
    progress: Math.floor((current / span) * 10_000) / 100,
  };
}
