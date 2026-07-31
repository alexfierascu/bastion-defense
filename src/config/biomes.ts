/**
 * Biome framework — terrain, atmosphere, and light gameplay modifiers.
 * Future biomes plug in here without touching combat systems.
 */

export type BiomeId = 'forest' | 'mountain' | 'snow' | 'swamp' | 'desert';

export interface BiomeDef {
  id: BiomeId;
  name: string;
  description: string;
  /** CSS / canvas tint for terrain. */
  terrainTint: string;
  skyTop: string;
  skyBottom: string;
  vegetation: string;
  /** Ambient SFX cue id (procedural fallback ok). */
  ambientCue: string;
  /** 0–1 baseline day/night bias (higher = darker). */
  dayNightBias: number;
  /** 0–1 weather / mist intensity. */
  weatherBias: number;
  envLabel: string;
  /** Gameplay modifiers. */
  enemySpeedMult: number;
  enemyHpMult: number;
  towerRangeMult: number;
  projectileSpeedMult: number;
  /** Visibility / fog pressure on stealth. */
  visibilityPenalty: number;
  goldIncomeMult: number;
}

export const BIOME_DEFS: Record<BiomeId, BiomeDef> = {
  forest: {
    id: 'forest',
    name: 'Forest',
    description: 'Dense vegetation. Steady footing, soft light through the canopy.',
    terrainTint: '#3a5a32',
    skyTop: '#6a8a70',
    skyBottom: '#c8d8b0',
    vegetation: 'oak',
    ambientCue: 'wood_creak',
    dayNightBias: 0.2,
    weatherBias: 0.12,
    envLabel: 'Canopy',
    enemySpeedMult: 1,
    enemyHpMult: 1,
    towerRangeMult: 0.96,
    projectileSpeedMult: 1,
    visibilityPenalty: 0.08,
    goldIncomeMult: 1,
  },
  mountain: {
    id: 'mountain',
    name: 'Mountain',
    description: 'Thin air and long sightlines. Projectiles fly true.',
    terrainTint: '#5a5a52',
    skyTop: '#4a6080',
    skyBottom: '#d0d8e0',
    vegetation: 'pine',
    ambientCue: 'wind',
    dayNightBias: 0.15,
    weatherBias: 0.18,
    envLabel: 'Highland',
    enemySpeedMult: 0.96,
    enemyHpMult: 1.06,
    towerRangeMult: 1.08,
    projectileSpeedMult: 1.1,
    visibilityPenalty: 0,
    goldIncomeMult: 1,
  },
  snow: {
    id: 'snow',
    name: 'Snow',
    description: 'Bitter cold. Everyone moves slower in the drifts.',
    terrainTint: '#8a9aaa',
    skyTop: '#607088',
    skyBottom: '#e8f0f8',
    vegetation: 'fir',
    ambientCue: 'wind',
    dayNightBias: 0.25,
    weatherBias: 0.35,
    envLabel: 'Blizzard',
    enemySpeedMult: 0.88,
    enemyHpMult: 1.05,
    towerRangeMult: 1,
    projectileSpeedMult: 0.95,
    visibilityPenalty: 0.12,
    goldIncomeMult: 1.05,
  },
  swamp: {
    id: 'swamp',
    name: 'Swamp',
    description: 'Mire and mist. Enemies slog; towers choke on the damp.',
    terrainTint: '#3a4a38',
    skyTop: '#3a5048',
    skyBottom: '#708878',
    vegetation: 'reed',
    ambientCue: 'wood_creak',
    dayNightBias: 0.45,
    weatherBias: 0.55,
    envLabel: 'Mire',
    enemySpeedMult: 0.82,
    enemyHpMult: 1.1,
    towerRangeMult: 0.94,
    projectileSpeedMult: 0.88,
    visibilityPenalty: 0.2,
    goldIncomeMult: 0.95,
  },
  desert: {
    id: 'desert',
    name: 'Desert',
    description: 'Heat haze. Reduced visibility; packs hit hard when they arrive.',
    terrainTint: '#a08858',
    skyTop: '#c09050',
    skyBottom: '#f0d8a0',
    vegetation: 'scrub',
    ambientCue: 'wind',
    dayNightBias: 0.1,
    weatherBias: 0.08,
    envLabel: 'Haze',
    enemySpeedMult: 1.06,
    enemyHpMult: 0.95,
    towerRangeMult: 1.05,
    projectileSpeedMult: 1.05,
    visibilityPenalty: 0.28,
    goldIncomeMult: 1.08,
  },
};

export const BIOME_ORDER: BiomeId[] = ['forest', 'mountain', 'snow', 'swamp', 'desert'];

/** Map id → default biome when mission does not override. */
export const MAP_BIOME_DEFAULTS: Record<string, BiomeId> = {
  'bastion-approach': 'forest',
  'emerald-pass': 'forest',
  'serpent-marsh': 'swamp',
  'crimson-ridge': 'mountain',
  'twin-forks': 'forest',
  'iron-causeway': 'mountain',
  'hollow-grove': 'forest',
};

export function biomeForMap(mapId: string): BiomeId {
  return MAP_BIOME_DEFAULTS[mapId] ?? 'forest';
}
