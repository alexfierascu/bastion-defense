/**
 * Enemy factions — every run picks one. Compositions, bosses, and ability bias
 * create distinct sieges without new tower content.
 */

import { BossId } from './bosses';
import { EnemyAbilityId } from './enemyAbilities';
import { EnemyType } from './enemies';

export type FactionId = 'hollowLegion' | 'ironHorde' | 'wildTribes' | 'cultOfAsh';

export interface FactionCompBand {
  until: number;
  pool: { type: EnemyType; weight: number }[];
}

export interface FactionDef {
  id: FactionId;
  name: string;
  epithet: string;
  description: string;
  /** Accent used lightly on spawned enemies (gameplay identity, not VFX pass). */
  accent: string;
  color: string;
  /** Procedural audio cue id. */
  soundTag: string;
  bossId: BossId;
  /** Preferred elite types. */
  elitePool: EnemyType[];
  /** Ability ids weighted into mid/late packs. */
  abilityBias: EnemyAbilityId[];
  compositions: FactionCompBand[];
}

export const FACTION_ORDER: FactionId[] = [
  'hollowLegion',
  'ironHorde',
  'wildTribes',
  'cultOfAsh',
];

export const FACTION_DEFS: Record<FactionId, FactionDef> = {
  hollowLegion: {
    id: 'hollowLegion',
    name: 'The Hollow Legion',
    epithet: 'Undying Tide',
    description: 'Slow, numerous undead. Overwhelm through attrition.',
    accent: '#9ab89a',
    color: '#3a4a3a',
    soundTag: 'faction_hollow',
    bossId: 'warlord',
    elitePool: ['brute', 'healer', 'banner'],
    abilityBias: ['regeneration', 'splitOnDeath', 'poison'],
    compositions: [
      { until: 3, pool: [{ type: 'raider', weight: 100 }] },
      {
        until: 7,
        pool: [
          { type: 'raider', weight: 80 },
          { type: 'scout', weight: 20 },
        ],
      },
      {
        until: 12,
        pool: [
          { type: 'raider', weight: 55 },
          { type: 'brute', weight: 20 },
          { type: 'healer', weight: 15 },
          { type: 'scout', weight: 10 },
        ],
      },
      {
        until: 20,
        pool: [
          { type: 'raider', weight: 40 },
          { type: 'brute', weight: 18 },
          { type: 'healer', weight: 16 },
          { type: 'banner', weight: 12 },
          { type: 'invisible', weight: 8 },
          { type: 'berserker', weight: 6 },
        ],
      },
      {
        until: 9999,
        pool: [
          { type: 'raider', weight: 32 },
          { type: 'brute', weight: 16 },
          { type: 'healer', weight: 14 },
          { type: 'banner', weight: 12 },
          { type: 'invisible', weight: 10 },
          { type: 'berserker', weight: 8 },
          { type: 'siege', weight: 8 },
        ],
      },
    ],
  },
  ironHorde: {
    id: 'ironHorde',
    name: 'The Iron Horde',
    epithet: 'Armored March',
    description: 'Heavy armor and siege engines. Punish weak DPS.',
    accent: '#8a9aaa',
    color: '#2a3038',
    soundTag: 'faction_iron',
    bossId: 'siegeGolem',
    elitePool: ['siege', 'shieldBearer', 'brute'],
    abilityBias: ['shield', 'charge', 'armorAura'],
    compositions: [
      { until: 3, pool: [{ type: 'raider', weight: 100 }] },
      {
        until: 7,
        pool: [
          { type: 'raider', weight: 55 },
          { type: 'shieldBearer', weight: 30 },
          { type: 'brute', weight: 15 },
        ],
      },
      {
        until: 12,
        pool: [
          { type: 'raider', weight: 30 },
          { type: 'shieldBearer', weight: 28 },
          { type: 'brute', weight: 22 },
          { type: 'siege', weight: 12 },
          { type: 'scout', weight: 8 },
        ],
      },
      {
        until: 20,
        pool: [
          { type: 'shieldBearer', weight: 24 },
          { type: 'brute', weight: 20 },
          { type: 'siege', weight: 18 },
          { type: 'raider', weight: 16 },
          { type: 'banner', weight: 12 },
          { type: 'healer', weight: 10 },
        ],
      },
      {
        until: 9999,
        pool: [
          { type: 'siege', weight: 20 },
          { type: 'brute', weight: 18 },
          { type: 'shieldBearer', weight: 18 },
          { type: 'raider', weight: 14 },
          { type: 'banner', weight: 12 },
          { type: 'healer', weight: 10 },
          { type: 'berserker', weight: 8 },
        ],
      },
    ],
  },
  wildTribes: {
    id: 'wildTribes',
    name: 'The Wild Tribes',
    epithet: 'Swift Ambush',
    description: 'Fast raids and flanking packs. Coverage is survival.',
    accent: '#d4a060',
    color: '#3a2818',
    soundTag: 'faction_wild',
    bossId: 'champion',
    elitePool: ['scout', 'berserker', 'flying'],
    abilityBias: ['charge', 'teleport', 'enrage'],
    compositions: [
      { until: 3, pool: [{ type: 'scout', weight: 60 }, { type: 'raider', weight: 40 }] },
      {
        until: 7,
        pool: [
          { type: 'scout', weight: 45 },
          { type: 'raider', weight: 35 },
          { type: 'berserker', weight: 20 },
        ],
      },
      {
        until: 12,
        pool: [
          { type: 'scout', weight: 35 },
          { type: 'raider', weight: 25 },
          { type: 'berserker', weight: 20 },
          { type: 'flying', weight: 12 },
          { type: 'invisible', weight: 8 },
        ],
      },
      {
        until: 20,
        pool: [
          { type: 'scout', weight: 28 },
          { type: 'berserker', weight: 22 },
          { type: 'raider', weight: 18 },
          { type: 'flying', weight: 14 },
          { type: 'invisible', weight: 10 },
          { type: 'banner', weight: 8 },
        ],
      },
      {
        until: 9999,
        pool: [
          { type: 'scout', weight: 24 },
          { type: 'berserker', weight: 20 },
          { type: 'flying', weight: 16 },
          { type: 'invisible', weight: 12 },
          { type: 'raider', weight: 12 },
          { type: 'banner', weight: 8 },
          { type: 'brute', weight: 8 },
        ],
      },
    ],
  },
  cultOfAsh: {
    id: 'cultOfAsh',
    name: 'The Cult of Ash',
    epithet: 'Ember Rite',
    description: 'Summoners and magic pressure. Kill supports or drown.',
    accent: '#e07040',
    color: '#2a1810',
    soundTag: 'faction_ash',
    bossId: 'warlord',
    elitePool: ['healer', 'banner', 'berserker'],
    abilityBias: ['healingAura', 'poison', 'enrage', 'regeneration'],
    compositions: [
      { until: 3, pool: [{ type: 'raider', weight: 100 }] },
      {
        until: 7,
        pool: [
          { type: 'raider', weight: 50 },
          { type: 'healer', weight: 25 },
          { type: 'scout', weight: 25 },
        ],
      },
      {
        until: 12,
        pool: [
          { type: 'raider', weight: 30 },
          { type: 'healer', weight: 22 },
          { type: 'banner', weight: 18 },
          { type: 'berserker', weight: 15 },
          { type: 'flying', weight: 15 },
        ],
      },
      {
        until: 20,
        pool: [
          { type: 'healer', weight: 20 },
          { type: 'banner', weight: 18 },
          { type: 'raider', weight: 18 },
          { type: 'berserker', weight: 14 },
          { type: 'flying', weight: 12 },
          { type: 'invisible', weight: 10 },
          { type: 'brute', weight: 8 },
        ],
      },
      {
        until: 9999,
        pool: [
          { type: 'healer', weight: 18 },
          { type: 'banner', weight: 16 },
          { type: 'berserker', weight: 14 },
          { type: 'raider', weight: 14 },
          { type: 'flying', weight: 12 },
          { type: 'invisible', weight: 10 },
          { type: 'brute', weight: 10 },
          { type: 'siege', weight: 6 },
        ],
      },
    ],
  },
};

export function getFaction(id: FactionId): FactionDef {
  return FACTION_DEFS[id];
}

export function bossEnemyTypeForFaction(id: FactionId): EnemyType {
  const boss = FACTION_DEFS[id].bossId;
  if (boss === 'siegeGolem') return 'siegeGolem';
  if (boss === 'champion') return 'miniboss';
  return 'boss';
}
