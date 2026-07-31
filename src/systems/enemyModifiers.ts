/**
 * Endless enemy affixes after Wave 10.
 * Combinations are capped and filtered for fairness.
 */

import { createRng, hashString } from '../utils/math';

export type EnemyModifierId =
  | 'armored'
  | 'swift'
  | 'regenerating'
  | 'explosive'
  | 'shielded'
  | 'large';

export interface EnemyModifierDef {
  id: EnemyModifierId;
  name: string;
  /** Multipliers / flat applied at spawn. */
  hpMult: number;
  speedMult: number;
  armorFlat: number;
  shieldFlat: number;
  radiusMult: number;
  rewardMult: number;
  leakBonus: number;
  forceRegen: boolean;
  explosive: boolean;
}

export const ENEMY_MODIFIER_DEFS: Record<EnemyModifierId, EnemyModifierDef> = {
  armored: {
    id: 'armored',
    name: 'Armored',
    hpMult: 1.15,
    speedMult: 0.95,
    armorFlat: 3,
    shieldFlat: 0,
    radiusMult: 1,
    rewardMult: 1.15,
    leakBonus: 0,
    forceRegen: false,
    explosive: false,
  },
  swift: {
    id: 'swift',
    name: 'Swift',
    hpMult: 0.9,
    speedMult: 1.28,
    armorFlat: 0,
    shieldFlat: 0,
    radiusMult: 0.95,
    rewardMult: 1.1,
    leakBonus: 0,
    forceRegen: false,
    explosive: false,
  },
  regenerating: {
    id: 'regenerating',
    name: 'Regenerating',
    hpMult: 1.1,
    speedMult: 1,
    armorFlat: 0,
    shieldFlat: 0,
    radiusMult: 1,
    rewardMult: 1.2,
    leakBonus: 0,
    forceRegen: true,
    explosive: false,
  },
  explosive: {
    id: 'explosive',
    name: 'Explosive',
    hpMult: 1.05,
    speedMult: 1,
    armorFlat: 0,
    shieldFlat: 0,
    radiusMult: 1.05,
    rewardMult: 1.25,
    leakBonus: 1,
    forceRegen: false,
    explosive: true,
  },
  shielded: {
    id: 'shielded',
    name: 'Shielded',
    hpMult: 1,
    speedMult: 0.97,
    armorFlat: 0,
    shieldFlat: 40,
    radiusMult: 1,
    rewardMult: 1.15,
    leakBonus: 0,
    forceRegen: false,
    explosive: false,
  },
  large: {
    id: 'large',
    name: 'Large',
    hpMult: 1.45,
    speedMult: 0.85,
    armorFlat: 1,
    shieldFlat: 0,
    radiusMult: 1.35,
    rewardMult: 1.35,
    leakBonus: 1,
    forceRegen: false,
    explosive: false,
  },
};

const ALL_MODS = Object.keys(ENEMY_MODIFIER_DEFS) as EnemyModifierId[];

/** Banned pairs — too oppressive together. */
const BANNED_PAIRS: [EnemyModifierId, EnemyModifierId][] = [
  ['swift', 'large'],
  ['swift', 'armored'],
  ['explosive', 'large'],
  ['explosive', 'shielded'],
  ['regenerating', 'shielded'],
  ['armored', 'shielded'],
];

function isBanned(a: EnemyModifierId, b: EnemyModifierId): boolean {
  for (const [x, y] of BANNED_PAIRS) {
    if ((a === x && b === y) || (a === y && b === x)) return true;
  }
  return false;
}

/**
 * Pick 0–2 modifiers for a non-boss enemy.
 * Chance and count scale gently with wave.
 */
export function pickEnemyModifiers(
  wave: number,
  seed: string,
  spawnIndex: number,
  isBossLike: boolean,
): EnemyModifierId[] {
  if (wave < 10 || isBossLike) return [];

  const rng = createRng(hashString(`${seed}:emod:${wave}:${spawnIndex}`));
  const chance = Math.min(0.55, 0.12 + (wave - 10) * 0.018);
  if (rng() > chance) return [];

  const count = wave >= 25 && rng() < 0.35 ? 2 : 1;
  const picks: EnemyModifierId[] = [];
  const pool = [...ALL_MODS];

  for (let n = 0; n < count && pool.length > 0; n++) {
    const idx = Math.floor(rng() * pool.length);
    const id = pool.splice(idx, 1)[0]!;
    if (picks.some((p) => isBanned(p, id))) continue;
    picks.push(id);
  }
  return picks;
}

export function combineModifierStats(mods: EnemyModifierId[]): {
  hpMult: number;
  speedMult: number;
  armorFlat: number;
  shieldFlat: number;
  radiusMult: number;
  rewardMult: number;
  leakBonus: number;
  forceRegen: boolean;
  explosive: boolean;
  labels: string[];
} {
  let hpMult = 1;
  let speedMult = 1;
  let armorFlat = 0;
  let shieldFlat = 0;
  let radiusMult = 1;
  let rewardMult = 1;
  let leakBonus = 0;
  let forceRegen = false;
  let explosive = false;
  const labels: string[] = [];

  for (const id of mods) {
    const d = ENEMY_MODIFIER_DEFS[id];
    hpMult *= d.hpMult;
    speedMult *= d.speedMult;
    armorFlat += d.armorFlat;
    shieldFlat += d.shieldFlat;
    radiusMult *= d.radiusMult;
    rewardMult *= d.rewardMult;
    leakBonus += d.leakBonus;
    forceRegen = forceRegen || d.forceRegen;
    explosive = explosive || d.explosive;
    labels.push(d.name);
  }

  return {
    hpMult,
    speedMult,
    armorFlat,
    shieldFlat,
    radiusMult,
    rewardMult,
    leakBonus,
    forceRegen,
    explosive,
    labels,
  };
}
