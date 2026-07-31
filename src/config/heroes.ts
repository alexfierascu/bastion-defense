/** Hero definitions — framework for The Warden and future heroes. */

export type HeroId = 'warden';

export type HeroAbilityId = 'shieldWall' | 'rally' | 'lastStand';

export type HeroTalentId =
  | 'range'
  | 'attackSpeed'
  | 'crit'
  | 'moveSpeed'
  | 'abilityDuration';

export interface HeroAbilityDef {
  id: HeroAbilityId;
  name: string;
  description: string;
  cooldown: number;
  duration?: number;
  /** Hotkey hint (matches KeyBindings ability4/5/6). */
  hotkey: 'ability4' | 'ability5' | 'ability6';
}

export interface HeroTalentDef {
  id: HeroTalentId;
  name: string;
  description: string;
}

export interface HeroDef {
  id: HeroId;
  name: string;
  title: string;
  description: string;
  color: string;
  accent: string;
  portrait: string;
  /** Base stats at level 1. */
  hp: number;
  armor: number;
  damage: number;
  attackSpeed: number;
  moveSpeed: number;
  attackRange: number;
  critChance: number;
  radius: number;
  /** Per-level growth. */
  hpPerLevel: number;
  damagePerLevel: number;
  armorPerLevel: number;
  abilities: HeroAbilityDef[];
}

export const HERO_TALENTS: Record<HeroTalentId, HeroTalentDef> = {
  range: { id: 'range', name: 'Long Arm', description: '+10% Attack Range' },
  attackSpeed: { id: 'attackSpeed', name: 'Quick Hands', description: '+15% Attack Speed' },
  crit: { id: 'crit', name: 'Keen Edge', description: '+20% Critical Chance' },
  moveSpeed: { id: 'moveSpeed', name: 'Fleet Foot', description: '+10% Movement Speed' },
  abilityDuration: {
    id: 'abilityDuration',
    name: 'Enduring Will',
    description: '+15% Ability Duration',
  },
};

/** Talent tiers unlock at levels 3, 6, 9 — pick one per tier. */
export const HERO_TALENT_TIERS: { level: number; options: HeroTalentId[] }[] = [
  { level: 3, options: ['range', 'attackSpeed'] },
  { level: 6, options: ['crit', 'moveSpeed'] },
  { level: 9, options: ['abilityDuration', 'attackSpeed'] },
];

export const HERO_LEVEL_CAP = 10;
export const HERO_RESPAWN_SEC = 20;
export const HERO_XP_PER_KILL = 8;
export const HERO_XP_PER_WAVE = 25;
export const HERO_XP_PER_BOSS = 80;

export function xpToNextLevel(level: number): number {
  return Math.round(40 + level * 35 + level * level * 4);
}

export const HERO_DEFS: Record<HeroId, HeroDef> = {
  warden: {
    id: 'warden',
    name: 'The Warden',
    title: 'Bastion Guardian',
    description: 'A steadfast defender who buffs towers and holds the line.',
    color: '#3a4a5a',
    accent: '#c4a050',
    portrait: '🛡',
    hp: 420,
    armor: 6,
    damage: 28,
    attackSpeed: 1.15,
    moveSpeed: 110,
    attackRange: 130,
    critChance: 0.08,
    radius: 14,
    hpPerLevel: 35,
    damagePerLevel: 4,
    armorPerLevel: 0.6,
    abilities: [
      {
        id: 'shieldWall',
        name: 'Shield Wall',
        description: 'Nearby towers gain +20% attack speed for 8s.',
        cooldown: 25,
        duration: 8,
        hotkey: 'ability4',
      },
      {
        id: 'rally',
        name: 'Rally',
        description: 'Nearby towers instantly reload and fire an empowered shot.',
        cooldown: 45,
        hotkey: 'ability5',
      },
      {
        id: 'lastStand',
        name: 'Last Stand',
        description: '10s: double attack speed, +range, unkillable.',
        cooldown: 120,
        duration: 10,
        hotkey: 'ability6',
      },
    ],
  },
};

export const HERO_ORDER: HeroId[] = ['warden'];
