/** Core game constants — tune carefully for balance. */

export const GAME_TITLE = 'Bastion Defense';
export const GAME_VERSION = '1.0.0';
export const SAVE_KEY = 'bastion-defense-save-v1';

export const TILE_SIZE = 48;
export const MAP_COLS = 40;
export const MAP_ROWS = 28;
export const MAP_WIDTH = MAP_COLS * TILE_SIZE;
export const MAP_HEIGHT = MAP_ROWS * TILE_SIZE;

export const FIXED_DT = 1 / 60;
export const MAX_FRAME_DT = 0.05;

/** Tight enough that Wave 1 forces tower vs upgrade choices. */
export const STARTING_GOLD = 220;
export const STARTING_LIVES = 25;
export const INTEREST_RATE = 0.03;
export const INTEREST_CAP = 50;
export const WAVE_CLEAR_BONUS_BASE = 50;
export const FLAWLESS_BONUS = 85;
export const SELL_REFUND_RATIO = 0.7;

/** Soft reference for campaign mode (endless ignores this). */
export const MAX_WAVES_CAMPAIGN = 50;
/** Preparation timer before each wave (seconds). */
export const PREPARE_SECONDS = 20;
/** Milestone cadence (also configurable via WaveGenConfig). */
export const ELITE_EVERY = 5;
export const MINIBOSS_EVERY = 10;
export const BOSS_EVERY = 25;

export const CAMERA_MIN_ZOOM = 0.45;
export const CAMERA_MAX_ZOOM = 2.2;
export const CAMERA_DEFAULT_ZOOM = 0.85;
export const CAMERA_PAN_SPEED = 900;

export const GAME_SPEEDS = [0, 1, 2, 4] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];

export const POOL_SIZES = {
  projectiles: 800,
  particles: 4000,
  damageNumbers: 320,
  floatingTexts: 80,
  enemies: 560,
} as const;
