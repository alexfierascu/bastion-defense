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
}

/** Combat-facing day/night + weather (features 13–14). */
export function computeEnvironment(
  waveTime: number,
  mapId: string,
  modifiers: ModifierId[],
): EnvCombatMods {
  // Wave-synced cycle so pause/speed stays consistent
  const cycle = (Math.sin(waveTime / 45) + 1) / 2; // 0..1
  let dayNight = cycle * 0.75;
  let weather = mapId.includes('marsh') || mapId.includes('serpent') ? 0.4 : 0.08;
  if (mapId.includes('storm') || modifiers.includes('heavyRain')) weather = 0.85;
  if (modifiers.includes('fog')) {
    dayNight = Math.max(dayNight, 0.55);
    weather = Math.max(weather, 0.35);
  }

  const night = dayNight;
  const rain = weather;

  return {
    dayNight,
    weather,
    // Night: energy/magic edged up, physical crit down
    damageMult: 1 + night * 0.06 + rain * 0.02,
    critMult: 1 - night * 0.15,
    projectileSpeedMult: 1 - rain * 0.18,
    freezeSlowBonus: rain * 0.12,
    rocketSplashBonus: rain * 0.1,
    arrowPenalty: rain * 0.1,
    shadeRevealPenalty: night * 0.4 + (modifiers.includes('fog') ? 0.35 : 0),
    label: night > 0.55 ? (rain > 0.5 ? 'Stormy Night' : 'Night') : rain > 0.5 ? 'Rain' : 'Day',
  };
}
