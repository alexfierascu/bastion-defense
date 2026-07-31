/**
 * Difficulty tiers — scale AI, economy, composition, elites, and bosses.
 * Avoid pure HP inflation.
 */

export type DifficultyId = 'recruit' | 'veteran' | 'commander' | 'legend';

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  description: string;
  hpMult: number;
  rewardMult: number;
  speedMult: number;
  spawnMult: number;
  intervalMult: number;
  startingGoldMult: number;
  startingLivesDelta: number;
  interestMult: number;
  scoreMult: number;
  /** Elite / miniboss / boss wave cadence multipliers (<1 = more often). */
  eliteCadenceMult: number;
  bossCadenceMult: number;
  /** Enemy ability aggression / charge CD scale. */
  aiAggression: number;
  /** Boss ability cooldown multiplier (<1 = casts more). */
  bossAbilityCdMult: number;
  /** Extra support / shield roles in packs. */
  compositionPressure: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  recruit: {
    id: 'recruit',
    name: 'Recruit',
    description: 'Learn the lines. Gentler packs, richer economy.',
    hpMult: 0.78,
    rewardMult: 1.2,
    speedMult: 0.92,
    spawnMult: 0.85,
    intervalMult: 1.15,
    startingGoldMult: 1.35,
    startingLivesDelta: 10,
    interestMult: 1.25,
    scoreMult: 0.7,
    eliteCadenceMult: 1.25,
    bossCadenceMult: 1.2,
    aiAggression: 0.75,
    bossAbilityCdMult: 1.25,
    compositionPressure: 0.7,
  },
  veteran: {
    id: 'veteran',
    name: 'Veteran',
    description: 'The intended Bastion experience.',
    hpMult: 1,
    rewardMult: 1,
    speedMult: 1,
    spawnMult: 1,
    intervalMult: 1,
    startingGoldMult: 1,
    startingLivesDelta: 0,
    interestMult: 1,
    scoreMult: 1,
    eliteCadenceMult: 1,
    bossCadenceMult: 1,
    aiAggression: 1,
    bossAbilityCdMult: 1,
    compositionPressure: 1,
  },
  commander: {
    id: 'commander',
    name: 'Commander',
    description: 'Lean economy, denser elites, sharper AI.',
    hpMult: 1.16,
    rewardMult: 0.92,
    speedMult: 1.05,
    spawnMult: 1.1,
    intervalMult: 0.92,
    startingGoldMult: 0.9,
    startingLivesDelta: -3,
    interestMult: 0.9,
    scoreMult: 1.35,
    eliteCadenceMult: 0.8,
    bossCadenceMult: 0.85,
    aiAggression: 1.2,
    bossAbilityCdMult: 0.85,
    compositionPressure: 1.25,
  },
  legend: {
    id: 'legend',
    name: 'Legend',
    description: 'For masters. Relentless composition and boss pressure.',
    hpMult: 1.45,
    rewardMult: 0.82,
    speedMult: 1.12,
    spawnMult: 1.22,
    intervalMult: 0.82,
    startingGoldMult: 0.75,
    startingLivesDelta: -8,
    interestMult: 0.75,
    scoreMult: 1.8,
    eliteCadenceMult: 0.65,
    bossCadenceMult: 0.7,
    aiAggression: 1.4,
    bossAbilityCdMult: 0.7,
    compositionPressure: 1.5,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = [
  'recruit',
  'veteran',
  'commander',
  'legend',
];

/** Migrate legacy save difficulty ids. */
export function migrateDifficultyId(raw: string | undefined | null): DifficultyId {
  switch (raw) {
    case 'easy':
    case 'recruit':
      return 'recruit';
    case 'normal':
    case 'veteran':
      return 'veteran';
    case 'hard':
    case 'commander':
      return 'commander';
    case 'nightmare':
    case 'legend':
      return 'legend';
    default:
      return 'veteran';
  }
}
