/**
 * Run Director — observes the player and nudges future waves.
 * Soft clamps only. Never creates impossible pressure.
 */

import { TowerType } from '../config/towers';
import { Tower } from '../entities/tower';
import { clamp } from '../utils/math';

export interface DirectorObservation {
  wave: number;
  gold: number;
  lives: number;
  maxLives: number;
  towers: Tower[];
  /** Leaks this wave (before clear). */
  leaksThisWave: number;
  /** Seconds to clear last wave (0 if unknown). */
  clearTimeSec: number;
  killsLastWave: number;
}

export interface DirectorHints {
  spawnMult: number;
  intervalMult: number;
  /** Prefer scouts / flying. */
  speedBias: number;
  /** Prefer brutes / shields / siege. */
  armorBias: number;
  /** Prefer healers / banners. */
  supportBias: number;
  /** Prefer dense raider packs. */
  swarmBias: number;
  /** Human-readable note for HUD / report. */
  note: string;
}

const NEUTRAL: DirectorHints = {
  spawnMult: 1,
  intervalMult: 1,
  speedBias: 0,
  armorBias: 0,
  supportBias: 0,
  swarmBias: 0,
  note: 'Watching…',
};

export class RunDirector {
  private hints: DirectorHints = { ...NEUTRAL };
  private struggleStreak = 0;
  private dominateStreak = 0;

  getHints(): DirectorHints {
    return this.hints;
  }

  reset(): void {
    this.hints = { ...NEUTRAL };
    this.struggleStreak = 0;
    this.dominateStreak = 0;
  }

  observe(obs: DirectorObservation): DirectorHints {
    const counts = countTowers(obs.towers);
    const totalCombat = Math.max(1, counts.combat);
    const arrowShare = counts.byType.arrow / totalCombat;
    const cannonShare = (counts.byType.cannon + counts.byType.rocket) / totalCombat;
    const freezeShare = counts.byType.freeze / totalCombat;
    const mono = maxShare(counts.byType, totalCombat);

    const gateRatio = obs.maxLives > 0 ? obs.lives / obs.maxLives : 1;
    const poor = obs.leaksThisWave > 0 || gateRatio < 0.45 || obs.gold < 80;
    const rich = obs.leaksThisWave === 0 && gateRatio > 0.85 && obs.gold > 350;
    const fastClear = obs.clearTimeSec > 0 && obs.clearTimeSec < 18;
    const slowClear = obs.clearTimeSec > 45;

    if (poor || slowClear) {
      this.struggleStreak++;
      this.dominateStreak = 0;
    } else if (rich || fastClear) {
      this.dominateStreak++;
      this.struggleStreak = 0;
    } else {
      this.struggleStreak = Math.max(0, this.struggleStreak - 1);
      this.dominateStreak = Math.max(0, this.dominateStreak - 1);
    }

    let spawnMult = 1;
    let intervalMult = 1;
    let speedBias = 0;
    let armorBias = 0;
    let supportBias = 0;
    let swarmBias = 0;
    const notes: string[] = [];

    // Counter mono compositions — tactical, not punitive
    if (cannonShare >= 0.45) {
      speedBias += 0.55;
      notes.push('Swift packs answer massed artillery');
    }
    if (arrowShare >= 0.5) {
      armorBias += 0.55;
      notes.push('Armor marches against volleys');
    }
    if (freezeShare >= 0.35) {
      swarmBias += 0.4;
      supportBias += 0.2;
      notes.push('Numbers test the frost line');
    }
    if (mono >= 0.6) {
      supportBias += 0.35;
      notes.push('Supports exploit a single doctrine');
    }

    // Economy / performance soft adjust
    if (this.struggleStreak >= 2) {
      spawnMult *= 0.9;
      intervalMult *= 1.08;
      notes.push('Pressure eases — hold the line');
    } else if (this.dominateStreak >= 2) {
      spawnMult *= 1.08;
      intervalMult *= 0.94;
      supportBias += 0.25;
      notes.push('Tactics sharpen against your strength');
    }

    if (obs.gold > 600 && obs.wave >= 8) {
      armorBias += 0.2;
      supportBias += 0.15;
    }

    // Hard clamps — never impossible
    spawnMult = clamp(spawnMult, 0.82, 1.18);
    intervalMult = clamp(intervalMult, 0.85, 1.2);
    speedBias = clamp(speedBias, 0, 1);
    armorBias = clamp(armorBias, 0, 1);
    supportBias = clamp(supportBias, 0, 1);
    swarmBias = clamp(swarmBias, 0, 1);

    this.hints = {
      spawnMult,
      intervalMult,
      speedBias,
      armorBias,
      supportBias,
      swarmBias,
      note: notes[0] ?? 'The siege adapts',
    };
    return this.hints;
  }
}

function countTowers(towers: Tower[]): {
  combat: number;
  byType: Record<TowerType, number>;
} {
  const byType = emptyTypeCounts();
  let combat = 0;
  for (const t of towers) {
    if (!t.active) continue;
    byType[t.type] = (byType[t.type] ?? 0) + 1;
    if (t.type !== 'wall') combat++;
  }
  return { combat, byType };
}

function emptyTypeCounts(): Record<TowerType, number> {
  return {
    arrow: 0,
    cannon: 0,
    ballista: 0,
    magic: 0,
    sniper: 0,
    poison: 0,
    freeze: 0,
    tesla: 0,
    laser: 0,
    rocket: 0,
    support: 0,
    wall: 0,
  };
}

function maxShare(byType: Record<TowerType, number>, total: number): number {
  let m = 0;
  for (const [k, n] of Object.entries(byType)) {
    if (k === 'wall') continue;
    m = Math.max(m, n / total);
  }
  return m;
}
