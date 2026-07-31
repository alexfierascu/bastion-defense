import { BiomeId, BIOME_DEFS, biomeForMap } from '../config/biomes';
import { ModifierId } from '../config/modifiers';

export interface EnvCombatMods {
  damageMult: number;
  critMult: number;
  projectileSpeedMult: number;
  freezeSlowBonus: number;
  rocketSplashBonus: number;
  arrowPenalty: number;
  shadeRevealPenalty: number;
  dayNight: number;
  weather: number;
  label: string;
  biomeId: BiomeId;
  enemySpeedMult: number;
  enemyHpMult: number;
  towerRangeMult: number;
  goldIncomeMult: number;
}

/** Combat-facing day/night + weather + biome atmosphere. */
export function computeEnvironment(
  waveTime: number,
  mapId: string,
  modifiers: ModifierId[],
  biomeId?: BiomeId | null,
  opts?: { forceNight?: boolean; nightBias?: number; weatherBias?: number },
): EnvCombatMods {
  const biome = BIOME_DEFS[biomeId ?? biomeForMap(mapId)];
  const cycle = (Math.sin(waveTime / 45) + 1) / 2;
  let dayNight = Math.min(0.9, cycle * 0.75 + biome.dayNightBias);
  let weather = biome.weatherBias;

  if (mapId === 'bastion-approach') {
    dayNight = Math.max(dayNight, 0.55);
    weather = Math.max(weather, 0.18);
  }
  if (opts?.forceNight) dayNight = Math.max(dayNight, 0.72);
  if (opts?.nightBias) dayNight = Math.max(dayNight, opts.nightBias);
  if (opts?.weatherBias) weather = Math.max(weather, opts.weatherBias);
  if (modifiers.includes('heavyRain')) weather = Math.max(weather, 0.85);
  if (modifiers.includes('fog')) {
    dayNight = Math.max(dayNight, 0.55);
    weather = Math.max(weather, 0.35);
  }

  const night = dayNight;
  const rain = weather;
  const haze = biome.visibilityPenalty;

  let label = biome.envLabel;
  if (night > 0.55 && rain > 0.45) label = `Stormy ${biome.name}`;
  else if (night > 0.55) label = `${biome.name} Night`;
  else if (rain > 0.45) label = `${biome.name} Weather`;

  return {
    dayNight,
    weather,
    biomeId: biome.id,
    damageMult: 1 + night * 0.06 + rain * 0.02,
    critMult: 1 - night * 0.15,
    projectileSpeedMult: biome.projectileSpeedMult * (1 - rain * 0.15),
    freezeSlowBonus: rain * 0.12 + (biome.id === 'snow' ? 0.08 : 0),
    rocketSplashBonus: rain * 0.1,
    arrowPenalty: rain * 0.1 + (biome.id === 'forest' ? 0.04 : 0),
    shadeRevealPenalty: night * 0.35 + haze + (modifiers.includes('fog') ? 0.25 : 0),
    label,
    enemySpeedMult: biome.enemySpeedMult,
    enemyHpMult: biome.enemyHpMult,
    towerRangeMult: biome.towerRangeMult,
    goldIncomeMult: biome.goldIncomeMult,
  };
}
