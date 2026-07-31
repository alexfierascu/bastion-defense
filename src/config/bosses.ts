/**
 * Reusable Boss Framework definitions.
 * Controllers live in systems/bossController.ts — future bosses need only a BossDef.
 */

import { EnemyAbilityId } from './enemyAbilities';
import { EnemyType } from './enemies';

export type BossId = 'siegeGolem' | 'warlord' | 'champion';

export type BossAbilityId =
  | 'groundSlam'
  | 'boulderThrow'
  | 'summonMinions'
  | 'chargeGate'
  | 'barrierPulse'
  | 'enrageRoar';

export type BossState = 'idle' | 'intro' | 'fighting' | 'dying' | 'dead';

export interface BossPhaseDef {
  /** 0-based phase index. */
  phase: number;
  /** Enter when hp/maxHp drops to or below this (phase 0 starts at 1). */
  hpThreshold: number;
  name: string;
  /** Mechanics unlocked / emphasized this phase. */
  abilities: BossAbilityId[];
  /** Speed multiplier applied on phase enter. */
  speedMult?: number;
  /** Temporary shield as fraction of maxHp. */
  shieldFrac?: number;
  /** Become CC-immune for this many seconds. */
  enrageSec?: number;
  /** Regen multiplier. */
  regenMult?: number;
}

export interface BossAbilityDef {
  id: BossAbilityId;
  name: string;
  description: string;
  cooldown: number;
  /** Base damage / effect magnitude. */
  power: number;
  radius?: number;
  icon: string;
  color: string;
  sound: string;
}

export interface BossRewardDef {
  gold: number;
  researchPoints: number;
  /** Opens epic reward selection (elite spoil UI). */
  epicReward: boolean;
  scoreBonus: number;
}

export interface BossDef {
  id: BossId;
  /** Enemy type spawned for this boss. */
  enemyType: EnemyType;
  name: string;
  title: string;
  description: string;
  introLine: string;
  color: string;
  accent: string;
  phases: BossPhaseDef[];
  abilities: BossAbilityDef[];
  /** Passive enemy abilities attached alongside boss kit. */
  enemyAbilities: EnemyAbilityId[];
  rewards: BossRewardDef;
  /** Music intensity cue (procedural boss stem). */
  musicIntensity: number;
}

export const BOSS_ABILITIES: Record<BossAbilityId, BossAbilityDef> = {
  groundSlam: {
    id: 'groundSlam',
    name: 'Ground Slam',
    description: 'Area shockwave damages the gate if towers are sparse.',
    cooldown: 8,
    power: 1.2,
    radius: 110,
    icon: '☄',
    color: '#c4a070',
    sound: 'explosion',
  },
  boulderThrow: {
    id: 'boulderThrow',
    name: 'Boulder Throw',
    description: 'Long-range stone that punishes backline.',
    cooldown: 6,
    power: 2.0,
    radius: 45,
    icon: '🪨',
    color: '#8a7a60',
    sound: 'attack_cannon',
  },
  summonMinions: {
    id: 'summonMinions',
    name: 'Summon Minions',
    description: 'Calls rubble thralls onto the path.',
    cooldown: 14,
    power: 3,
    icon: '👁',
    color: '#6a5a40',
    sound: 'wave_clear',
  },
  chargeGate: {
    id: 'chargeGate',
    name: 'Siege Charge',
    description: 'Rushes toward the Bastion Gate.',
    cooldown: 16,
    power: 1.6,
    icon: '➡',
    color: '#ff8844',
    sound: 'attack_rocket',
  },
  barrierPulse: {
    id: 'barrierPulse',
    name: 'Barrier Pulse',
    description: 'Raises a stone shield.',
    cooldown: 12,
    power: 0.2,
    icon: '🛡',
    color: '#8ec8ff',
    sound: 'upgrade',
  },
  enrageRoar: {
    id: 'enrageRoar',
    name: 'Enrage Roar',
    description: 'Shakes off crowd control and surges.',
    cooldown: 20,
    power: 1,
    icon: '💢',
    color: '#ff4422',
    sound: 'defeat',
  },
};

export const BOSS_DEFS: Record<BossId, BossDef> = {
  siegeGolem: {
    id: 'siegeGolem',
    enemyType: 'siegeGolem',
    name: 'The Siege Golem',
    title: 'Living Siege Engine',
    description: 'A walking fortress that slams, hurls boulders, and charges the gate.',
    introLine: 'The earth splits — a Siege Golem marches on the Bastion!',
    color: '#4a4538',
    accent: '#d4a050',
    musicIntensity: 1.35,
    enemyAbilities: ['shield', 'regeneration', 'enrage'],
    phases: [
      {
        phase: 0,
        hpThreshold: 1,
        name: 'Advance',
        abilities: ['boulderThrow', 'groundSlam'],
      },
      {
        phase: 1,
        hpThreshold: 0.75,
        name: 'Breach',
        abilities: ['boulderThrow', 'groundSlam', 'summonMinions'],
        speedMult: 1.12,
        shieldFrac: 0.12,
      },
      {
        phase: 2,
        hpThreshold: 0.4,
        name: 'Siege Mode',
        abilities: ['boulderThrow', 'groundSlam', 'summonMinions', 'chargeGate'],
        speedMult: 1.2,
        shieldFrac: 0.1,
        enrageSec: 3,
        regenMult: 1.5,
      },
      {
        phase: 3,
        hpThreshold: 0.15,
        name: 'Collapse',
        abilities: ['groundSlam', 'chargeGate', 'summonMinions', 'enrageRoar'],
        speedMult: 1.35,
        enrageSec: 8,
        regenMult: 2,
      },
    ],
    abilities: [
      BOSS_ABILITIES.groundSlam,
      BOSS_ABILITIES.boulderThrow,
      BOSS_ABILITIES.summonMinions,
      BOSS_ABILITIES.chargeGate,
      BOSS_ABILITIES.enrageRoar,
    ],
    rewards: {
      gold: 220,
      researchPoints: 1,
      epicReward: true,
      scoreBonus: 1200,
    },
  },
  champion: {
    id: 'champion',
    enemyType: 'miniboss',
    name: 'Champion',
    title: 'Elite Commander',
    description: 'Barrier, then berserk summons.',
    introLine: 'A Champion takes the field!',
    color: '#5a3a2a',
    accent: '#e07040',
    musicIntensity: 1.1,
    enemyAbilities: ['shield', 'enrage', 'healingAura'],
    phases: [
      { phase: 0, hpThreshold: 1, name: 'Command', abilities: ['barrierPulse'] },
      {
        phase: 1,
        hpThreshold: 0.75,
        name: 'Barrier',
        abilities: ['barrierPulse', 'summonMinions'],
        shieldFrac: 0.15,
        speedMult: 1.1,
      },
      {
        phase: 2,
        hpThreshold: 0.4,
        name: 'Berserk',
        abilities: ['summonMinions', 'enrageRoar'],
        speedMult: 1.25,
        enrageSec: 4,
        regenMult: 2,
      },
    ],
    abilities: [BOSS_ABILITIES.barrierPulse, BOSS_ABILITIES.summonMinions, BOSS_ABILITIES.enrageRoar],
    rewards: {
      gold: 90,
      researchPoints: 0,
      epicReward: true,
      scoreBonus: 400,
    },
  },
  warlord: {
    id: 'warlord',
    enemyType: 'boss',
    name: 'Warlord',
    title: 'Horde Tyrant',
    description: 'Shield phase, then freeze-immune enrage with adds.',
    introLine: 'The Warlord arrives!',
    color: '#3a2a4a',
    accent: '#ff6688',
    musicIntensity: 1.25,
    enemyAbilities: ['shield', 'regeneration', 'enrage', 'armorAura'],
    phases: [
      { phase: 0, hpThreshold: 1, name: 'March', abilities: ['boulderThrow', 'barrierPulse'] },
      {
        phase: 1,
        hpThreshold: 0.75,
        name: 'Iron Wall',
        abilities: ['barrierPulse', 'summonMinions'],
        shieldFrac: 0.18,
        speedMult: 1.1,
      },
      {
        phase: 2,
        hpThreshold: 0.4,
        name: 'Tyrant',
        abilities: ['summonMinions', 'enrageRoar', 'groundSlam'],
        speedMult: 1.3,
        enrageSec: 6,
        regenMult: 2,
      },
    ],
    abilities: [
      BOSS_ABILITIES.barrierPulse,
      BOSS_ABILITIES.summonMinions,
      BOSS_ABILITIES.enrageRoar,
      BOSS_ABILITIES.groundSlam,
      BOSS_ABILITIES.boulderThrow,
    ],
    rewards: {
      gold: 180,
      researchPoints: 1,
      epicReward: true,
      scoreBonus: 900,
    },
  },
};

export function bossIdForEnemyType(type: EnemyType): BossId | null {
  if (type === 'siegeGolem') return 'siegeGolem';
  if (type === 'miniboss') return 'champion';
  if (type === 'boss') return 'warlord';
  return null;
}

/** Primary campaign boss — wave 25+ uses Siege Golem. */
export const PRIMARY_BOSS_ID: BossId = 'siegeGolem';
