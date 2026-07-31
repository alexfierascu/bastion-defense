/**
 * Modular enemy ability definitions — composition over inheritance.
 * Handlers live in systems/enemyAbilities.ts (registry map, no giant switch).
 */

export type EnemyAbilityId =
  | 'shield'
  | 'regeneration'
  | 'charge'
  | 'splitOnDeath'
  | 'poison'
  | 'freeze'
  | 'armorAura'
  | 'healingAura'
  | 'teleport'
  | 'enrage';

export interface EnemyAbilityDef {
  id: EnemyAbilityId;
  name: string;
  description: string;
  /** Short HUD / kill-feed glyph. */
  icon: string;
  /** Particle accent. */
  color: string;
  sound: string;
}

export const ENEMY_ABILITY_DEFS: Record<EnemyAbilityId, EnemyAbilityDef> = {
  shield: {
    id: 'shield',
    name: 'Shield',
    description: 'Absorbs damage before HP.',
    icon: '🛡',
    color: '#8ec8ff',
    sound: 'hit',
  },
  regeneration: {
    id: 'regeneration',
    name: 'Regeneration',
    description: 'Steadily recovers HP.',
    icon: '💚',
    color: '#5dcc6a',
    sound: 'upgrade',
  },
  charge: {
    id: 'charge',
    name: 'Charge',
    description: 'Bursts forward along the path.',
    icon: '⚡',
    color: '#ffcc44',
    sound: 'attack_arrow',
  },
  splitOnDeath: {
    id: 'splitOnDeath',
    name: 'Split',
    description: 'Spawns lesser foes on death.',
    icon: '✴',
    color: '#c9a0ff',
    sound: 'death',
  },
  poison: {
    id: 'poison',
    name: 'Poison Cloud',
    description: 'Leaves a toxic trail that damages the gate.',
    icon: '☠',
    color: '#7dff6a',
    sound: 'attack_poison',
  },
  freeze: {
    id: 'freeze',
    name: 'Frost Aura',
    description: 'Slows nearby tower fire rates.',
    icon: '❄',
    color: '#a8e8ff',
    sound: 'attack_freeze',
  },
  armorAura: {
    id: 'armorAura',
    name: 'Armor Aura',
    description: 'Hardens nearby allies.',
    icon: '🔰',
    color: '#c4a050',
    sound: 'upgrade',
  },
  healingAura: {
    id: 'healingAura',
    name: 'Healing Aura',
    description: 'Heals nearby allies.',
    icon: '✚',
    color: '#6dff9a',
    sound: 'upgrade',
  },
  teleport: {
    id: 'teleport',
    name: 'Teleport',
    description: 'Blinks forward when threatened.',
    icon: '◎',
    color: '#b48cff',
    sound: 'emp',
  },
  enrage: {
    id: 'enrage',
    name: 'Enrage',
    description: 'Surges in speed and fury at low HP.',
    icon: '🔥',
    color: '#ff4422',
    sound: 'explosion',
  },
};

/** Default ability kits attached by enemy role / type. */
export const ROLE_ABILITY_KITS: Partial<Record<string, EnemyAbilityId[]>> = {
  shieldBearer: ['shield'],
  berserker: ['enrage'],
  healer: ['healingAura', 'regeneration'],
  banner: ['armorAura'],
  siege: ['charge'],
  scout: ['teleport'],
  brute: ['regeneration'],
  raider: ['charge'],
  flying: [],
  invisible: ['teleport'],
  miniboss: ['shield', 'enrage', 'healingAura'],
  boss: ['shield', 'regeneration', 'enrage', 'armorAura'],
  siegeGolem: ['shield', 'regeneration', 'enrage'],
};

/** Affix → ability mapping (endless modifiers). */
export const MODIFIER_ABILITIES: Partial<Record<string, EnemyAbilityId>> = {
  regenerating: 'regeneration',
  shielded: 'shield',
  armored: 'armorAura',
  explosive: 'splitOnDeath',
};
