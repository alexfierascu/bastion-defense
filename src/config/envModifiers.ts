/**
 * Map environmental modifiers — rolled 1–3 per run.
 * Effects are gameplay-first (range, speed, economy, pressure).
 */

export type EnvModifierId =
  | 'heavyFog'
  | 'strongWinds'
  | 'night'
  | 'rain'
  | 'frozenGround'
  | 'abandonedVillage'
  | 'sacredLand'
  | 'corruptedForest';

export interface EnvModifierEffects {
  /** Tower range multiplier. */
  rangeMult?: number;
  /** Enemy move speed multiplier. */
  enemySpeedMult?: number;
  /** Projectile speed multiplier. */
  projectileSpeedMult?: number;
  /** Kill gold multiplier. */
  goldMult?: number;
  /** Tower fire-rate multiplier. */
  fireRateMult?: number;
  /** Extra spawn pressure. */
  spawnMult?: number;
  /** Gate max HP multiplier. */
  gateHealthMult?: number;
  /** Force night cycle bias 0–1. */
  nightBias?: number;
  /** Weather intensity 0–1. */
  weatherBias?: number;
  /** Crit chance additive. */
  critBonus?: number;
  /** Splash / AoE damage multiplier. */
  splashDamageMult?: number;
  /** Freeze / slow strength bonus. */
  slowBonus?: number;
  /** Shades harder to reveal. */
  stealthPressure?: boolean;
}

export interface EnvModifierDef {
  id: EnvModifierId;
  name: string;
  description: string;
  weight: number;
  effects: EnvModifierEffects;
}

export const ENV_MODIFIER_DEFS: Record<EnvModifierId, EnvModifierDef> = {
  heavyFog: {
    id: 'heavyFog',
    name: 'Heavy Fog',
    description: 'Tower range −15%. Shades linger longer.',
    weight: 12,
    effects: { rangeMult: 0.85, stealthPressure: true, weatherBias: 0.35 },
  },
  strongWinds: {
    id: 'strongWinds',
    name: 'Strong Winds',
    description: 'Projectiles −12% speed. Flying enemies +10% speed.',
    weight: 11,
    effects: { projectileSpeedMult: 0.88, enemySpeedMult: 1.04 },
  },
  night: {
    id: 'night',
    name: 'Night',
    description: 'Perpetual dusk. Crits +4%, range −8%.',
    weight: 10,
    effects: { nightBias: 0.85, critBonus: 0.04, rangeMult: 0.92 },
  },
  rain: {
    id: 'rain',
    name: 'Rain',
    description: 'Cannon/rocket −10% damage feel via projectile drag; freeze slows +8%.',
    weight: 11,
    effects: {
      projectileSpeedMult: 0.9,
      slowBonus: 0.08,
      weatherBias: 0.7,
      splashDamageMult: 0.95,
    },
  },
  frozenGround: {
    id: 'frozenGround',
    name: 'Frozen Ground',
    description: 'Enemies −12% speed. Your towers fire 5% slower.',
    weight: 10,
    effects: { enemySpeedMult: 0.88, fireRateMult: 0.95 },
  },
  abandonedVillage: {
    id: 'abandonedVillage',
    name: 'Abandoned Village',
    description: '+12% kill gold. Denseness +8% spawns.',
    weight: 9,
    effects: { goldMult: 1.12, spawnMult: 1.08 },
  },
  sacredLand: {
    id: 'sacredLand',
    name: 'Sacred Land',
    description: 'Gate +15% integrity. Enemy speed −6%.',
    weight: 8,
    effects: { gateHealthMult: 1.15, enemySpeedMult: 0.94 },
  },
  corruptedForest: {
    id: 'corruptedForest',
    name: 'Corrupted Forest',
    description: 'Enemy speed +8%. Splash damage +12%.',
    weight: 9,
    effects: { enemySpeedMult: 1.08, splashDamageMult: 1.12, weatherBias: 0.4 },
  },
};

export const ENV_MODIFIER_ORDER = Object.keys(ENV_MODIFIER_DEFS) as EnvModifierId[];

export function envModifierLabels(ids: EnvModifierId[]): string[] {
  return ids.map((id) => ENV_MODIFIER_DEFS[id]?.name ?? id);
}

export function mergeEnvEffects(ids: EnvModifierId[]): EnvModifierEffects {
  const out: EnvModifierEffects = {};
  for (const id of ids) {
    const e = ENV_MODIFIER_DEFS[id]?.effects;
    if (!e) continue;
    if (e.rangeMult) out.rangeMult = (out.rangeMult ?? 1) * e.rangeMult;
    if (e.enemySpeedMult) out.enemySpeedMult = (out.enemySpeedMult ?? 1) * e.enemySpeedMult;
    if (e.projectileSpeedMult)
      out.projectileSpeedMult = (out.projectileSpeedMult ?? 1) * e.projectileSpeedMult;
    if (e.goldMult) out.goldMult = (out.goldMult ?? 1) * e.goldMult;
    if (e.fireRateMult) out.fireRateMult = (out.fireRateMult ?? 1) * e.fireRateMult;
    if (e.spawnMult) out.spawnMult = (out.spawnMult ?? 1) * e.spawnMult;
    if (e.gateHealthMult) out.gateHealthMult = (out.gateHealthMult ?? 1) * e.gateHealthMult;
    if (e.nightBias != null) out.nightBias = Math.max(out.nightBias ?? 0, e.nightBias);
    if (e.weatherBias != null) out.weatherBias = Math.max(out.weatherBias ?? 0, e.weatherBias);
    if (e.critBonus) out.critBonus = (out.critBonus ?? 0) + e.critBonus;
    if (e.splashDamageMult)
      out.splashDamageMult = (out.splashDamageMult ?? 1) * e.splashDamageMult;
    if (e.slowBonus) out.slowBonus = (out.slowBonus ?? 0) + e.slowBonus;
    if (e.stealthPressure) out.stealthPressure = true;
  }
  return out;
}
