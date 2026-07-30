/**
 * Procedural pixel-art atlas for towers & enemies.
 * Default style: Cozy Forest. Art style can be swapped later without changing draw calls.
 */

import { ArtStyleId, ART_STYLES, DEFAULT_ART_STYLE } from '../config/artThemes';
import { ENEMY_DEFS, EnemyType } from '../config/enemies';
import { TOWER_DEFS, TowerType, TOWER_ORDER } from '../config/towers';
import { mix, PixelBuf, shade } from './pixelPaint';

export interface SpriteFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface AnimClip {
  frames: SpriteFrame[];
  fps: number;
}

/** Atlas cell size in canvas pixels. */
const CELL = 48;
/** Logical pixel size inside a cell (24×24 grid). */
const PX = 2;
const GRID = CELL / PX; // 24

export class SpriteAtlas {
  readonly canvas: HTMLCanvasElement;
  private clips = new Map<string, AnimClip>();

  constructor(width: number, height: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
  }

  getCtx(): CanvasRenderingContext2D {
    const ctx = this.canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    return ctx;
  }

  setClip(key: string, clip: AnimClip): void {
    this.clips.set(key, clip);
  }

  getClip(key: string): AnimClip | null {
    return this.clips.get(key) ?? null;
  }

  frameAt(key: string, time: number, reduceMotion = false): SpriteFrame | null {
    const clip = this.clips.get(key);
    if (!clip || clip.frames.length === 0) return null;
    if (reduceMotion) return clip.frames[0]!;
    const idx = Math.floor(time * clip.fps) % clip.frames.length;
    return clip.frames[idx]!;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    key: string,
    time: number,
    opts?: { reduceMotion?: boolean; scale?: number; flash?: number },
  ): void {
    const frame = this.frameAt(key, time, opts?.reduceMotion);
    if (!frame) return;
    const scale = opts?.scale ?? 1;
    const w = frame.sw * scale;
    const h = frame.sh * scale;
    const prev = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, frame.sx, frame.sy, frame.sw, frame.sh, -w / 2, -h / 2, w, h);
    ctx.imageSmoothingEnabled = prev;
    if (opts?.flash && opts.flash > 0) {
      ctx.fillStyle = `rgba(255,240,180,${opts.flash * 0.65})`;
      ctx.beginPath();
      ctx.arc(w * 0.3, 0, 4 + opts.flash * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintBasePad(buf: PixelBuf, outline: string): void {
  // Circular wooden / stone pad under towers
  buf.fillEllipse(12, 18, 8, 3, '#4a3a28');
  buf.fillEllipse(12, 17, 7, 2, '#6a5238');
  buf.set(12, 16, '#8a6a48');
  // faint outline ring pixels
  for (const [x, y] of [
    [5, 18],
    [19, 18],
    [12, 15],
    [12, 20],
  ] as const) {
    if (!buf.get(x, y)) buf.set(x, y, outline);
  }
}

function paintTowerPixels(
  type: TowerType,
  phase: number,
  attack: boolean,
  outline: string,
): PixelBuf {
  const buf = new PixelBuf(GRID, GRID);
  const def = TOWER_DEFS[type];
  const body = def.color;
  const accent = def.accent;
  const dark = shade(body, -35);
  const lite = shade(body, 35);
  const bob = Math.round(Math.sin(phase * Math.PI * 2));
  const kick = attack ? 1 : 0;

  if (type !== 'wall') paintBasePad(buf, outline);

  const ox = 12 - kick;
  const oy = 11 + bob;

  switch (type) {
    case 'arrow': {
      // Timber watch post + bow
      buf.fillRect(ox - 2, oy - 2, 5, 8, body);
      buf.fillRect(ox - 1, oy - 3, 3, 2, lite);
      buf.fillRect(ox - 3, oy + 5, 7, 2, dark);
      // bow
      buf.set(ox + 3, oy - 1, accent);
      buf.set(ox + 4, oy, accent);
      buf.set(ox + 5, oy + 1, accent);
      buf.set(ox + 4, oy + 2, accent);
      buf.set(ox + 3, oy + 3, accent);
      if (attack) {
        buf.set(ox + 6, oy + 1, '#f0e0a0');
        buf.set(ox + 7, oy + 1, '#f0e0a0');
      } else {
        buf.set(ox + 4, oy + 1, '#c4a070');
      }
      break;
    }
    case 'cannon': {
      buf.fillRect(ox - 4, oy - 2, 7, 8, body);
      buf.fillRect(ox - 3, oy - 3, 5, 2, lite);
      buf.fillRect(ox - 4, oy + 5, 7, 2, dark);
      buf.fillRect(ox + 2, oy, 7 + (attack ? 1 : 0), 3, accent);
      buf.set(ox + 8 + (attack ? 1 : 0), oy + 1, lite);
      break;
    }
    case 'magic': {
      buf.fillRect(ox - 3, oy + 3, 7, 3, dark);
      buf.fillEllipse(ox, oy, 4, 4, body);
      buf.fillEllipse(ox - 1, oy - 1, 2, 2, lite);
      buf.set(ox + 1, oy - 2, accent);
      buf.set(ox + 2, oy - 3, accent);
      if (attack || phase > 0.5) {
        buf.set(ox + 3, oy - 4, '#fff8c0');
        buf.set(ox - 3, oy + 1, accent);
      }
      break;
    }
    case 'sniper': {
      buf.fillRect(ox - 2, oy - 1, 5, 6, body);
      buf.fillRect(ox - 1, oy - 2, 3, 1, lite);
      buf.fillRect(ox + 2, oy + 1, 9, 2, accent);
      buf.set(ox + 10, oy + 1, lite);
      if (attack) buf.set(ox + 11, oy + 1, '#fff');
      break;
    }
    case 'poison': {
      // Cauldron / flask
      buf.fillRect(ox - 3, oy + 1, 7, 5, body);
      buf.fillRect(ox - 2, oy, 5, 2, lite);
      buf.fillRect(ox - 1, oy - 2, 3, 2, accent);
      buf.set(ox, oy - 3, shade(accent, 40));
      if (attack) {
        buf.set(ox - 2, oy - 4, accent);
        buf.set(ox + 2, oy - 5, accent);
      }
      break;
    }
    case 'freeze': {
      buf.fillRect(ox - 3, oy - 2, 7, 8, body);
      buf.fillRect(ox - 2, oy - 3, 5, 2, lite);
      // crystal shards
      buf.set(ox, oy - 4, accent);
      buf.set(ox - 2, oy, accent);
      buf.set(ox + 2, oy + 1, accent);
      buf.set(ox, oy + 2, shade(accent, 30));
      if (attack) {
        buf.set(ox - 3, oy - 1, '#e0f8ff');
        buf.set(ox + 3, oy - 2, '#e0f8ff');
      }
      break;
    }
    case 'tesla': {
      buf.fillRect(ox - 3, oy - 1, 7, 7, body);
      buf.fillRect(ox - 2, oy - 2, 5, 2, lite);
      buf.set(ox, oy - 4, accent);
      buf.set(ox - 1, oy - 3, accent);
      buf.set(ox + 1, oy - 3, accent);
      if (attack) {
        buf.set(ox - 3, oy - 5, '#ffffa0');
        buf.set(ox + 3, oy - 4, '#ffffa0');
        buf.set(ox, oy - 6, '#fff');
      }
      break;
    }
    case 'laser': {
      buf.fillRect(ox - 3, oy - 2, 6, 8, body);
      buf.fillRect(ox - 2, oy - 3, 4, 2, lite);
      buf.fillRect(ox + 2, oy, 7, 3, accent);
      if (attack) {
        buf.fillRect(ox + 8, oy + 1, 3, 1, '#ff8080');
      }
      break;
    }
    case 'rocket': {
      buf.fillRect(ox - 3, oy - 1, 6, 7, body);
      buf.fillRect(ox - 2, oy - 2, 4, 2, lite);
      // nose
      buf.set(ox + 3, oy + 1, accent);
      buf.set(ox + 4, oy + 2, accent);
      buf.set(ox + 5, oy + 1, accent);
      buf.set(ox + 3, oy + 3, accent);
      if (attack) {
        buf.set(ox - 4, oy + 2, '#ff8844');
        buf.set(ox - 5, oy + 3, '#ffcc66');
      }
      break;
    }
    case 'wall': {
      buf.fillRect(4, 6, 16, 12, body);
      buf.fillRect(4, 6, 16, 2, lite);
      buf.fillRect(4, 16, 16, 2, dark);
      // brick seams
      for (let x = 5; x < 19; x += 4) {
        buf.set(x, 10, dark);
        buf.set(x + 2, 14, dark);
      }
      buf.fillRect(11, 8, 2, 8, accent);
      break;
    }
  }

  buf.outline(outline);
  buf.dropShadow('rgba(20,28,18,0.4)', 1, 1);
  return buf;
}

function paintEnemyPixels(
  type: EnemyType,
  phase: number,
  outline: string,
): PixelBuf {
  const buf = new PixelBuf(GRID, GRID);
  const def = ENEMY_DEFS[type];
  const body = def.color;
  const accent = def.accent;
  const dark = shade(body, -40);
  const lite = mix(body, '#ffffff', 0.25);
  const walk = Math.round(Math.sin(phase * Math.PI * 2));
  const bob = def.flying ? Math.round(Math.sin(phase * Math.PI * 2) * 1.5) : walk;

  const cx = 12;
  const cy = 12 + bob;

  if (def.flying) {
    // Chubby bird / bat
    buf.fillEllipse(cx, cy, 5, 3, body);
    buf.fillEllipse(cx - 1, cy - 1, 2, 1, lite);
    // wings
    const flap = phase < 0.5 ? -1 : 1;
    buf.fillRect(cx - 8, cy + flap, 3, 2, accent);
    buf.fillRect(cx + 5, cy + flap, 3, 2, accent);
    buf.set(cx - 9, cy + flap, dark);
    buf.set(cx + 8, cy + flap, dark);
    // eye / beak
    buf.set(cx + 3, cy - 1, '#1a1a1a');
    buf.set(cx + 4, cy, accent);
  } else if (def.isBoss) {
    // Broad armored bulk
    const s = type === 'boss' ? 1 : 0;
    buf.fillEllipse(cx, cy + 1, 7 + s, 6 + s, body);
    buf.fillEllipse(cx - 1, cy - 1, 3, 2, lite);
    // horns / spikes
    buf.set(cx - 5, cy - 5, accent);
    buf.set(cx - 4, cy - 6, accent);
    buf.set(cx + 4, cy - 5, accent);
    buf.set(cx + 5, cy - 6, accent);
    buf.set(cx, cy - 7, accent);
    // eyes
    buf.set(cx - 2, cy - 1, '#ff4040');
    buf.set(cx + 2, cy - 1, '#ff4040');
    // legs
    buf.fillRect(cx - 5, cy + 6, 2, 3 + walk, dark);
    buf.fillRect(cx + 3, cy + 6, 2, 3 - walk, dark);
  } else {
    // Critter body — type-flavored
    const rx = Math.max(3, Math.min(7, Math.round(def.radius / 2.5)));
    const ry = Math.max(3, Math.min(6, Math.round(def.radius / 3)));

    if (type === 'fast') {
      // Fox-like lean runner
      buf.fillEllipse(cx, cy, 5, 3, body);
      buf.fillRect(cx + 3, cy - 1, 3, 2, body);
      buf.set(cx + 5, cy - 2, accent); // ear tip
      buf.set(cx - 4, cy + 1, accent); // tail tip
      buf.set(cx - 5, cy, accent);
      buf.set(cx + 2, cy - 1, '#1a1a1a');
    } else if (type === 'tank') {
      buf.fillEllipse(cx, cy, 6, 5, body);
      buf.fillEllipse(cx - 1, cy - 1, 2, 2, lite);
      buf.fillRect(cx - 4, cy - 4, 8, 2, dark); // shell ridge
      buf.set(cx + 2, cy - 1, '#1a1a1a');
    } else if (type === 'invisible') {
      buf.fillEllipse(cx, cy, 4, 4, mix(body, '#ffffff', 0.15));
      buf.set(cx + 1, cy - 1, accent);
      // sparkles
      if (phase > 0.3) buf.set(cx - 5, cy - 3, accent);
      if (phase > 0.6) buf.set(cx + 5, cy + 2, accent);
    } else if (type === 'armored') {
      buf.fillEllipse(cx, cy, 5, 4, body);
      buf.fillRect(cx - 4, cy - 3, 8, 2, accent);
      buf.fillRect(cx - 3, cy - 4, 6, 1, lite);
      buf.set(cx + 2, cy, '#1a1a1a');
    } else if (type === 'regenerating') {
      buf.fillEllipse(cx, cy, 5, 4, body);
      buf.fillEllipse(cx - 1, cy - 1, 2, 1, lite);
      buf.set(cx, cy - 4, accent);
      buf.set(cx - 1, cy - 5, accent);
      buf.set(cx + 1, cy - 5, accent);
      buf.set(cx + 2, cy - 1, '#1a1a1a');
    } else if (type === 'shielded') {
      buf.fillEllipse(cx, cy, 5, 4, body);
      // shield bubble pixels
      buf.set(cx - 6, cy, accent);
      buf.set(cx + 6, cy, accent);
      buf.set(cx, cy - 6, accent);
      buf.set(cx, cy + 5, accent);
      buf.set(cx + 2, cy - 1, '#1a1a1a');
    } else {
      // Grunt — round mushroom-capped critter
      buf.fillEllipse(cx, cy + 1, rx, ry, body);
      buf.fillEllipse(cx, cy - 2, rx - 1, 3, accent);
      buf.set(cx - 1, cy - 3, lite);
      buf.set(cx + 1, cy, '#1a1a1a');
      buf.set(cx + 2, cy, '#1a1a1a');
    }

    // Legs (ground units)
    if (type !== 'invisible') {
      buf.fillRect(cx - 3, cy + ry, 2, 2 + walk, dark);
      buf.fillRect(cx + 1, cy + ry, 2, 2 - walk, dark);
    }
  }

  buf.outline(outline);
  buf.dropShadow('rgba(20,28,18,0.35)', 1, 1);
  return buf;
}

let cachedAtlas: SpriteAtlas | null = null;
let cachedStyle: ArtStyleId | null = null;

export function invalidateSpriteAtlas(): void {
  cachedAtlas = null;
  cachedStyle = null;
}

/** Build (once per art style) the procedural sprite atlas. */
export function getSpriteAtlas(styleId: ArtStyleId = DEFAULT_ART_STYLE): SpriteAtlas {
  if (cachedAtlas && cachedStyle === styleId) return cachedAtlas;

  const style = ART_STYLES[styleId] ?? ART_STYLES.cozyForest;
  const outline = style.outline;

  const towerTypes = TOWER_ORDER;
  const enemyTypes = Object.keys(ENEMY_DEFS) as EnemyType[];
  const idleFrames = 4;
  const attackFrames = 2;
  const cols = Math.max(idleFrames + attackFrames, 4);
  const towerRows = towerTypes.length;
  const enemyRows = enemyTypes.length;
  const atlas = new SpriteAtlas(cols * CELL, (towerRows + enemyRows) * CELL);
  const ctx = atlas.getCtx();
  ctx.clearRect(0, 0, atlas.canvas.width, atlas.canvas.height);
  ctx.imageSmoothingEnabled = false;

  towerTypes.forEach((type, row) => {
    const idle: SpriteFrame[] = [];
    for (let f = 0; f < idleFrames; f++) {
      const sx = f * CELL;
      const sy = row * CELL;
      paintTowerPixels(type, f / idleFrames, false, outline).blit(ctx, sx, sy, PX);
      idle.push({ sx, sy, sw: CELL, sh: CELL });
    }
    atlas.setClip(`tower:${type}:idle`, { frames: idle, fps: 5 });

    const attack: SpriteFrame[] = [];
    for (let f = 0; f < attackFrames; f++) {
      const sx = (idleFrames + f) * CELL;
      const sy = row * CELL;
      paintTowerPixels(type, f / attackFrames, true, outline).blit(ctx, sx, sy, PX);
      attack.push({ sx, sy, sw: CELL, sh: CELL });
    }
    atlas.setClip(`tower:${type}:attack`, { frames: attack, fps: 10 });
  });

  enemyTypes.forEach((type, i) => {
    const row = towerRows + i;
    const walk: SpriteFrame[] = [];
    for (let f = 0; f < idleFrames; f++) {
      const sx = f * CELL;
      const sy = row * CELL;
      paintEnemyPixels(type, f / idleFrames, outline).blit(ctx, sx, sy, PX);
      walk.push({ sx, sy, sw: CELL, sh: CELL });
    }
    atlas.setClip(`enemy:${type}:walk`, { frames: walk, fps: 7 });
  });

  cachedAtlas = atlas;
  cachedStyle = styleId;
  return atlas;
}
