/**
 * Visual art styles for the game world.
 * Cozy Forest ships free; additional styles can be gated later (e.g. paid unlock).
 */

export type ArtStyleId = 'cozyForest' | 'grimDark';

export interface ArtStyle {
  id: ArtStyleId;
  name: string;
  description: string;
  /** Free for all players. */
  unlockedByDefault: boolean;
  /** Shown in settings when locked — future monetization hook. */
  premiumHint?: string;
  /** Outline color used by procedural pixel sprites. */
  outline: string;
  /** Soft ground shadow under units. */
  shadow: string;
  tiles: {
    grass: [string, string];
    road: [string, string];
    buildable: [string, string];
    water: [string, string];
    rock: [string, string];
    spawn: [string, string];
    base: [string, string];
  };
  decor: {
    trunk: string;
    leafDark: string;
    leafMid: string;
    leafLite: string;
    bush: string;
    flower: string;
    reed: string;
    pebble: string;
  };
}

export const ART_STYLES: Record<ArtStyleId, ArtStyle> = {
  cozyForest: {
    id: 'cozyForest',
    name: 'Cozy Forest',
    description: 'Warm moss, timber towers, and soft pixel wildlife.',
    unlockedByDefault: true,
    outline: '#1a2218',
    shadow: 'rgba(20, 28, 18, 0.35)',
    tiles: {
      grass: ['#3d6b3a', '#4a7a45'],
      road: ['#8b7355', '#9a8464'],
      buildable: ['#457848', '#528a55'],
      water: ['#3a7a8e', '#4a8fa4'],
      rock: ['#6a6a5e', '#7c7c70'],
      spawn: ['#a86a3a', '#c08048'],
      base: ['#5a6a58', '#6a7c68'],
    },
    decor: {
      trunk: '#5a3a22',
      leafDark: '#2f6a32',
      leafMid: '#3f8a40',
      leafLite: '#5cb85c',
      bush: '#3a7a3a',
      flower: '#e878a0',
      reed: '#6a9a48',
      pebble: '#8a8a78',
    },
  },
  grimDark: {
    id: 'grimDark',
    name: 'Grim Dark',
    description: 'Ash, iron, and cold moonlight. Unlock via campaign cosmetics.',
    unlockedByDefault: false,
    premiumHint: 'Complete Legend March to unlock',
    outline: '#0c0c10',
    shadow: 'rgba(0, 0, 0, 0.5)',
    tiles: {
      grass: ['#2a2e28', '#343a32'],
      road: ['#4a4440', '#5a524c'],
      buildable: ['#323830', '#3e463c'],
      water: ['#1a3040', '#243848'],
      rock: ['#3a3a3e', '#4a4a50'],
      spawn: ['#5a2828', '#6a3434'],
      base: ['#2a3038', '#3a4048'],
    },
    decor: {
      trunk: '#2a2018',
      leafDark: '#1e3020',
      leafMid: '#2a4030',
      leafLite: '#3a5040',
      bush: '#243428',
      flower: '#6a3040',
      reed: '#3a4a30',
      pebble: '#4a4a48',
    },
  },
};

export const ART_STYLE_ORDER: ArtStyleId[] = ['cozyForest', 'grimDark'];
export const DEFAULT_ART_STYLE: ArtStyleId = 'cozyForest';

export function isArtStyleUnlocked(
  id: ArtStyleId,
  unlockedCosmetics: string[],
): boolean {
  const style = ART_STYLES[id];
  if (!style) return false;
  if (style.unlockedByDefault) return true;
  return unlockedCosmetics.includes(`art:${id}`);
}
