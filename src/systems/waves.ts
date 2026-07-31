/**
 * Procedural wave generator — role mixes create distinct waves.
 * Modes share one generator; only WaveGenConfig differs.
 */

import { EnemyType } from '../config/enemies';
import { DifficultyDef } from '../config/difficulty';
import { bossEnemyTypeForFaction, FACTION_DEFS, FactionId } from '../config/factions';
import { createRng, hashString } from '../utils/math';
import type { DirectorHints } from './director';

export type WaveMode = 'endless' | 'campaign' | 'daily' | 'challenge' | 'custom';

export interface SpawnEvent {
  time: number;
  type: EnemyType;
  pathIndex?: number;
  role?: 'normal' | 'elite' | 'miniboss' | 'boss';
}

export interface WaveDef {
  wave: number;
  spawns: SpawnEvent[];
  isBossWave: boolean;
  isEliteWave: boolean;
  isMinibossWave: boolean;
  bounty: number;
  reinforceAfter?: number;
}

export interface WaveGenConfig {
  mode: WaveMode;
  seed: string;
  pathCount: number;
  spawnMult?: number;
  intervalMult?: number;
  maxWave?: number;
  eliteEvery?: number;
  minibossEvery?: number;
  bossEvery?: number;
  factionId?: FactionId;
  director?: DirectorHints;
  compositionPressure?: number;
}

const DEFAULT_ELITE_EVERY = 5;
const DEFAULT_MINIBOSS_EVERY = 10;
const DEFAULT_BOSS_EVERY = 25;

/**
 * Composition bands — ticket examples:
 * W8 ~70% Raiders / 20% Scouts / 10% Brutes
 * W15 Raiders + Shield Bearers + Healers
 * W25+ full roster
 */
const COMPOSITIONS: { until: number; pool: { type: EnemyType; weight: number }[] }[] = [
  { until: 3, pool: [{ type: 'raider', weight: 100 }] },
  {
    until: 6,
    pool: [
      { type: 'raider', weight: 70 },
      { type: 'scout', weight: 30 },
    ],
  },
  {
    until: 9,
    pool: [
      { type: 'raider', weight: 70 },
      { type: 'scout', weight: 20 },
      { type: 'brute', weight: 10 },
    ],
  },
  {
    until: 12,
    pool: [
      { type: 'raider', weight: 45 },
      { type: 'scout', weight: 20 },
      { type: 'brute', weight: 15 },
      { type: 'shieldBearer', weight: 20 },
    ],
  },
  {
    until: 16,
    pool: [
      { type: 'raider', weight: 35 },
      { type: 'scout', weight: 15 },
      { type: 'brute', weight: 12 },
      { type: 'shieldBearer', weight: 18 },
      { type: 'healer', weight: 12 },
      { type: 'berserker', weight: 8 },
    ],
  },
  {
    until: 20,
    pool: [
      { type: 'raider', weight: 22 },
      { type: 'scout', weight: 14 },
      { type: 'brute', weight: 12 },
      { type: 'shieldBearer', weight: 14 },
      { type: 'healer', weight: 10 },
      { type: 'banner', weight: 10 },
      { type: 'berserker', weight: 10 },
      { type: 'flying', weight: 8 },
    ],
  },
  {
    until: 28,
    pool: [
      { type: 'raider', weight: 14 },
      { type: 'scout', weight: 12 },
      { type: 'brute', weight: 12 },
      { type: 'shieldBearer', weight: 12 },
      { type: 'healer', weight: 10 },
      { type: 'banner', weight: 10 },
      { type: 'berserker', weight: 10 },
      { type: 'siege', weight: 8 },
      { type: 'flying', weight: 7 },
      { type: 'invisible', weight: 5 },
    ],
  },
  {
    until: 9999,
    pool: [
      { type: 'raider', weight: 10 },
      { type: 'scout', weight: 12 },
      { type: 'brute', weight: 12 },
      { type: 'shieldBearer', weight: 11 },
      { type: 'healer', weight: 10 },
      { type: 'banner', weight: 10 },
      { type: 'berserker', weight: 10 },
      { type: 'siege', weight: 10 },
      { type: 'flying', weight: 8 },
      { type: 'invisible', weight: 7 },
    ],
  },
];

function pickType(
  wave: number,
  rng: () => number,
  factionId?: FactionId,
  director?: DirectorHints,
  compositionPressure = 1,
): EnemyType {
  const bands = factionId
    ? FACTION_DEFS[factionId].compositions
    : COMPOSITIONS;
  const comp = bands.find((c) => wave <= c.until) ?? bands[bands.length - 1]!;
  const pool = comp.pool.map((p) => {
    let w = p.weight;
    if (director) {
      if (p.type === 'scout' || p.type === 'flying') w *= 1 + director.speedBias * 1.4;
      if (p.type === 'brute' || p.type === 'shieldBearer' || p.type === 'siege')
        w *= 1 + director.armorBias * 1.4;
      if (p.type === 'healer' || p.type === 'banner')
        w *= 1 + director.supportBias * 1.5 * compositionPressure;
      if (p.type === 'raider') w *= 1 + director.swarmBias * 1.2;
    } else if (compositionPressure > 1) {
      if (p.type === 'healer' || p.type === 'banner' || p.type === 'shieldBearer') {
        w *= compositionPressure;
      }
    }
    return { type: p.type, weight: w };
  });
  let total = 0;
  for (const p of pool) total += p.weight;
  let r = rng() * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p.type;
  }
  return 'raider';
}

function enemyCount(wave: number, spawnMult: number): number {
  const base = 10 + wave * 1.15 + Math.floor(wave / 5) * 1.5 + Math.floor(wave / 10) * 2;
  return Math.max(8, Math.min(90, Math.round(base * spawnMult)));
}

function spawnInterval(wave: number, intervalMult: number): number {
  return Math.max(0.22, (1.05 - wave * 0.012) * intervalMult);
}

function milestoneRole(
  wave: number,
  eliteEvery: number,
  minibossEvery: number,
  bossEvery: number,
): 'elite' | 'miniboss' | 'boss' | null {
  if (wave > 0 && wave % bossEvery === 0) return 'boss';
  if (wave > 0 && wave % minibossEvery === 0) return 'miniboss';
  if (wave > 0 && wave % eliteEvery === 0) return 'elite';
  return null;
}

function eliteType(wave: number, rng: () => number, factionId?: FactionId): EnemyType {
  if (factionId) {
    const pool = FACTION_DEFS[factionId].elitePool;
    return pool[Math.floor(rng() * pool.length)] ?? 'brute';
  }
  if (wave < 10) return rng() < 0.5 ? 'brute' : 'shieldBearer';
  if (wave < 20) return rng() < 0.4 ? 'berserker' : 'banner';
  return rng() < 0.45 ? 'siege' : 'brute';
}

/** Sort pack so brutes/siege tend earlier, supports later — AI "lead the attack". */
function orderPack(types: EnemyType[], rng: () => number): EnemyType[] {
  const rank = (t: EnemyType): number => {
    switch (t) {
      case 'siege':
        return 0;
      case 'brute':
        return 1;
      case 'shieldBearer':
        return 2;
      case 'berserker':
        return 3;
      case 'raider':
        return 4;
      case 'scout':
        return 5;
      case 'flying':
      case 'invisible':
        return 6;
      case 'healer':
      case 'banner':
        return 8;
      default:
        return 4;
    }
  };
  return [...types].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return rng() - 0.5;
  });
}

export function generateWave(config: WaveGenConfig, wave: number): WaveDef {
  const rng = createRng(hashString(`${config.seed}:${config.mode}:w${wave}`));
  const dir = config.director;
  const spawnMult = (config.spawnMult ?? 1) * (dir?.spawnMult ?? 1);
  const intervalMult = (config.intervalMult ?? 1) * (dir?.intervalMult ?? 1);
  const eliteEvery = config.eliteEvery ?? DEFAULT_ELITE_EVERY;
  const minibossEvery = config.minibossEvery ?? DEFAULT_MINIBOSS_EVERY;
  const bossEvery = config.bossEvery ?? DEFAULT_BOSS_EVERY;
  const pathCount = Math.max(1, config.pathCount);
  const pressure = config.compositionPressure ?? 1;

  const milestone = milestoneRole(wave, eliteEvery, minibossEvery, bossEvery);
  const isBossWave = milestone === 'boss';
  const isMinibossWave = milestone === 'miniboss';
  const isEliteWave = milestone === 'elite';

  const count = enemyCount(wave, spawnMult);
  const interval = spawnInterval(wave, intervalMult);

  const types: EnemyType[] = [];
  for (let i = 0; i < count; i++) {
    types.push(pickType(wave, rng, config.factionId, dir, pressure));
  }
  const ordered = orderPack(types, rng);

  const spawns: SpawnEvent[] = [];
  let t = 0.35 + rng() * 0.35;
  for (let i = 0; i < ordered.length; i++) {
    const type = ordered[i]!;
    const pathIndex = pathCount > 1 ? Math.floor(rng() * pathCount) : 0;
    // Uneven cadence — clusters + gaps so the field feels alive
    const cluster = i > 0 && i % 5 === 0;
    const stutter = rng() < 0.18;
    let gap = interval * (0.55 + rng() * 0.9);
    if (cluster) gap *= 1.6 + rng() * 0.5;
    if (stutter) gap *= 0.35 + rng() * 0.25;
    if (type === 'scout') gap *= 0.75;
    if (type === 'siege' || type === 'brute') gap *= 1.15;
    if (type === 'healer' || type === 'banner') gap *= 1.05;
    spawns.push({ time: t, type, pathIndex, role: 'normal' });
    t += gap;
  }

  if (milestone === 'elite') {
    spawns.push({
      time: Math.max(0.8, t * 0.3),
      type: eliteType(wave, rng, config.factionId),
      pathIndex: 0,
      role: 'elite',
    });
    if (wave >= 15) {
      spawns.push({
        time: Math.max(1.2, t * 0.5),
        type: eliteType(wave, rng, config.factionId),
        pathIndex: pathCount > 1 ? 1 % pathCount : 0,
        role: 'elite',
      });
    }
  } else if (milestone === 'miniboss') {
    spawns.push({
      time: t * 0.35 + 0.4,
      type: 'miniboss',
      pathIndex: 0,
      role: 'miniboss',
    });
    for (let i = 0; i < 3; i++) {
      spawns.push({
        time: t * 0.35 + 0.9 + i * 0.35,
        type: pickType(wave, rng, config.factionId, dir, pressure),
        pathIndex: pathCount > 1 ? i % pathCount : 0,
        role: 'normal',
      });
    }
  } else if (milestone === 'boss') {
    const bossType = config.factionId
      ? bossEnemyTypeForFaction(config.factionId)
      : 'siegeGolem';
    spawns.push({
      time: t * 0.45 + 0.8,
      type: bossType,
      pathIndex: 0,
      role: 'boss',
    });
    const escorts = 4 + Math.floor(wave / 25);
    for (let i = 0; i < escorts; i++) {
      spawns.push({
        time: t * 0.45 + 1.2 + i * 0.32,
        type: pickType(wave, rng, config.factionId, dir, pressure),
        pathIndex: pathCount > 1 ? i % pathCount : 0,
        role: 'normal',
      });
    }
  }

  spawns.sort((a, b) => a.time - b.time);

  const bounty = Math.round(
    35 +
      wave * 7 +
      (isEliteWave ? 40 : 0) +
      (isMinibossWave ? 80 : 0) +
      (isBossWave ? 180 : 0),
  );

  const reinforceAfter =
    wave >= 8 && wave % 4 === 0 && !isBossWave ? Math.floor(count * 0.55) : undefined;

  return {
    wave,
    spawns,
    isBossWave,
    isEliteWave,
    isMinibossWave,
    bounty,
    reinforceAfter,
  };
}

export function buildWave(
  wave: number,
  seed = 'bastion',
  difficulty?: Pick<
    DifficultyDef,
    | 'spawnMult'
    | 'intervalMult'
    | 'eliteCadenceMult'
    | 'bossCadenceMult'
    | 'compositionPressure'
  >,
  pathCount = 1,
  mode: WaveMode = 'endless',
  opts?: {
    factionId?: FactionId;
    director?: DirectorHints;
    envSpawnMult?: number;
  },
): WaveDef {
  const eliteM = difficulty?.eliteCadenceMult ?? 1;
  const bossM = difficulty?.bossCadenceMult ?? 1;
  return generateWave(
    {
      mode,
      seed,
      pathCount,
      spawnMult: (difficulty?.spawnMult ?? 1) * (opts?.envSpawnMult ?? 1),
      intervalMult: difficulty?.intervalMult,
      eliteEvery: Math.max(3, Math.round(DEFAULT_ELITE_EVERY * eliteM)),
      minibossEvery: Math.max(6, Math.round(DEFAULT_MINIBOSS_EVERY * eliteM)),
      bossEvery: Math.max(12, Math.round(DEFAULT_BOSS_EVERY * bossM)),
      factionId: opts?.factionId,
      director: opts?.director,
      compositionPressure: difficulty?.compositionPressure,
    },
    wave,
  );
}

export function summarizeWave(def: WaveDef): {
  label: string;
  counts: { type: EnemyType; n: number }[];
  total: number;
  boss: boolean;
} {
  const map = new Map<EnemyType, number>();
  for (const s of def.spawns) {
    map.set(s.type, (map.get(s.type) ?? 0) + 1);
  }
  const counts = [...map.entries()]
    .map(([type, n]) => ({ type, n }))
    .sort((a, b) => b.n - a.n);
  const label = counts
    .slice(0, 4)
    .map((c) => {
      const name = c.type.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
      return `${c.n}×${name.trim()}`;
    })
    .join(' · ');
  return { label, counts, total: def.spawns.length, boss: def.isBossWave };
}

export function tutorialTipForWave(wave: number): string | null {
  switch (wave) {
    case 1:
      return 'Tip: Place Arrow towers along the path, then press Start Wave.';
    case 2:
      return 'Tip: Upgrade towers or add Freeze to slow packs.';
    case 5:
      return 'Elite wave! A tougher foe leads the pack.';
    case 7:
      return 'Scouts are fast — cover the whole lane.';
    case 10:
      return 'Mini-Boss! Focus fire and keep slows nearby.';
    case 12:
      return 'Shield Bearers block frontal shots — hit their flanks.';
    case 15:
      return 'Healers and Banners — kill supports first!';
    case 20:
      return 'Siege Beasts ignore slows and crush the Gate.';
    case 25:
      return 'Boss wave! Warlord phases — burst and kite.';
    default:
      return null;
  }
}

export function isCampaignComplete(waveCleared: number, maxWave = 50): boolean {
  return waveCleared >= maxWave;
}
