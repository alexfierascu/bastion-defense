/** Enemy archetypes, roles, and scaling helpers. */

import { DamageType } from './combatTypes';

export type EnemyType =
  | 'scout'
  | 'raider'
  | 'brute'
  | 'shieldBearer'
  | 'berserker'
  | 'healer'
  | 'banner'
  | 'siege'
  | 'flying'
  | 'invisible'
  | 'miniboss'
  | 'boss'
  | 'siegeGolem'
  /** @deprecated Legacy aliases — map to new roles for any leftover callers. */
  | 'basic'
  | 'fast'
  | 'tank'
  | 'armored'
  | 'regenerating'
  | 'shielded';

export type EnemyRole =
  | 'scout'
  | 'raider'
  | 'brute'
  | 'shieldBearer'
  | 'berserker'
  | 'healer'
  | 'banner'
  | 'siege'
  | 'flying'
  | 'stealth'
  | 'boss';

export interface EnemyDef {
  id: EnemyType;
  name: string;
  description: string;
  role: EnemyRole;
  hp: number;
  armor: number;
  speed: number;
  reward: number;
  radius: number;
  color: string;
  accent: string;
  /** Selection ring / identity color. */
  selectColor: string;
  flying: boolean;
  invisible: boolean;
  regenerates: boolean;
  regenRate: number;
  shield: number;
  isBoss: boolean;
  damageToBase: number;
  resistances: Partial<Record<DamageType, number>>;
  /** Front-facing damage block (Shield Bearer). */
  directionalShield?: boolean;
  /** Speed surge under 40% HP. */
  berserk?: boolean;
  /** Periodic heal aura. */
  healsAura?: boolean;
  /** Speed + resist aura. */
  bannerAura?: boolean;
  /** Siege: resists slows, high gate threat. */
  siege?: boolean;
  /** Support units pace behind the pack. */
  supportPace?: boolean;
  /** Death dissolve duration bias. */
  deathStyle?: 'pop' | 'crumble' | 'fade' | 'burst';
}

/** Resolve legacy type ids to canonical defs. */
export function canonicalEnemyType(type: EnemyType): EnemyType {
  switch (type) {
    case 'basic':
      return 'raider';
    case 'fast':
      return 'scout';
    case 'tank':
      return 'brute';
    case 'armored':
      return 'shieldBearer';
    case 'regenerating':
      return 'healer';
    case 'shielded':
      return 'shieldBearer';
    default:
      return type;
  }
}

const CORE_DEFS: Record<
  Exclude<EnemyType, 'basic' | 'fast' | 'tank' | 'armored' | 'regenerating' | 'shielded'>,
  EnemyDef
> = {
  scout: {
    id: 'scout',
    name: 'Scout',
    description: 'Very fast, fragile. Punishes thin coverage.',
    role: 'scout',
    hp: 26,
    armor: 0,
    speed: 136,
    reward: 7,
    radius: 9,
    color: '#c45c26',
    accent: '#ffb347',
    selectColor: '#ffb347',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: { frost: 0.15 },
    deathStyle: 'pop',
  },
  raider: {
    id: 'raider',
    name: 'Raider',
    description: 'Balanced baseline infantry.',
    role: 'raider',
    hp: 42,
    armor: 0,
    speed: 72,
    reward: 8,
    radius: 12,
    color: '#7a4a28',
    accent: '#d4a574',
    selectColor: '#d4a574',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: {},
    deathStyle: 'crumble',
  },
  brute: {
    id: 'brute',
    name: 'Brute',
    description: 'Very high HP, slow. Needs focused fire.',
    role: 'brute',
    hp: 230,
    armor: 3,
    speed: 40,
    reward: 26,
    radius: 18,
    color: '#3a2a20',
    accent: '#a08060',
    selectColor: '#c09060',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 2,
    resistances: { physical: 0.15, explosive: 0.2, poison: -0.2, magic: -0.15 },
    deathStyle: 'crumble',
  },
  shieldBearer: {
    id: 'shieldBearer',
    name: 'Shield Bearer',
    description: 'Blocks frontal damage. Weak from sides and rear.',
    role: 'shieldBearer',
    hp: 85,
    armor: 4,
    speed: 52,
    reward: 16,
    radius: 14,
    color: '#4a5a6a',
    accent: '#8ec8ff',
    selectColor: '#8ec8ff',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: { physical: 0.1, magic: -0.25, energy: -0.1 },
    directionalShield: true,
    deathStyle: 'crumble',
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    description: 'Gains movement speed below 40% HP.',
    role: 'berserker',
    hp: 95,
    armor: 1,
    speed: 68,
    reward: 15,
    radius: 13,
    color: '#6a2020',
    accent: '#ff5533',
    selectColor: '#ff5533',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 2,
    resistances: { frost: -0.25, poison: 0.1 },
    berserk: true,
    deathStyle: 'burst',
  },
  healer: {
    id: 'healer',
    name: 'Healer',
    description: 'Heals nearby enemies. Fragile — kill first.',
    role: 'healer',
    hp: 36,
    armor: 0,
    speed: 58,
    reward: 18,
    radius: 11,
    color: '#2a5a4a',
    accent: '#6dffb0',
    selectColor: '#6dffb0',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: { poison: 0.35, magic: -0.2 },
    healsAura: true,
    supportPace: true,
    deathStyle: 'fade',
  },
  banner: {
    id: 'banner',
    name: 'Banner Carrier',
    description: 'Buffs nearby enemies with speed and resistance.',
    role: 'banner',
    hp: 48,
    armor: 1,
    speed: 55,
    reward: 20,
    radius: 12,
    color: '#5a3a6a',
    accent: '#e0a0ff',
    selectColor: '#e0a0ff',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: { magic: 0.1, energy: -0.15 },
    bannerAura: true,
    supportPace: true,
    deathStyle: 'fade',
  },
  siege: {
    id: 'siege',
    name: 'Siege Beast',
    description: 'Ignores slows. Prioritizes the Gate. Huge leak damage.',
    role: 'siege',
    hp: 380,
    armor: 10,
    speed: 28,
    reward: 40,
    radius: 22,
    color: '#2a2018',
    accent: '#d4a040',
    selectColor: '#d4a040',
    flying: false,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 40,
    isBoss: false,
    damageToBase: 6,
    resistances: {
      physical: 0.3,
      explosive: 0.25,
      frost: 0.5,
      magic: -0.3,
      energy: -0.2,
    },
    siege: true,
    deathStyle: 'burst',
  },
  flying: {
    id: 'flying',
    name: 'Wisp',
    description: 'Airborne — immune to ground-only cannons.',
    role: 'flying',
    hp: 35,
    armor: 0,
    speed: 95,
    reward: 12,
    radius: 11,
    color: '#6a8caf',
    accent: '#b8d4e8',
    selectColor: '#b8d4e8',
    flying: true,
    invisible: false,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: { energy: -0.25 },
    deathStyle: 'fade',
  },
  invisible: {
    id: 'invisible',
    name: 'Shade',
    description: 'Camouflaged. Magic, Sniper, Tesla, and Laser reveal them.',
    role: 'stealth',
    hp: 45,
    armor: 1,
    speed: 88,
    reward: 14,
    radius: 11,
    color: '#3a3a4a',
    accent: '#8a8aaa',
    selectColor: '#8a8aaa',
    flying: false,
    invisible: true,
    regenerates: false,
    regenRate: 0,
    shield: 0,
    isBoss: false,
    damageToBase: 1,
    resistances: { magic: -0.15 },
    deathStyle: 'fade',
  },
  miniboss: {
    id: 'miniboss',
    name: 'Champion',
    description: 'Elite commander. Phases: barrier, then berserk summons.',
    role: 'boss',
    hp: 800,
    armor: 8,
    speed: 48,
    reward: 80,
    radius: 22,
    color: '#6a2a4a',
    accent: '#ff6aaa',
    selectColor: '#ff6aaa',
    flying: false,
    invisible: false,
    regenerates: true,
    regenRate: 5,
    shield: 100,
    isBoss: true,
    damageToBase: 5,
    resistances: { physical: 0.2, explosive: 0.15, poison: 0.25, frost: 0.1 },
    deathStyle: 'burst',
  },
  boss: {
    id: 'boss',
    name: 'Warlord',
    description: 'Warlord. Shield phase, then freeze-immune enrage with adds.',
    role: 'boss',
    hp: 2500,
    armor: 15,
    speed: 38,
    reward: 250,
    radius: 28,
    color: '#4a1010',
    accent: '#ff4444',
    selectColor: '#ff4444',
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
    deathStyle: 'burst',
  },
  siegeGolem: {
    id: 'siegeGolem',
    name: 'Siege Golem',
    description: 'Living siege engine. Slams, hurls boulders, summons thralls, charges the gate.',
    role: 'boss',
    hp: 3200,
    armor: 18,
    speed: 34,
    reward: 280,
    radius: 32,
    color: '#4a4538',
    accent: '#d4a050',
    selectColor: '#d4a050',
    flying: false,
    invisible: false,
    regenerates: true,
    regenRate: 10,
    shield: 350,
    isBoss: true,
    damageToBase: 12,
    resistances: {
      physical: 0.3,
      explosive: 0.15,
      poison: 0.35,
      frost: 0.2,
      energy: 0.1,
      magic: -0.05,
    },
    deathStyle: 'burst',
  },
};

function alias(def: EnemyDef, id: EnemyType): EnemyDef {
  return { ...def, id };
}

export const ENEMY_DEFS: Record<EnemyType, EnemyDef> = {
  ...CORE_DEFS,
  basic: alias(CORE_DEFS.raider, 'basic'),
  fast: alias(CORE_DEFS.scout, 'fast'),
  tank: alias(CORE_DEFS.brute, 'tank'),
  armored: alias(CORE_DEFS.shieldBearer, 'armored'),
  regenerating: alias(CORE_DEFS.healer, 'regenerating'),
  shielded: alias(CORE_DEFS.shieldBearer, 'shielded'),
};

/** Canonical roster for encyclopedia / wave design (no legacy aliases). */
export const ENEMY_ROSTER: EnemyType[] = [
  'scout',
  'raider',
  'brute',
  'shieldBearer',
  'berserker',
  'healer',
  'banner',
  'siege',
  'flying',
  'invisible',
  'miniboss',
  'boss',
  'siegeGolem',
];

export interface ScaledEnemyStats {
  hp: number;
  armor: number;
  speed: number;
  reward: number;
  shield: number;
  regenRate: number;
}

/** Fair difficulty curve — roles supply identity; curve supplies pressure. */
export function scaleEnemyStats(
  type: EnemyType,
  wave: number,
  hpMult = 1,
  rewardMult = 1,
  speedMult = 1,
): ScaledEnemyStats {
  const def = ENEMY_DEFS[canonicalEnemyType(type)];
  const w = Math.max(1, wave);
  const hpScale = 1 + (w - 1) * 0.11 + Math.pow(w / 22, 1.5) * 0.3;
  const armorScale = 1 + (w - 1) * 0.035;
  const speedScale = 1 + Math.min(0.4, (w - 1) * 0.0075);
  const rewardScale = 1 + (w - 1) * 0.065;
  const endlessBoost = w > 50 ? 1 + (w - 50) * 0.06 : 1;

  return {
    hp: Math.round(def.hp * hpScale * endlessBoost * hpMult),
    armor: Math.round(def.armor * armorScale * (w > 50 ? 1.2 : 1)),
    speed: def.speed * speedScale * speedMult,
    reward: Math.round(def.reward * rewardScale * rewardMult),
    shield: Math.round(def.shield * hpScale * 0.8 * endlessBoost * hpMult),
    regenRate: def.regenRate * (1 + (w - 1) * 0.03),
  };
}

/** Facing vs attacker: front block, rear vulnerable. */
export function directionalDamageMult(
  enemyAngle: number,
  enemyX: number,
  enemyY: number,
  attackerX: number,
  attackerY: number,
): { mult: number; zone: 'front' | 'side' | 'rear' } {
  const dx = attackerX - enemyX;
  const dy = attackerY - enemyY;
  const len = Math.hypot(dx, dy) || 1;
  const fx = Math.cos(enemyAngle);
  const fy = Math.sin(enemyAngle);
  const dot = (dx / len) * fx + (dy / len) * fy;
  if (dot > 0.35) return { mult: 0.35, zone: 'front' };
  if (dot < -0.35) return { mult: 1.65, zone: 'rear' };
  return { mult: 1, zone: 'side' };
}
