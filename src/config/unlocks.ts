import { TowerType } from './towers';

/** Towers available from the first run. */
export const STARTER_TOWERS: TowerType[] = ['arrow', 'cannon', 'wall'];

export interface TowerUnlockRule {
  type: TowerType;
  /** Lifetime highest wave required (campaign progress). */
  wave?: number;
  /** Prestige level required. */
  prestige?: number;
  hint: string;
}

/** Campaign unlock thresholds for non-starter towers. */
export const TOWER_UNLOCK_RULES: TowerUnlockRule[] = [
  { type: 'magic', wave: 5, hint: 'Reach wave 5' },
  { type: 'freeze', wave: 8, hint: 'Reach wave 8' },
  { type: 'poison', wave: 12, hint: 'Reach wave 12' },
  { type: 'sniper', wave: 15, hint: 'Reach wave 15' },
  { type: 'tesla', wave: 20, hint: 'Reach wave 20' },
  { type: 'rocket', wave: 25, hint: 'Reach wave 25' },
  { type: 'laser', wave: 30, hint: 'Reach wave 30' },
];

export function defaultUnlockedTowers(): TowerType[] {
  return [...STARTER_TOWERS];
}
