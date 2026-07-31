/**
 * Branching Tier 2 / Tier 3 upgrades — meaningful tradeoffs, not flat +stats.
 * Tier 1 → choose path A or B. Tier 2 → deepen that path to Tier 3.
 */

import type { TowerLevelStats, TowerType } from './towers';

export type UpgradePath = 'a' | 'b';

export interface UpgradeChoice {
  path: UpgradePath;
  name: string;
  /** Short tradeoff line shown in UI */
  tagline: string;
  cost: number;
  /** Multipliers applied to base stats for this tier step (stacked across tiers). */
  mult: Partial<Record<keyof TowerLevelStats, number>>;
}

export interface TowerBranches {
  t2: [UpgradeChoice, UpgradeChoice];
  t3: { a: UpgradeChoice; b: UpgradeChoice };
}

function choice(
  path: UpgradePath,
  name: string,
  tagline: string,
  cost: number,
  mult: Partial<Record<keyof TowerLevelStats, number>>,
): UpgradeChoice {
  return { path, name, tagline, cost, mult };
}

export const UPGRADE_BRANCHES: Partial<Record<TowerType, TowerBranches>> = {
  arrow: {
    t2: [
      choice('a', 'Longbow', '+Range · +Armor Pen · −Rate', 40, {
        range: 1.48,
        fireRate: 0.72,
        damage: 1.18,
        projectileSpeed: 1.15,
        armorPen: 1,
      }),
      choice('b', 'Rapid Fire', '+Rate · Multi-Target · −Damage', 40, {
        fireRate: 1.55,
        damage: 0.72,
        range: 0.95,
        critChance: 1.2,
      }),
    ],
    t3: {
      a: choice('a', 'Piercing Shot', '+Armor pen · +Damage', 65, {
        damage: 1.35,
        range: 1.12,
        critMultiplier: 1.15,
        armorPen: 1.2,
      }),
      b: choice('b', 'Barrage', '+Targets · +Rate', 65, {
        fireRate: 1.35,
        critChance: 2.0,
        damage: 1.08,
        range: 1.05,
      }),
    },
  },
  cannon: {
    t2: [
      choice('a', 'Mortar', 'Arcing shells · +Splash · −Rate', 85, {
        damage: 1.35,
        splashRadius: 1.45,
        fireRate: 0.65,
        range: 1.35,
        projectileSpeed: 0.75,
        armorPen: 1.3,
      }),
      choice('b', 'Shrapnel', '+Splash fragments · +Rate · −Damage', 85, {
        splashRadius: 1.65,
        damage: 0.78,
        fireRate: 1.25,
        range: 1.05,
      }),
    ],
    t3: {
      a: choice('a', 'Siege Mortar', '+Range · +Damage', 130, {
        damage: 1.4,
        armorPen: 1.35,
        splashRadius: 1.2,
        range: 1.15,
      }),
      b: choice('b', 'Fragment Storm', '+Splash · +Rate', 130, {
        splashRadius: 1.4,
        fireRate: 1.25,
        damage: 1.12,
      }),
    },
  },
  ballista: {
    t2: [
      choice('a', 'Armor Piercer', '+Pen · +Damage · −Rate', 75, {
        damage: 1.4,
        armorPen: 1.8,
        fireRate: 0.75,
        range: 1.1,
        projectileSpeed: 1.15,
      }),
      choice('b', 'Chain Bolt', 'Chains between foes · −Damage', 75, {
        damage: 0.85,
        fireRate: 1.1,
        chainCount: 3,
        splashRadius: 1,
        range: 1.05,
      }),
    ],
    t3: {
      a: choice('a', 'Sunder Bolt', '+Pen · +Crit', 120, {
        damage: 1.35,
        armorPen: 1.4,
        critChance: 1.5,
        critMultiplier: 1.2,
      }),
      b: choice('b', 'Storm Latch', '+Chains · +Rate', 120, {
        chainCount: 1.4,
        fireRate: 1.25,
        damage: 1.15,
        range: 1.1,
      }),
    },
  },
  support: {
    t2: [
      choice('a', 'Healing Banner', 'Gate regen aura · soft shots', 70, {
        range: 1.25,
        fireRate: 1.1,
        damage: 0.9,
      }),
      choice('b', 'War Banner', 'Tower AS aura · −Damage', 70, {
        range: 1.2,
        fireRate: 1.15,
        damage: 0.75,
      }),
    ],
    t3: {
      a: choice('a', 'Bastion Hymn', '+Range · stronger regen', 110, {
        range: 1.2,
        fireRate: 1.15,
        damage: 1.2,
      }),
      b: choice('b', 'War Chorus', '+Aura range · +Haste', 110, {
        range: 1.25,
        fireRate: 1.2,
        damage: 1.1,
      }),
    },
  },
  magic: {
    t2: [
      choice('a', 'Arcane Bolt', '+Damage · −Rate', 70, {
        damage: 1.42,
        fireRate: 0.8,
        critChance: 1.25,
      }),
      choice('b', 'Mana Surge', '+Rate · +Range', 70, {
        fireRate: 1.42,
        range: 1.18,
        damage: 0.88,
      }),
    ],
    t3: {
      a: choice('a', 'Void Spike', '+Crit · +Damage', 110, {
        damage: 1.35,
        critChance: 1.4,
        critMultiplier: 1.2,
      }),
      b: choice('b', 'Flux', '+Rate · +Pen', 110, {
        fireRate: 1.3,
        armorPen: 1,
        range: 1.1,
        damage: 1.1,
      }),
    },
  },
  sniper: {
    t2: [
      choice('a', 'Marksman', '+Range · +Crit', 110, {
        range: 1.28,
        critChance: 1.45,
        fireRate: 0.85,
        damage: 1.15,
      }),
      choice('b', 'Anti-Materiel', '+Damage · −Rate', 110, {
        damage: 1.5,
        armorPen: 1.5,
        fireRate: 0.7,
        range: 1.05,
      }),
    ],
    t3: {
      a: choice('a', 'Deadeye', '+Crit mult · +Range', 160, {
        critMultiplier: 1.25,
        range: 1.15,
        critChance: 1.25,
        damage: 1.15,
      }),
      b: choice('b', 'Railshot', '+Damage · +Pen', 160, {
        damage: 1.4,
        armorPen: 1.35,
        projectileSpeed: 1.2,
      }),
    },
  },
  poison: {
    t2: [
      choice('a', 'Venom Sac', '+DoT · −Rate', 60, {
        dotDamage: 1.55,
        dotDuration: 1.25,
        fireRate: 0.8,
        damage: 1.1,
      }),
      choice('b', 'Miasma', '+Splash toxin · −DoT', 60, {
        dotDamage: 0.85,
        fireRate: 1.15,
        range: 1.1,
      }),
    ],
    t3: {
      a: choice('a', 'Neurotoxin', '+DoT · +Slow', 95, {
        dotDamage: 1.4,
        damage: 1.15,
      }),
      b: choice('b', 'Plague Cloud', '+AoE · +Rate', 95, {
        splashRadius: 1.4,
        fireRate: 1.25,
        range: 1.12,
        dotDamage: 1.15,
      }),
    },
  },
  freeze: {
    t2: [
      choice('a', 'Glacier', '+Slow · −Rate', 55, {
        slowAmount: 1.35,
        slowDuration: 1.3,
        splashRadius: 1.15,
        fireRate: 0.75,
      }),
      choice('b', 'Hail', '+Rate · +Range', 55, {
        fireRate: 1.4,
        range: 1.2,
        slowAmount: 0.85,
        damage: 1.25,
      }),
    ],
    t3: {
      a: choice('a', 'Permafrost', '+Slow · +Splash', 90, {
        slowAmount: 1.25,
        splashRadius: 1.25,
        slowDuration: 1.2,
      }),
      b: choice('b', 'Blizzard', '+Rate · +Damage', 90, {
        fireRate: 1.3,
        damage: 1.5,
        range: 1.1,
        splashRadius: 1.1,
      }),
    },
  },
  tesla: {
    t2: [
      choice('a', 'Storm Coil', '+Chains · −Rate', 95, {
        chainCount: 1.5,
        damage: 1.2,
        fireRate: 0.8,
        splashRadius: 1.15,
      }),
      choice('b', 'Arc Capacitor', '+Rate · +Damage', 95, {
        fireRate: 1.4,
        damage: 1.25,
        chainCount: 0.85,
      }),
    ],
    t3: {
      a: choice('a', 'Thunderhead', '+Chains · +Range', 145, {
        chainCount: 1.4,
        range: 1.15,
        damage: 1.2,
      }),
      b: choice('b', 'Overcharge', '+Damage · +Crit', 145, {
        damage: 1.4,
        critChance: 2,
        fireRate: 1.15,
      }),
    },
  },
  laser: {
    t2: [
      choice('a', 'Focus Lens', '+Beam · −Range', 100, {
        beamDps: 1.45,
        range: 0.88,
        armorPen: 1.2,
      }),
      choice('b', 'Wide Beam', '+Range · −Beam', 100, {
        range: 1.35,
        beamDps: 0.85,
        critChance: 1.5,
      }),
    ],
    t3: {
      a: choice('a', 'Incinerator', '+Beam · +Pen', 150, {
        beamDps: 1.4,
        armorPen: 1.3,
        critChance: 1.3,
      }),
      b: choice('b', 'Sweep Array', '+Range · +Beam', 150, {
        range: 1.2,
        beamDps: 1.25,
        critChance: 1.2,
      }),
    },
  },
  rocket: {
    t2: [
      choice('a', 'Warhead', '+Damage · −Rate', 120, {
        damage: 1.45,
        splashRadius: 1.15,
        fireRate: 0.75,
      }),
      choice('b', 'Swarm Pods', '+Rate · +Splash', 120, {
        fireRate: 1.4,
        splashRadius: 1.3,
        damage: 0.8,
      }),
    ],
    t3: {
      a: choice('a', 'Thermite', '+Damage · +Splash', 180, {
        damage: 1.35,
        splashRadius: 1.25,
        armorPen: 1.4,
      }),
      b: choice('b', 'Saturation', '+Rate · +Range', 180, {
        fireRate: 1.3,
        range: 1.18,
        splashRadius: 1.15,
        damage: 1.1,
      }),
    },
  },
};

/** Additive flat bonuses applied after multipliers (armor pen, splash seed, slow). */
export const BRANCH_FLAT: Partial<
  Record<TowerType, Partial<Record<UpgradePath, Partial<Record<keyof TowerLevelStats, number>>>>>
> = {
  arrow: {
    a: { armorPen: 0.35 },
  },
  ballista: {
    a: { armorPen: 0.25 },
    b: { splashRadius: 95, chainCount: 3 },
  },
  cannon: {
    a: { splashRadius: 12 },
    b: { splashRadius: 18 },
  },
  poison: {
    a: { slowAmount: 0.25, slowDuration: 1.5 },
    b: { splashRadius: 40 },
  },
  magic: {
    b: { armorPen: 0 },
  },
};

export function getUpgradeChoices(
  type: TowerType,
  level: number,
  path: UpgradePath | null,
): UpgradeChoice[] {
  const b = UPGRADE_BRANCHES[type];
  if (!b) return [];
  if (level === 1) return [...b.t2];
  if (level === 2 && path) return [b.t3[path]];
  return [];
}

export function getBranchName(type: TowerType, path: UpgradePath | null, level: number): string {
  if (!path || level < 2) return '';
  const b = UPGRADE_BRANCHES[type];
  if (!b) return '';
  if (level >= 3) return b.t3[path].name;
  return b.t2[path === 'a' ? 0 : 1]!.name;
}
