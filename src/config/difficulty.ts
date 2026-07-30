export type DifficultyId = 'easy' | 'normal' | 'hard' | 'nightmare';

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  description: string;
  hpMult: number;
  rewardMult: number;
  speedMult: number;
  spawnMult: number; // higher = more enemies
  intervalMult: number; // lower = denser spawns
  startingGoldMult: number;
  startingLivesDelta: number;
  interestMult: number;
  scoreMult: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  easy: {
    id: 'easy',
    name: 'Easy',
    description: 'More gold and lives. Gentler enemy scaling.',
    hpMult: 0.75,
    rewardMult: 1.15,
    speedMult: 0.92,
    spawnMult: 0.85,
    intervalMult: 1.15,
    startingGoldMult: 1.35,
    startingLivesDelta: 10,
    interestMult: 1.25,
    scoreMult: 0.7,
  },
  normal: {
    id: 'normal',
    name: 'Normal',
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
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    description: 'Tougher packs, leaner economy.',
    hpMult: 1.35,
    rewardMult: 0.9,
    speedMult: 1.08,
    spawnMult: 1.15,
    intervalMult: 0.9,
    startingGoldMult: 0.85,
    startingLivesDelta: -5,
    interestMult: 0.85,
    scoreMult: 1.35,
  },
  nightmare: {
    id: 'nightmare',
    name: 'Nightmare',
    description: 'For veterans. Expect pain.',
    hpMult: 1.75,
    rewardMult: 0.8,
    speedMult: 1.15,
    spawnMult: 1.3,
    intervalMult: 0.8,
    startingGoldMult: 0.7,
    startingLivesDelta: -10,
    interestMult: 0.7,
    scoreMult: 1.8,
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ['easy', 'normal', 'hard', 'nightmare'];
