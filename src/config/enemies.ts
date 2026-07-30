/** Enemy archetypes and scaling helpers. */

import { DamageType } from './combatTypes';

export type EnemyType =
  | 'basic'
  | 'fast'
  | 'tank'
  | 'flying'
  | 'invisible'
  | 'armored'
  | 'regenerating'
  | 'shielded'
  | 'miniboss'
  | 'boss';

export interface EnemyDef {
  id: EnemyType;
  name: string;
  description: string;
  hp: number;
  armor: number;
  speed: number; // pixels per second along path
  reward: number;
  radius: number;
  color: string;
  accent: string;
  flying: boolean;
  invisible: boolean;
  regenerates: boolean;
  regenRate: number; // hp/sec
  shield: number;
  isBoss: boolean;
  damageToBase: number;
  resistances: Partial<Record<DamageType, number>>;
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  basic: {
    id: 'basic',
    name: 'Grunt',
    description: 'Standard infantry. Weak alone, dangerous in numbers.',
    hp: 40,
    armor: 0,
    speed: 70,
    reward: 8,
    radius: 12,
    color: '#8b5a2b',
    accent: '#d4a574',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: {},
  },
  fast: {
    id: 'fast',
    name: 'Scout',
    description: 'Swift runners that slip past slow towers.',
    hp: 28,
    armor: 0,
    speed: 130,
    reward: 10,
    radius: 10,
    color: '#c45c26',
    accent: '#ffb347',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: {},
  },
  tank: {
    id: 'tank',
    name: 'Brute',
    description: 'Slow, high HP wall of flesh.',
    hp: 220,
    armor: 4,
    speed: 42,
    reward: 22,
    radius: 18,
    color: '#4a3728',
    accent: '#a08060',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 2,
    resistances: { explosive: 0.2 },
  },
  flying: {
    id: 'flying',
    name: 'Wisp',
    description: 'Airborne — immune to ground-only cannons.',
    hp: 35,
    armor: 0,
    speed: 95,
    reward: 12,
    radius: 11,
    color: '#6a8caf',
    accent: '#b8d4e8',
    flying: true,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: { energy: -0.25 },
  },
  invisible: {
    id: 'invisible',
    name: 'Shade',
    description: 'Camouflaged (faded on the map). Magic, Sniper, Tesla, and Laser detect them easily.',
    hp: 45,
    armor: 1,
    speed: 85,
    reward: 14,
    radius: 11,
    color: '#3a3a4a',
    accent: '#8a8aaa',
    flying: false,
    invisible: true,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: { magic: -0.15 },
  },
  armored: {
    id: 'armored',
    name: 'Knight',
    description: 'Heavy armor. Magic and armor-pen towers excel.',
    hp: 90,
    armor: 12,
    speed: 55,
    reward: 16,
    radius: 14,
    color: '#5a5a6a',
    accent: '#c0c0d0',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: { physical: 0.45, magic: -0.35 },
  },
  regenerating: {
    id: 'regenerating',
    name: 'Troll',
    description: 'Regenerates health unless finished quickly.',
    hp: 100,
    armor: 2,
    speed: 50,
    reward: 18,
    radius: 15,
    color: '#2d5a3a',
    accent: '#6dff9a',
    flying: false,
    invisible: false,
    regenerates: true,
    regenRate: 8,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: { poison: 0.4 },
  },
  shielded: {
    id: 'shielded',
    name: 'Guardian',
    description: 'Energy shield absorbs damage before HP.',
    hp: 70,
    armor: 2,
    speed: 60,
    reward: 17,
    radius: 14,
    color: '#3a5a7a',
    accent: '#66ccff',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 50,
    isBoss: false,
    damageToBase: 1,
    resistances: { energy: 0.25, explosive: -0.15 },
  },
  miniboss: {
    id: 'miniboss',
    name: 'Champion',
    description: 'Elite commander. Tough and rewarding.',
    hp: 800,
    armor: 8,
    speed: 48,
    reward: 80,
    radius: 22,
    color: '#6a2a4a',
    accent: '#ff6aaa',
    flying: false,
    invisible: false,
    regenerates: true,
    regenRate: 5,
    shield: 100,
    isBoss: true,
    damageToBase: 5,
    resistances: { physical: 0.2, explosive: 0.15, poison: 0.25, frost: 0.1 },
  },
  boss: {
    id: 'boss',
    name: 'Warlord',
    description: 'Wave boss. Bring everything.',
    hp: 2500,
    armor: 15,
    speed: 38,
    reward: 250,
    radius: 28,
    color: '#4a1010',
    accent: '#ff4444',
    flying: false,
    invisible: false,
    regenerates: true,
    regenRate: 12,
    shield: 300,
    isBoss: true,
    damageToBase: 10,
    resistances: {
      physical: 0.25,
      explosive: 0.2,
      poison: 0.3,
      frost: 0.15,
      energy: 0.1,
      magic: -0.1,
    },
  },
};

export interface ScaledEnemyStats {
  hp: number;
  armor: number;
  speed: number;
  reward: number;
  shield: number;
  regenRate: number;
}

/** Fair difficulty curve — feels challenging but not oppressive. */
export function scaleEnemyStats(
  type: EnemyType,
  wave: number,
  hpMult = 1,
  rewardMult = 1,
  speedMult = 1,
): ScaledEnemyStats {
  const def = ENEMY_DEFS[type];
  const w = Math.max(1, wave);
  const hpScale = 1 + (w - 1) * 0.12 + Math.pow(w / 20, 1.6) * 0.35;
  const armorScale = 1 + (w - 1) * 0.04;
  const speedScale = 1 + Math.min(0.45, (w - 1) * 0.008);
  const rewardScale = 1 + (w - 1) * 0.06;
  const endlessBoost = w > 50 ? 1 + (w - 50) * 0.08 : 1;

  return {
    hp: Math.round(def.hp * hpScale * endlessBoost * hpMult),
    armor: Math.round(def.armor * armorScale * (w > 50 ? 1.2 : 1)),
    speed: def.speed * speedScale * speedMult,
    reward: Math.round(def.reward * rewardScale * rewardMult),
    shield: Math.round(def.shield * hpScale * 0.8 * endlessBoost * hpMult),
    regenRate: def.regenRate * (1 + (w - 1) * 0.03),
  };
}
