import { BOSS_EVERY, MAX_WAVES_CAMPAIGN } from '../config/constants';
import { EnemyType } from '../config/enemies';
import { DifficultyDef } from '../config/difficulty';
import { createRng, hashString } from '../utils/math';

export interface SpawnEvent {
  time: number;
  type: EnemyType;
  pathIndex?: number;
}

export interface WaveDef {
  wave: number;
  spawns: SpawnEvent[];
  isBossWave: boolean;
  bounty: number;
  /** Mid-wave build pause after this many spawns (feature 6). */
  reinforceAfter?: number;
}

const COMPOSITIONS: { until: number; pool: { type: EnemyType; weight: number }[] }[] = [
  {
    until: 3,
    pool: [
      { type: 'basic', weight: 100 },
    ],
  },
  {
    until: 5,
    pool: [
      { type: 'basic', weight: 70 },
      { type: 'fast', weight: 30 },
    ],
  },
  {
    until: 10,
    pool: [
      { type: 'basic', weight: 45 },
      { type: 'fast', weight: 30 },
      { type: 'armored', weight: 15 },
      { type: 'flying', weight: 10 },
    ],
  },
  {
    until: 20,
    pool: [
      { type: 'basic', weight: 25 },
      { type: 'fast', weight: 20 },
      { type: 'tank', weight: 15 },
      { type: 'armored', weight: 15 },
      { type: 'flying', weight: 12 },
      { type: 'shielded', weight: 13 },
    ],
  },
  {
    until: 35,
    pool: [
      { type: 'fast', weight: 16 },
      { type: 'tank', weight: 16 },
      { type: 'armored', weight: 16 },
      { type: 'flying', weight: 12 },
      { type: 'invisible', weight: 10 },
      { type: 'regenerating', weight: 12 },
      { type: 'shielded', weight: 14 },
      { type: 'basic', weight: 4 },
    ],
  },
  {
    until: 9999,
    pool: [
      { type: 'fast', weight: 14 },
      { type: 'tank', weight: 16 },
      { type: 'armored', weight: 14 },
      { type: 'flying', weight: 12 },
      { type: 'invisible', weight: 12 },
      { type: 'regenerating', weight: 14 },
      { type: 'shielded', weight: 14 },
      { type: 'miniboss', weight: 4 },
    ],
  },
];

function pickType(wave: number, rng: () => number): EnemyType {
  const comp = COMPOSITIONS.find((c) => wave <= c.until) ?? COMPOSITIONS[COMPOSITIONS.length - 1]!;
  let total = 0;
  for (const p of comp.pool) total += p.weight;
  let r = rng() * total;
  for (const p of comp.pool) {
    r -= p.weight;
    if (r <= 0) return p.type;
  }
  return 'basic';
}

function enemyCount(wave: number, spawnMult: number): number {
  const base =
    wave % BOSS_EVERY === 0
      ? Math.max(8, 6 + Math.floor(wave * 0.4))
      : Math.min(80, 6 + Math.floor(wave * 1.35) + Math.floor(wave / 5) * 2);
  return Math.max(4, Math.round(base * spawnMult));
}

function spawnInterval(wave: number, intervalMult: number): number {
  return Math.max(0.16, (0.85 - wave * 0.012) * intervalMult);
}

export function buildWave(
  wave: number,
  seed = 'bastion',
  difficulty?: Pick<DifficultyDef, 'spawnMult' | 'intervalMult'>,
  pathCount = 1,
): WaveDef {
  const rng = createRng(hashString(`${seed}-wave-${wave}`));
  const spawnMult = difficulty?.spawnMult ?? 1;
  const intervalMult = difficulty?.intervalMult ?? 1;
  const isBossWave = wave % BOSS_EVERY === 0;
  const count = enemyCount(wave, spawnMult);
  const interval = spawnInterval(wave, intervalMult);
  const spawns: SpawnEvent[] = [];

  let t = 0.4;
  for (let i = 0; i < count; i++) {
    let type = pickType(wave, rng);
    if (!isBossWave && wave >= 15 && i === Math.floor(count / 2) && rng() < 0.35) {
      type = 'miniboss';
    }
    const pathIndex = pathCount > 1 ? Math.floor(rng() * pathCount) : 0;
    spawns.push({ time: t, type, pathIndex });
    t += interval * (0.7 + rng() * 0.6);
  }

  if (isBossWave) {
    spawns.push({ time: t + 1.2, type: 'boss', pathIndex: 0 });
    for (let i = 0; i < 4 + Math.floor(wave / 10); i++) {
      spawns.push({
        time: t + 0.3 + i * 0.35,
        type: pickType(wave, rng),
        pathIndex: pathCount > 1 ? i % pathCount : 0,
      });
    }
  }

  if (!isBossWave && wave % 5 === 0) {
    spawns.push({ time: t * 0.5, type: 'miniboss', pathIndex: 0 });
  }

  const bounty = Math.round(40 + wave * 8 + (isBossWave ? 100 : 0));
  const reinforceAfter = wave >= 6 && wave % 3 === 0 ? Math.floor(count * 0.55) : undefined;

  return { wave, spawns, isBossWave, bounty, reinforceAfter };
}

export function isCampaignComplete(waveCleared: number): boolean {
  return waveCleared >= MAX_WAVES_CAMPAIGN;
}

/** Summarize a wave for HUD preview chips. */
export function summarizeWave(def: WaveDef): { label: string; counts: { type: EnemyType; n: number }[]; total: number; boss: boolean } {
  const map = new Map<EnemyType, number>();
  for (const s of def.spawns) {
    map.set(s.type, (map.get(s.type) ?? 0) + 1);
  }
  const counts = [...map.entries()]
    .map(([type, n]) => ({ type, n }))
    .sort((a, b) => b.n - a.n);
  const label = counts
    .slice(0, 4)
    .map((c) => `${c.n}×${c.type}`)
    .join(' · ');
  return { label, counts, total: def.spawns.length, boss: def.isBossWave };
}

export function isEndless(wave: number): boolean {
  return wave > MAX_WAVES_CAMPAIGN;
}

/** Soft-tutorial tip keys by wave (feature 2). */
export function tutorialTipForWave(wave: number): string | null {
  switch (wave) {
    case 1:
      return 'Tip: Place Arrow towers along the path, then press Start Wave.';
    case 2:
      return 'Tip: Upgrade towers or add Freeze to slow packs.';
    case 3:
      return 'Tip: Fast Scouts incoming — stack attack speed or slow them.';
    case 5:
      return 'Tip: Armored foes resist physical shots — try Magic towers.';
    case 7:
      return 'Tip: Flying Wisps ignore Cannons. Use Arrow, Magic, or Tesla.';
    case 10:
      return 'Boss wave! Focus fire and keep Freeze nearby for synergies.';
    default:
      return null;
  }
}
