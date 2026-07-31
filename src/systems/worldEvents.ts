/**
 * Dynamic world events — one active at a time.
 * Triggered between waves; durations are in seconds of game time.
 */

import { createRng, hashString } from '../utils/math';

export type WorldEventId = 'fog' | 'heavyRain' | 'merchant' | 'blessing' | 'banditRaid';

export interface WorldEventDef {
  id: WorldEventId;
  name: string;
  description: string;
  /** Active duration in seconds (banditRaid is instant spawn). */
  duration: number;
  weight: number;
  /** Earliest wave that can roll this event. */
  minWave: number;
}

export const WORLD_EVENT_DEFS: Record<WorldEventId, WorldEventDef> = {
  fog: {
    id: 'fog',
    name: 'Fog',
    description: 'Towers lose range. Enemies gain stealth.',
    duration: 45,
    weight: 12,
    minWave: 4,
  },
  heavyRain: {
    id: 'heavyRain',
    name: 'Heavy Rain',
    description: 'Fire damage reduced. Tesla coils surge.',
    duration: 50,
    weight: 12,
    minWave: 3,
  },
  merchant: {
    id: 'merchant',
    name: 'Merchant Caravan',
    description: 'Discounted towers for 60 seconds.',
    duration: 60,
    weight: 10,
    minWave: 2,
  },
  blessing: {
    id: 'blessing',
    name: 'Blessing',
    description: 'The Gate slowly regenerates.',
    duration: 40,
    weight: 10,
    minWave: 5,
  },
  banditRaid: {
    id: 'banditRaid',
    name: 'Bandit Raid',
    description: 'Fast enemies spawn unexpectedly!',
    duration: 8,
    weight: 11,
    minWave: 6,
  },
};

export interface ActiveWorldEvent {
  id: WorldEventId;
  name: string;
  description: string;
  remaining: number;
  /** Bandit raid spawn budget remaining. */
  raidSpawnsLeft: number;
}

export interface WorldEventRoll {
  event: ActiveWorldEvent | null;
  /** Waves until next roll is allowed. */
  cooldownWaves: number;
}

const EVENT_IDS = Object.keys(WORLD_EVENT_DEFS) as WorldEventId[];

/** ~28% chance every eligible wave; soft cooldown 2–3 waves. */
export function rollWorldEvent(
  wave: number,
  seed: string,
  cooldownWaves: number,
  hasActive: boolean,
): WorldEventRoll {
  if (hasActive) return { event: null, cooldownWaves };
  if (cooldownWaves > 0) return { event: null, cooldownWaves: cooldownWaves - 1 };
  if (wave < 3) return { event: null, cooldownWaves: 0 };

  const rng = createRng(hashString(`${seed}:evt:${wave}`));
  if (rng() > 0.28) return { event: null, cooldownWaves: 1 };

  const pool = EVENT_IDS.filter((id) => WORLD_EVENT_DEFS[id].minWave <= wave);
  let total = 0;
  for (const id of pool) total += WORLD_EVENT_DEFS[id].weight;
  let r = rng() * total;
  let pick = pool[0]!;
  for (const id of pool) {
    r -= WORLD_EVENT_DEFS[id].weight;
    if (r <= 0) {
      pick = id;
      break;
    }
  }
  const def = WORLD_EVENT_DEFS[pick]!;
  return {
    event: {
      id: def.id,
      name: def.name,
      description: def.description,
      remaining: def.duration,
      raidSpawnsLeft: def.id === 'banditRaid' ? 4 + Math.floor(wave / 10) : 0,
    },
    cooldownWaves: 2 + Math.floor(rng() * 2),
  };
}

export function tickWorldEvent(evt: ActiveWorldEvent, dt: number): boolean {
  evt.remaining -= dt;
  return evt.remaining > 0;
}
