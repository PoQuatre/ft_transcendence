// TEMPORAIRE : données fictives tant que le backend n'expose pas de stats de
// jeu. Les formes sont calquées sur le leaderboard (front-leaderboard).

// Le classement ELO n'est pas encore implémenté (affiché en « coming soon ») :
// la progression du pilote passe par l'expérience (XP) et son niveau.
// Comme au leaderboard, l'XP n'est pas stockée : elle se déduit des actions
// (pilotXp) et le niveau de l'XP (levelProgress), voir lib/level.ts.
export type PilotStats = {
  kills: number;
  shapes: number; // formes détruites
};

// Mêmes kills / formes que V3X_PILOT au leaderboard : 35 135 XP.
export const MOCK_STATS: PilotStats = {
  kills: 3981,
  shapes: 15_230,
};

export const formatNumber = (value: number) => value.toLocaleString('en-US');
