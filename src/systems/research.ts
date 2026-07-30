/** Meta-progression skill tree with prerequisites and meaningful bonuses. */

export type SkillId =
  | 'starting_gold'
  | 'starting_lives'
  | 'interest'
  | 'tower_discount'
  | 'ability_cdr'
  | 'crit_boost'
  | 'damage_boost'
  | 'range_boost'
  | 'build_speed'
  | 'pathfinder'
  | 'war_bonds'
  | 'fortified';

export type SkillBranch = 'economy' | 'defense' | 'offense' | 'tactics';

export interface SkillDef {
  id: SkillId;
  name: string;
  description: string;
  maxRank: number;
  costPerRank: number;
  branch: SkillBranch;
  /** Must own at least this rank in listed skills. */
  requires?: { id: SkillId; rank: number }[];
}

export const SKILL_DEFS: SkillDef[] = [
  {
    id: 'starting_gold',
    name: 'War Chest',
    description: '+45 starting gold per rank.',
    maxRank: 5,
    costPerRank: 1,
    branch: 'economy',
  },
  {
    id: 'interest',
    name: 'Merchant Guild',
    description: '+1.2% interest rate per rank.',
    maxRank: 5,
    costPerRank: 1,
    branch: 'economy',
    requires: [{ id: 'starting_gold', rank: 1 }],
  },
  {
    id: 'tower_discount',
    name: 'Bulk Contracts',
    description: 'Towers cost 3% less per rank.',
    maxRank: 5,
    costPerRank: 2,
    branch: 'economy',
    requires: [{ id: 'interest', rank: 2 }],
  },
  {
    id: 'war_bonds',
    name: 'War Bonds',
    description: '+4% kill gold and wave clear bonus per rank.',
    maxRank: 4,
    costPerRank: 2,
    branch: 'economy',
    requires: [{ id: 'tower_discount', rank: 1 }],
  },
  {
    id: 'starting_lives',
    name: 'Reinforced Bastion',
    description: '+2 starting lives per rank.',
    maxRank: 4,
    costPerRank: 2,
    branch: 'defense',
  },
  {
    id: 'fortified',
    name: 'Fortified Gate',
    description: 'Enemies deal 6% less base damage per rank.',
    maxRank: 3,
    costPerRank: 2,
    branch: 'defense',
    requires: [{ id: 'starting_lives', rank: 1 }],
  },
  {
    id: 'pathfinder',
    name: 'Pathfinder Corps',
    description: 'Barricades cost 15% less per rank.',
    maxRank: 3,
    costPerRank: 1,
    branch: 'defense',
    requires: [{ id: 'fortified', rank: 1 }],
  },
  {
    id: 'crit_boost',
    name: 'Deadeye Training',
    description: '+2% global crit chance per rank.',
    maxRank: 5,
    costPerRank: 2,
    branch: 'offense',
  },
  {
    id: 'damage_boost',
    name: 'Ordnance Doctrine',
    description: '+4% global tower damage per rank.',
    maxRank: 5,
    costPerRank: 2,
    branch: 'offense',
    requires: [{ id: 'crit_boost', rank: 1 }],
  },
  {
    id: 'range_boost',
    name: 'Spotter Nets',
    description: '+3% tower range per rank.',
    maxRank: 4,
    costPerRank: 2,
    branch: 'offense',
    requires: [{ id: 'damage_boost', rank: 1 }],
  },
  {
    id: 'ability_cdr',
    name: 'Tactical Doctrine',
    description: 'Ability cooldowns 4% shorter per rank.',
    maxRank: 5,
    costPerRank: 2,
    branch: 'tactics',
  },
  {
    id: 'build_speed',
    name: 'Rapid Deployment',
    description: 'Prepare / reinforce timers 8% shorter per rank.',
    maxRank: 3,
    costPerRank: 2,
    branch: 'tactics',
    requires: [{ id: 'ability_cdr', rank: 1 }],
  },
];

export const SKILL_BRANCHES: SkillBranch[] = ['economy', 'defense', 'offense', 'tactics'];

export const BRANCH_LABELS: Record<SkillBranch, string> = {
  economy: 'Economy',
  defense: 'Defense',
  offense: 'Offense',
  tactics: 'Tactics',
};

export interface ResearchBonuses {
  startingGold: number;
  startingLives: number;
  interestBonus: number;
  towerDiscount: number;
  abilityCdr: number;
  critBonus: number;
  damageMult: number;
  rangeMult: number;
  killGoldMult: number;
  wallDiscount: number;
  leakDamageMult: number;
  prepareMult: number;
}

export function computeBonuses(tree: Record<string, number>): ResearchBonuses {
  const rank = (id: SkillId) => tree[id] ?? 0;
  return {
    startingGold: rank('starting_gold') * 45,
    startingLives: rank('starting_lives') * 2,
    interestBonus: rank('interest') * 0.012,
    towerDiscount: rank('tower_discount') * 0.03,
    abilityCdr: rank('ability_cdr') * 0.04,
    critBonus: rank('crit_boost') * 0.02,
    damageMult: 1 + rank('damage_boost') * 0.04,
    rangeMult: 1 + rank('range_boost') * 0.03,
    killGoldMult: 1 + rank('war_bonds') * 0.04,
    wallDiscount: rank('pathfinder') * 0.15,
    leakDamageMult: Math.max(0.55, 1 - rank('fortified') * 0.06),
    prepareMult: Math.max(0.6, 1 - rank('build_speed') * 0.08),
  };
}

/** Prestige passive bonuses (always on, stack with research). */
export function prestigeBonuses(level: number): {
  startingGold: number;
  researchPointBonus: number;
  interestBonus: number;
  damageMult: number;
} {
  return {
    startingGold: level * 40,
    researchPointBonus: Math.floor(level / 2),
    interestBonus: level * 0.005,
    damageMult: 1 + level * 0.015,
  };
}

export function skillUnlocked(tree: Record<string, number>, def: SkillDef): boolean {
  if (!def.requires?.length) return true;
  return def.requires.every((r) => (tree[r.id] ?? 0) >= r.rank);
}

export function tryPurchaseSkill(
  tree: Record<string, number>,
  points: number,
  id: SkillId,
): { tree: Record<string, number>; points: number; ok: boolean; reason?: string } {
  const def = SKILL_DEFS.find((s) => s.id === id);
  if (!def) return { tree, points, ok: false, reason: 'Unknown skill' };
  if (!skillUnlocked(tree, def)) return { tree, points, ok: false, reason: 'Prerequisites missing' };
  const current = tree[id] ?? 0;
  if (current >= def.maxRank) return { tree, points, ok: false, reason: 'Max rank' };
  if (points < def.costPerRank) return { tree, points, ok: false, reason: 'Not enough RP' };
  return {
    tree: { ...tree, [id]: current + 1 },
    points: points - def.costPerRank,
    ok: true,
  };
}

/** Soft-reset tree for prestige: refund half spent RP as bonus, clear ranks. */
export function prestigeResetTree(
  tree: Record<string, number>,
): { tree: Record<string, number>; refundRp: number } {
  let spent = 0;
  for (const def of SKILL_DEFS) {
    const r = tree[def.id] ?? 0;
    spent += r * def.costPerRank;
  }
  return { tree: {}, refundRp: Math.floor(spent * 0.5) };
}
