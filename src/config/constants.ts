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

export const STARTING_GOLD = 250;
export const STARTING_LIVES = 25;
export const INTEREST_RATE = 0.03;
export const INTEREST_CAP = 50;
export const WAVE_CLEAR_BONUS_BASE = 40;
export const FLAWLESS_BONUS = 75;
export const SELL_REFUND_RATIO = 0.7;

export const MAX_WAVES_CAMPAIGN = 50;
/** Bastion Approach vertical slice — one wave, then victory. */
export const MAX_WAVES_VERTICAL_SLICE = 1;
export const PREPARE_SECONDS = 30;
export const BOSS_EVERY = 10;

export const CAMERA_MIN_ZOOM = 0.45;
export const CAMERA_MAX_ZOOM = 2.2;
export const CAMERA_DEFAULT_ZOOM = 0.85;
export const CAMERA_PAN_SPEED = 900;

export const GAME_SPEEDS = [0, 1, 2, 4] as const;
export type GameSpeed = (typeof GAME_SPEEDS)[number];

export const POOL_SIZES = {
  projectiles: 400,
  particles: 2000,
  damageNumbers: 200,
  floatingTexts: 80,
} as const;
