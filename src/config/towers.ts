/** Tower definitions, costs, and per-level upgrade curves. */

import { DamageType } from './combatTypes';

export type TowerType =
  | 'arrow'
  | 'cannon'
  | 'magic'
  | 'sniper'
  | 'poison'
  | 'freeze'
  | 'tesla'
  | 'laser'
  | 'rocket'
  | 'wall';

export type TargetingMode =
  | 'first'
  | 'last'
  | 'strongest'
  | 'weakest'
  | 'closest'
  | 'furthest';

export const TARGETING_MODES: TargetingMode[] = [
  'first',
  'last',
  'strongest',
  'weakest',
  'closest',
  'furthest',
];

export interface TowerLevelStats {
  damage: number;
  fireRate: number; // attacks per second
  range: number;
  splashRadius: number;
  projectileSpeed: number;
  critChance: number;
  critMultiplier: number;
  armorPen: number; // 0–1
  slowAmount: number; // 0–1
  slowDuration: number;
  dotDamage: number;
  dotDuration: number;
  chainCount: number;
  beamDps: number;
}

export interface TowerDef {
  id: TowerType;
  name: string;
  description: string;
  cost: number;
  color: string;
  accent: string;
  maxLevel: number;
  canTargetFlying: boolean;
  isBeam: boolean;
  isAoE: boolean;
  /** Path-blocking structure — no damage, placed on road tiles. */
  isWall?: boolean;
  damageType: DamageType;
  base: TowerLevelStats;
  /** Multipliers applied per upgrade level (level 1 = base). */
  perLevel: Partial<Record<keyof TowerLevelStats, number>>;
  upgradeCosts: number[];
  /** Default targeting when no saved preset exists. */
  defaultTargeting?: TargetingMode;
}

function levels(baseCost: number): number[] {
  return [
    Math.round(baseCost * 0.7),
    Math.round(baseCost * 1.1),
    Math.round(baseCost * 1.7),
    Math.round(baseCost * 2.6),
  ];
}

export const TOWER_DEFS: Record<TowerType, TowerDef> = {
  arrow: {
    id: 'arrow',
    name: 'Arrow Tower',
    description: 'Cheap physical shots. Reliable early single-target DPS.',
    cost: 50,
    color: '#6b8f4e',
    accent: '#c4e09a',
    maxLevel: 5,
    canTargetFlying: true,
    isBeam: false,
    isAoE: false,
    damageType: 'physical',
    base: {
      damage: 14,
      fireRate: 1.55,
      range: 160,
      splashRadius: 0,
      projectileSpeed: 520,
      critChance: 0.05,
      critMultiplier: 1.8,
      armorPen: 0,
      slowAmount: 0,
      slowDuration: 0,
      dotDamage: 0,
      dotDuration: 0,
      chainCount: 0,
      beamDps: 0,
    },
    perLevel: { damage: 1.28, fireRate: 1.08, range: 1.06, critChance: 1.15 },
    upgradeCosts: levels(50),
  },
  cannon: {
    id: 'cannon',
    name: 'Cannon Tower',
    description: 'Explosive splash shells. Slow but devastating to packs.',
    cost: 120,
    color: '#5a4632',
    accent: '#e0a060',
    maxLevel: 5,
    canTargetFlying: false,
    isBeam: false,
    isAoE: true,
    damageType: 'explosive',
    base: {
      damage: 45,
      fireRate: 0.55,
      range: 150,
      splashRadius: 55,
      projectileSpeed: 380,
      critChance: 0.02,
      critMultiplier: 1.5,
      armorPen: 0.15,
      slowAmount: 0,
      slowDuration: 0,
      dotDamage: 0,
      dotDuration: 0,
      chainCount: 0,
      beamDps: 0,
    },
    perLevel: { damage: 1.32, splashRadius: 1.1, range: 1.05, fireRate: 1.06 },
    upgradeCosts: levels(120),
  },
  magic: {
    id: 'magic',
    name: 'Magic Tower',
    description: 'Magic bolts ignore armor. Ideal vs armored foes.',
    cost: 100,
    color: '#5b3d8a',
    accent: '#c9a0ff',
    maxLevel: 5,
    canTargetFlying: true,
    isBeam: false,
    isAoE: false,
    damageType: 'magic',
    base: {
      damage: 26,
      fireRate: 1.0,
      range: 155,
      splashRadius: 0,
      projectileSpeed: 460,
      critChance: 0.08,
      critMultiplier: 2.0,
      armorPen: 1.0,
      slowAmount: 0,
      slowDuration: 0,
      dotDamage: 0,
      dotDuration: 0,
      chainCount: 0,
      beamDps: 0,
    },
    perLevel: { damage: 1.3, fireRate: 1.07, range: 1.06, critChance: 1.12 },
    upgradeCosts: levels(100),
  },
  sniper: {
    id: 'sniper',
    name: 'Sniper Tower',
    description: 'Long-range physical shots. Extreme reach, glacial reload.',
    cost: 160,
    color: '#2f4a5e',
    accent: '#7ec8e3',
    maxLevel: 5,
    canTargetFlying: true,
    isBeam: false,
    isAoE: false,
    damageType: 'physical',
    base: {
      damage: 95,
      fireRate: 0.35,
      range: 320,
      splashRadius: 0,
      projectileSpeed: 900,
      critChance: 0.2,
      critMultiplier: 2.5,
      armorPen: 0.35,
      slowAmount: 0,
      slowDuration: 0,
      dotDamage: 0,
      dotDuration: 0,
      chainCount: 0,
      beamDps: 0,
    },
    perLevel: { damage: 1.22, range: 1.08, critChance: 1.1, fireRate: 1.05 },
    upgradeCosts: levels(160),
  },
  poison: {
    id: 'poison',
    name: 'Poison Tower',
    description: 'Poison toxin coats foes — damage over time stacks lightly.',
    cost: 90,
    color: '#3d6b3a',
    accent: '#7dff6a',
    maxLevel: 5,
    canTargetFlying: true,
    isBeam: false,
    isAoE: false,
    damageType: 'poison',
    base: {
      damage: 6,
      fireRate: 1.2,
      range: 145,
      splashRadius: 0,
      projectileSpeed: 400,
      critChance: 0,
      critMultiplier: 1,
      armorPen: 0.2,
      slowAmount: 0,
      slowDuration: 0,
      dotDamage: 8,
      dotDuration: 4,
      chainCount: 0,
      beamDps: 0,
    },
    perLevel: { damage: 1.15, dotDamage: 1.35, dotDuration: 1.08, fireRate: 1.06, range: 1.05 },
    upgradeCosts: levels(90),
  },
  freeze: {
    id: 'freeze',
    name: 'Freeze Tower',
    description: 'Frost slows enemies in range. Soft support that enables DPS.',
    cost: 85,
    color: '#3a6a8a',
    accent: '#a8e8ff',
    maxLevel: 5,
    canTargetFlying: true,
    isBeam: false,
    isAoE: true,
    damageType: 'frost',
    base: {
      damage: 4,
      fireRate: 0.9,
      range: 140,
      splashRadius: 50,
      projectileSpeed: 360,
      critChance: 0,
      critMultiplier: 1,
      armorPen: 0,
      slowAmount: 0.42,
      slowDuration: 2.2,
      dotDamage: 0,
      dotDuration: 0,
      chainCount: 0,
      beamDps: 0,
    },
    perLevel: {
      slowAmount: 1.12,
      slowDuration: 1.1,
      splashRadius: 1.08,
      range: 1.06,
      damage: 1.2,
    },
    upgradeCosts: levels(85),
  },
  tesla: {
    id: 'tesla',
    name: 'Tesla Tower',
    description: 'Energy chain lightning leaps between nearby enemies.',
    cost: 140,
    color: '#4a5a8a',
    accent: '#ffe066',
    maxLevel: 5,
    canTargetFlying: true,
    isBeam: false,
    isAoE: false,
    damageType: 'energy',
    base: {
      damage: 28,
      fireRate: 0.85,
      range: 150,
      splashRadius: 90,
      projectileSpeed: 0,
      critChance: 0.05,
      critMultiplier: 1.6,
      armorPen: 0.25,
      slowAmount: 0,
      slowDuration: 0,
      dotDamage: 0,
      dotDuration: 0,
      chainCount: 3,
      beamDps: 0,
    },
    perLevel: { damage: 1.28, chainCount: 1.2, range: 1.05, fireRate: 1.07 },
    upgradeCosts: levels(140),
  },
  laser: {
    id: 'laser',
    name: 'Laser Tower',
    description: 'Energy beam that ramps damage while locked on.',
    cost: 150,
    color: '#8a2f3a',
    accent: '#ff4d6d',
    maxLevel: 5,
    canTargetFlying: true,
    isBeam: true,
    isAoE: false,
    damageType: 'energy',
    base: {
      damage: 0,
      fireRate: 0,
      range: 170,
      splashRadius: 0,
      projectileSpeed: 0,
      critChance: 0.03,
      critMultiplier: 1.5,
      armorPen: 0.4,
      slowAmount: 0,
      slowDuration: 0,
      dotDamage: 0,
      dotDuration: 0,
      chainCount: 0,
      beamDps: 38,
    },
    perLevel: { beamDps: 1.22, range: 1.06, armorPen: 1.08, critChance: 1.2 },
    upgradeCosts: levels(150),
  },
  rocket: {
    id: 'rocket',
    name: 'Rocket Tower',
    description: 'Explosive rockets with large blast radius.',
    cost: 180,
    color: '#6a3a2a',
    accent: '#ff8c42',
    maxLevel: 5,
    canTargetFlying: true,
    isBeam: false,
    isAoE: true,
    damageType: 'explosive',
    base: {
      damage: 60,
      fireRate: 0.45,
      range: 185,
      splashRadius: 70,
      projectileSpeed: 320,
      critChance: 0.05,
      critMultiplier: 1.7,
      armorPen: 0.1,
      slowAmount: 0,
      slowDuration: 0,
      dotDamage: 0,
      dotDuration: 0,
      chainCount: 0,
      beamDps: 0,
    },
    perLevel: { damage: 1.22, splashRadius: 1.12, range: 1.06, fireRate: 1.05 },
    upgradeCosts: levels(180),
  },
  wall: {
    id: 'wall',
    name: 'Barricade',
    description: 'Blocks the road and forces ground enemies to repath. No damage.',
    cost: 30,
    color: '#5a5348',
    accent: '#c4b89a',
    maxLevel: 1,
    canTargetFlying: false,
    isBeam: false,
    isAoE: false,
    isWall: true,
    damageType: 'physical',
    base: {
      damage: 0,
      fireRate: 0,
      range: 0,
      splashRadius: 0,
      projectileSpeed: 0,
      critChance: 0,
      critMultiplier: 1,
      armorPen: 0,
      slowAmount: 0,
      slowDuration: 0,
      dotDamage: 0,
      dotDuration: 0,
      chainCount: 0,
      beamDps: 0,
    },
    perLevel: {},
    upgradeCosts: [],
  },
};

export function getTowerStats(type: TowerType, level: number): TowerLevelStats {
  const def = TOWER_DEFS[type];
  const stats = { ...def.base };
  const lv = Math.max(1, Math.min(level, def.maxLevel));
  for (let i = 1; i < lv; i++) {
    for (const key of Object.keys(def.perLevel) as (keyof TowerLevelStats)[]) {
      const mult = def.perLevel[key];
      if (mult !== undefined) {
        if (key === 'chainCount') {
          stats[key] = Math.round(stats[key] * mult);
        } else {
          stats[key] = stats[key] * mult;
        }
      }
    }
  }
  return stats;
}

export function getUpgradeCost(type: TowerType, currentLevel: number): number | null {
  const def = TOWER_DEFS[type];
  if (currentLevel >= def.maxLevel) return null;
  return def.upgradeCosts[currentLevel - 1] ?? null;
}

export const TOWER_ORDER: TowerType[] = [
  'arrow',
  'cannon',
  'magic',
  'sniper',
  'poison',
  'freeze',
  'tesla',
  'laser',
  'rocket',
  'wall',
];

export function isWallType(type: TowerType): boolean {
  return !!TOWER_DEFS[type].isWall;
}

export const TARGETING_LABELS: Record<TargetingMode, string> = {
  first: 'First',
  last: 'Last',
  strongest: 'Strongest',
  weakest: 'Weakest',
  closest: 'Closest',
  furthest: 'Furthest',
};
