/**
 * Run relics — permanent for the current run. Max 5.
 * Migrates former elite reward ids 1:1.
 */

import { TowerType } from './towers';

export const MAX_RELICS = 5;

/** Keep legacy elite reward ids so continue saves stay valid. */
export type RelicId =
  | 'arrow_damage'
  | 'global_fire_rate'
  | 'gold_burst'
  | 'gate_heal'
  | 'pierce'
  | 'projectile_speed'
  | 'cannon_damage'
  | 'freeze_slow'
  | 'sniper_crit'
  | 'tesla_chain'
  | 'royal_banner'
  | 'ancient_compass'
  | 'broken_crown'
  | 'dragon_tooth'
  | 'blessed_hammer';

/** @deprecated Use RelicId */
export type EliteRewardId = RelicId;

export interface RelicDef {
  id: RelicId;
  name: string;
  description: string;
  weight: number;
  /** Hidden until discovered (picked once). */
  obscure?: boolean;
}

export const RELIC_DEFS: Record<RelicId, RelicDef> = {
  arrow_damage: {
    id: 'arrow_damage',
    name: 'Bodkin Tips',
    description: '+20% Arrow Tower damage',
    weight: 11,
  },
  global_fire_rate: {
    id: 'global_fire_rate',
    name: 'War Drums',
    description: 'Towers attack 10% faster',
    weight: 10,
  },
  gold_burst: {
    id: 'gold_burst',
    name: 'War Chest',
    description: '+250 Gold now',
    weight: 12,
  },
  gate_heal: {
    id: 'gate_heal',
    name: 'Masons\' Bond',
    description: 'Gate heals 15%',
    weight: 10,
  },
  pierce: {
    id: 'pierce',
    name: 'Lance Point',
    description: '+1 projectile pierce',
    weight: 9,
  },
  projectile_speed: {
    id: 'projectile_speed',
    name: 'Swift Shafts',
    description: '+15% projectile speed',
    weight: 10,
  },
  cannon_damage: {
    id: 'cannon_damage',
    name: 'Powder Kegs',
    description: '+20% Cannon damage',
    weight: 9,
  },
  freeze_slow: {
    id: 'freeze_slow',
    name: 'Deep Chill',
    description: '+10% Freeze slow strength',
    weight: 8,
  },
  sniper_crit: {
    id: 'sniper_crit',
    name: 'Hawk Eye',
    description: '+8% Sniper crit chance',
    weight: 8,
  },
  tesla_chain: {
    id: 'tesla_chain',
    name: 'Arc Coil',
    description: '+1 Tesla chain jump',
    weight: 7,
  },
  royal_banner: {
    id: 'royal_banner',
    name: 'Royal Banner',
    description: '+8% kill gold · +5% tower range',
    weight: 7,
    obscure: true,
  },
  ancient_compass: {
    id: 'ancient_compass',
    name: 'Ancient Compass',
    description: '+15% damage vs bosses and elites',
    weight: 6,
    obscure: true,
  },
  broken_crown: {
    id: 'broken_crown',
    name: 'Broken Crown',
    description: 'Gate +10% max integrity',
    weight: 6,
    obscure: true,
  },
  dragon_tooth: {
    id: 'dragon_tooth',
    name: 'Dragon Tooth',
    description: '+12% Ballista and Cannon damage',
    weight: 6,
    obscure: true,
  },
  blessed_hammer: {
    id: 'blessed_hammer',
    name: 'Blessed Hammer',
    description: 'Towers cost 8% less',
    weight: 6,
    obscure: true,
  },
};

/** Alias for older imports. */
export const ELITE_REWARD_DEFS = RELIC_DEFS;
export const ELITE_REWARD_ORDER = Object.keys(RELIC_DEFS) as RelicId[];
export const RELIC_ORDER = ELITE_REWARD_ORDER;

export type RelicInstant =
  | { kind: 'gold'; amount: number }
  | { kind: 'gateHeal'; fraction: number };

export interface RelicEffects {
  typeDamage?: Partial<Record<TowerType, number>>;
  fireRateMult?: number;
  pierceBonus?: number;
  projectileSpeedMult?: number;
  freezeSlowBonus?: number;
  sniperCritBonus?: number;
  teslaChainBonus?: number;
  goldIncomeMult?: number;
  rangeMult?: number;
  gateHealthMult?: number;
  bossEliteDamageMult?: number;
  towerCostMult?: number;
  instant?: RelicInstant;
}

export type EliteRewardEffects = RelicEffects;
export type EliteInstant = RelicInstant;

export function relicEffects(id: RelicId): RelicEffects {
  switch (id) {
    case 'arrow_damage':
      return { typeDamage: { arrow: 1.2 } };
    case 'global_fire_rate':
      return { fireRateMult: 1.1 };
    case 'gold_burst':
      return { instant: { kind: 'gold', amount: 250 } };
    case 'gate_heal':
      return { instant: { kind: 'gateHeal', fraction: 0.15 } };
    case 'pierce':
      return { pierceBonus: 1 };
    case 'projectile_speed':
      return { projectileSpeedMult: 1.15 };
    case 'cannon_damage':
      return { typeDamage: { cannon: 1.2 } };
    case 'freeze_slow':
      return { freezeSlowBonus: 0.1 };
    case 'sniper_crit':
      return { sniperCritBonus: 0.08 };
    case 'tesla_chain':
      return { teslaChainBonus: 1 };
    case 'royal_banner':
      return { goldIncomeMult: 1.08, rangeMult: 1.05 };
    case 'ancient_compass':
      return { bossEliteDamageMult: 1.15 };
    case 'broken_crown':
      return { gateHealthMult: 1.1 };
    case 'dragon_tooth':
      return { typeDamage: { ballista: 1.12, cannon: 1.12 } };
    case 'blessed_hammer':
      return { towerCostMult: 0.92 };
  }
}

/** @deprecated Use relicEffects */
export function eliteRewardEffects(id: RelicId): RelicEffects {
  return relicEffects(id);
}

export function relicLabels(ids: RelicId[]): string[] {
  return ids.map((id) => RELIC_DEFS[id]?.name ?? id);
}
