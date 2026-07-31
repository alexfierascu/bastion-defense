/** Unlockable path themes and tower skins. */

import { ART_STYLES, ArtStyleId } from './artThemes';

export type PathThemeId = 'ironwood' | 'crimson' | 'frost' | 'ash';
export type TowerSkinId = 'default' | 'bronze' | 'ghost';

export interface PathTheme {
  id: PathThemeId;
  name: string;
  description: string;
  unlockPrestige?: number;
  unlockAchievement?: string;
  tiles: {
    grass: [string, string];
    road: [string, string];
    buildable: [string, string];
    water: [string, string];
  };
}

export interface TowerSkin {
  id: TowerSkinId;
  name: string;
  description: string;
  unlockPrestige?: number;
  unlockAchievement?: string;
  /** Multiplies accent brightness conceptually; renderer uses tint overlay. */
  tint: string | null;
}

export const PATH_THEMES: Record<PathThemeId, PathTheme> = {
  ironwood: {
    id: 'ironwood',
    name: 'Ironwood',
    description: 'Mossy clearings and warm timber roads.',
    tiles: {
      grass: ['#3d6b3a', '#4a7a45'],
      road: ['#8b7355', '#9a8464'],
      buildable: ['#457848', '#528a55'],
      water: ['#3a7a8e', '#4a8fa4'],
    },
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson March',
    description: 'Blood-dust fields and brick causeways.',
    unlockPrestige: 1,
    tiles: {
      grass: ['#4a3530', '#5a4238'],
      road: ['#6a4038', '#7a5048'],
      buildable: ['#5a3838', '#6a4848'],
      water: ['#2a3850', '#354860'],
    },
  },
  frost: {
    id: 'frost',
    name: 'Frostveil',
    description: 'Pale tundra and iced paths.',
    unlockAchievement: 'frostbite',
    tiles: {
      grass: ['#3a4a4e', '#4a5a5e'],
      road: ['#6a7080', '#7a8090'],
      buildable: ['#3e5558', '#4e6568'],
      water: ['#2a4a68', '#356080'],
    },
  },
  ash: {
    id: 'ash',
    name: 'Ashen Wastes',
    description: 'Charred ground and slag roads.',
    unlockPrestige: 3,
    tiles: {
      grass: ['#3a3834', '#4a4640'],
      road: ['#555048', '#656058'],
      buildable: ['#424038', '#524e46'],
      water: ['#243038', '#304048'],
    },
  },
};

export const TOWER_SKINS: Record<TowerSkinId, TowerSkin> = {
  default: {
    id: 'default',
    name: 'Standard Issue',
    description: 'Default tower finish.',
    tint: null,
  },
  bronze: {
    id: 'bronze',
    name: 'Bronze Livery',
    description: 'Warm bronze trim on all towers.',
    unlockPrestige: 2,
    tint: 'rgba(196,163,90,0.28)',
  },
  ghost: {
    id: 'ghost',
    name: 'Ghost Protocol',
    description: 'Pale spectral plating.',
    unlockAchievement: 'untouchable',
    tint: 'rgba(180,220,255,0.22)',
  },
};

export const PATH_THEME_ORDER: PathThemeId[] = ['ironwood', 'crimson', 'frost', 'ash'];
export const TOWER_SKIN_ORDER: TowerSkinId[] = ['default', 'bronze', 'ghost'];

/** Human-readable name for any cosmetic id ('art:<style>', tower skin, or path theme). */
export function cosmeticDisplayName(id: string): string {
  if (id.startsWith('art:')) {
    return ART_STYLES[id.slice(4) as ArtStyleId]?.name ?? id;
  }
  return (
    TOWER_SKINS[id as TowerSkinId]?.name ??
    PATH_THEMES[id as PathThemeId]?.name ??
    id
  );
}
