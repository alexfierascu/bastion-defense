/**
 * Data-driven environment + layer registry.
 * Weather/seasons mutate EnvironmentState — not the scene graph structure.
 *
 * Fortress stone is ONE rigid plate (no sliced parallax).
 * Banners/torches nest under fortress with parallax 0 (inherit transform only).
 */

import { EnvironmentState, LayerDef } from '../types';

const HERO = '/assets/landing/bastion-hero.png';

/** Parallax amplitudes in CSS px. Stone structure uses a single amp. */
export const LAYER_DEFS: LayerDef[] = [
  { id: 'sky', z: 0, parallax: 1, className: 'ts-sky' },
  { id: 'moon', z: 1, parallax: 2, className: 'ts-moon' },
  { id: 'cloudsFar', z: 2, parallax: 4, className: 'ts-clouds ts-clouds-far' },
  { id: 'cloudsNear', z: 3, parallax: 4, className: 'ts-clouds ts-clouds-near' },
  { id: 'tree', z: 8, parallax: 8, src: HERO, className: 'ts-tree' },
  {
    id: 'fortress',
    z: 10,
    parallax: 12,
    src: HERO,
    className: 'ts-fortress ts-castle',
  },
  // Decorative overlays ride the fortress transform — no independent mouse parallax
  {
    id: 'banners',
    z: 14,
    parallax: 0,
    className: 'ts-banners',
    parent: 'fortress',
  },
  {
    id: 'torches',
    z: 15,
    parallax: 0,
    className: 'ts-torches',
    parent: 'fortress',
  },
  { id: 'ground', z: 16, parallax: 18, className: 'ts-ground' },
  { id: 'grass', z: 17, parallax: 24, className: 'ts-grass' },
  { id: 'fog1', z: 20, parallax: 18, className: 'ts-fog ts-fog-1' },
  { id: 'fog2', z: 21, parallax: 20, className: 'ts-fog ts-fog-2' },
  { id: 'fog3', z: 22, parallax: 24, className: 'ts-fog ts-fog-3' },
  { id: 'weather', z: 28, parallax: 0, className: 'ts-weather' },
  { id: 'particles', z: 30, parallax: 0, className: 'ts-particles' },
  { id: 'lighting', z: 31, parallax: 12, className: 'ts-lighting' },
  { id: 'ui', z: 40, parallax: 0, className: 'ts-ui' },
];

export function defaultEnvironment(): EnvironmentState {
  return {
    weather: 'mist',
    timeOfDay: 0.85,
    wind: 0.35,
    moonDim: 0.1,
    particleScale: 1,
    fogDensity: 1,
    skyWarmth: 0,
  };
}

/** Weather presets — extend without touching the engine. */
export const WEATHER_PRESETS: Record<
  EnvironmentState['weather'],
  Partial<EnvironmentState>
> = {
  clear: {
    wind: 0.2,
    moonDim: 0,
    particleScale: 0.7,
    fogDensity: 0.35,
    skyWarmth: 0,
    timeOfDay: 0.85,
  },
  mist: {
    wind: 0.35,
    moonDim: 0.1,
    particleScale: 1,
    fogDensity: 1,
    skyWarmth: 0,
    timeOfDay: 0.85,
  },
  rain: {
    wind: 0.7,
    moonDim: 0.35,
    particleScale: 0.45,
    fogDensity: 0.7,
    skyWarmth: 0,
    timeOfDay: 0.9,
  },
  storm: {
    wind: 1,
    moonDim: 0.55,
    particleScale: 0.35,
    fogDensity: 0.85,
    skyWarmth: 0,
    timeOfDay: 0.95,
  },
  snow: {
    wind: 0.25,
    moonDim: 0.15,
    particleScale: 0.6,
    fogDensity: 0.9,
    skyWarmth: 0.05,
    timeOfDay: 0.8,
  },
  dawn: {
    wind: 0.3,
    moonDim: 0.05,
    particleScale: 0.8,
    fogDensity: 0.55,
    skyWarmth: 0.55,
    timeOfDay: 0.35,
  },
};
