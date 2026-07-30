import {
  ART_STYLES,
  ArtStyleId,
  DEFAULT_ART_STYLE,
} from '../config/artThemes';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../config/constants';
import { PATH_THEMES, PathThemeId, TowerSkinId, TOWER_SKINS } from '../config/cosmetics';
import { TOWER_DEFS, TowerType } from '../config/towers';
import { Enemy } from '../entities/enemy';
import { Projectile } from '../entities/projectile';
import { Tower } from '../entities/tower';
import { MapData, TileType } from '../systems/map';
import { ParticleSystem } from '../systems/particles';
import { Camera } from './camera';
import { getSpriteAtlas, invalidateSpriteAtlas, SpriteAtlas } from './sprites';

const BASE_TILE_COLORS: Record<TileType, [string, string]> = {
  grass: ['#3d6b3a', '#4a7a45'],
  road: ['#8b7355', '#9a8464'],
  water: ['#3a7a8e', '#4a8fa4'],
  rock: ['#6a6a5e', '#7c7c70'],
  buildable: ['#457848', '#528a55'],
  spawn: ['#a86a3a', '#c08048'],
  base: ['#5a6a58', '#6a7c68'],
  decor: ['#3d6b3a', '#4a7a45'],
  gap: ['#2a4a58', '#345868'],
};

/** Deuteranopia-friendly map palette (blue/orange/gray emphasis). */
const CB_TILE_COLORS: Record<TileType, [string, string]> = {
  grass: ['#3a4a55', '#4a5a65'],
  road: ['#8a7048', '#9a8058'],
  water: ['#2a5080', '#356090'],
  rock: ['#606068', '#707078'],
  buildable: ['#3a5560', '#4a6570'],
  spawn: ['#b06030', '#c07040'],
  base: ['#406080', '#507090'],
  decor: ['#3a4a55', '#4a5a65'],
  gap: ['#1a3048', '#243c58'],
};

/** Canvas renderer — procedural pixel sprites, shadows, glow, minimap. */
export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private minimapCanvas: HTMLCanvasElement | null = null;
  private minimapCtx: CanvasRenderingContext2D | null = null;
  private dayNight = 0.3; // 0 day … 1 night
  private weather = 0; // rain intensity
  private animTime = 0;
  private dpr = 1;
  private atlas: SpriteAtlas;
  private _artStyle: ArtStyleId = DEFAULT_ART_STYLE;
  graphicsQuality: 'low' | 'medium' | 'high' = 'high';
  colorblind = false;
  reduceMotion = false;
  pathTheme: PathThemeId = 'ironwood';
  towerSkin: TowerSkinId = 'default';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D unavailable');
    this.ctx = ctx;
    this.atlas = getSpriteAtlas(this._artStyle);
  }

  get artStyle(): ArtStyleId {
    return this._artStyle;
  }

  set artStyle(id: ArtStyleId) {
    if (this._artStyle === id) return;
    this._artStyle = id;
    invalidateSpriteAtlas();
    this.atlas = getSpriteAtlas(id);
  }

  attachMinimap(canvas: HTMLCanvasElement): void {
    this.minimapCanvas = canvas;
    this.minimapCtx = canvas.getContext('2d');
  }

  /** PNG data URL of the current backbuffer (for screenshot / photo mode). */
  capturePng(): string {
    return this.canvas.toDataURL('image/png');
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  resize(w: number, h: number, dpr: number): void {
    this.dpr = dpr;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  setEnvironment(dayNight: number, weather: number): void {
    this.dayNight = dayNight;
    this.weather = weather;
  }

  render(params: {
    camera: Camera;
    map: MapData;
    towers: Tower[];
    enemies: Enemy[];
    projectiles: Projectile[];
    particles: ParticleSystem;
    selectedTower: Tower | null;
    ghostType: TowerType | null;
    ghostX: number;
    ghostY: number;
    ghostValid: boolean;
    ghostReason?: string | null;
    abilityTargeting: boolean;
    showAllRanges: boolean;
    ghostInBounds: boolean;
    dt: number;
  }): void {
    const { camera, map } = params;
    this.animTime += params.dt;
    const ctx = this.ctx;
    const dpr = this.dpr;

    // Clear full buffer, then paint play-area backdrop inside HUD insets
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0c100d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const { left, top, right, bottom } = camera.insets;
    const playX = left;
    const playY = top;
    const playW = camera.viewW;
    const playH = camera.viewH;

    ctx.fillStyle = '#121a14';
    ctx.fillRect(playX * dpr, playY * dpr, playW * dpr, playH * dpr);

    // Clip world draw to the safe play rect so nothing bleeds under chrome
    ctx.save();
    ctx.beginPath();
    ctx.rect(playX * dpr, playY * dpr, playW * dpr, playH * dpr);
    ctx.clip();

    camera.applyTransform(ctx, dpr);

    this.drawMap(map);
    this.drawDecor(map);
    this.drawPathGlow(map);

    // Shadows under towers/enemies
    if (this.graphicsQuality !== 'low') {
      for (const t of params.towers) {
        if (!t.active) continue;
        this.drawShadow(t.x, t.y + 6, 16);
      }
      for (const e of params.enemies) {
        if (!e.active) continue;
        this.drawShadow(e.x, e.y + 4, e.radius * 0.9);
      }
    }

    for (const t of params.towers) {
      if (t.active) {
        this.drawTower(t, params.selectedTower?.id === t.id, params.showAllRanges);
      }
    }

    if (params.ghostType && params.ghostInBounds) {
      this.drawGhost(
        params.ghostType,
        params.ghostX,
        params.ghostY,
        params.ghostValid,
        params.ghostReason ?? null,
      );
    }

    if (params.abilityTargeting && params.ghostInBounds) {
      ctx.strokeStyle = 'rgba(255,100,60,0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(params.ghostX, params.ghostY, 100, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const e of params.enemies) {
      if (e.active) this.drawEnemy(e);
    }

    for (const p of params.projectiles) {
      if (p.active) this.drawProjectile(p);
    }

    // Laser beams
    for (const t of params.towers) {
      if (t.active && t.beamActive) this.drawBeam(t, params.enemies);
    }

    params.particles.render(ctx);

    this.drawSpawnBaseMarkers(map);

    // Day/night overlay
    if (this.dayNight > 0.05 && this.graphicsQuality === 'high') {
      ctx.fillStyle = `rgba(10, 16, 40, ${this.dayNight * 0.35})`;
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    }

    // Weather
    if (this.weather > 0.05 && this.graphicsQuality !== 'low') {
      this.drawRain(camera);
    }

    ctx.restore(); // end play-area clip

    this.drawMinimap(map, params.towers, params.enemies, camera);
  }

  private tileColors(): Record<TileType, [string, string]> {
    if (this.colorblind) return CB_TILE_COLORS;
    const art = ART_STYLES[this._artStyle] ?? ART_STYLES.cozyForest;
    const path = PATH_THEMES[this.pathTheme] ?? PATH_THEMES.ironwood;
    // Path theme tints the art-style base (keeps cozy structure, swaps mood).
    return {
      ...BASE_TILE_COLORS,
      grass: path.tiles.grass,
      road: path.tiles.road,
      buildable: path.tiles.buildable,
      water: path.tiles.water,
      rock: art.tiles.rock,
      spawn: art.tiles.spawn,
      base: art.tiles.base,
      decor: path.tiles.grass,
      gap: [shadeHex(path.tiles.water[0]!, -20), shadeHex(path.tiles.water[1]!, -15)],
    };
  }

  private drawMap(map: MapData): void {
    const TILE_COLORS = this.tileColors();
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.tiles[r]![c]!;
        const colors = TILE_COLORS[tile];
        const x = c * TILE_SIZE;
        const y = r * TILE_SIZE;
        const checker = (c + r) % 2 === 0;
        const base = checker ? colors[0]! : colors[1]!;

        ctx.fillStyle = base;
        ctx.fillRect(x, y, TILE_SIZE + 0.5, TILE_SIZE + 0.5);

        // Pixel depth band at bottom of tile
        ctx.fillStyle = shadeHex(base, -18);
        ctx.fillRect(x, y + TILE_SIZE - 6, TILE_SIZE + 0.5, 6);

        if ((tile === 'grass' || tile === 'buildable' || tile === 'decor') && this.graphicsQuality !== 'low') {
          // Speckle blades / moss pixels
          const seed = (c * 17 + r * 31) & 7;
          ctx.fillStyle = shadeHex(base, 22);
          if (seed === 0) ctx.fillRect(x + 10, y + 12, 3, 3);
          if (seed === 2) ctx.fillRect(x + 28, y + 20, 2, 4);
          if (seed === 4) ctx.fillRect(x + 18, y + 8, 4, 2);
          if (tile === 'buildable') {
            ctx.strokeStyle = 'rgba(212, 180, 100, 0.22)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
          }
        }

        if (tile === 'road') {
          ctx.fillStyle = shadeHex(base, 16);
          ctx.fillRect(x + 8, y + 22, TILE_SIZE - 16, 3);
          ctx.fillStyle = shadeHex(base, -22);
          if ((c + r) % 3 === 0) ctx.fillRect(x + 14, y + 14, 4, 3);
          if ((c * 3 + r) % 4 === 0) ctx.fillRect(x + 30, y + 28, 5, 3);
        }

        if ((tile === 'water' || tile === 'gap') && this.graphicsQuality !== 'low') {
          const shimmer = 0.1 + Math.sin(this.animTime * 2 + c * 0.4 + r * 0.7) * 0.05;
          ctx.fillStyle = `rgba(200,230,240,${shimmer})`;
          ctx.fillRect(x + 6, y + 10, 10, 3);
          ctx.fillRect(x + 22, y + 28, 14, 3);
          if (tile === 'gap') {
            ctx.strokeStyle = 'rgba(220,200,120,0.4)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            ctx.setLineDash([]);
          }
        }
        if (tile === 'rock') {
          ctx.fillStyle = shadeHex(colors[0]!, -20);
          ctx.fillRect(x + 10, y + 20, 28, 16);
          ctx.fillStyle = colors[1]!;
          ctx.fillRect(x + 8, y + 14, 22, 14);
          ctx.fillStyle = shadeHex(colors[1]!, 25);
          ctx.fillRect(x + 12, y + 16, 6, 4);
        }
      }
    }
  }

  private drawDecor(map: MapData): void {
    const ctx = this.ctx;
    const art = ART_STYLES[this._artStyle] ?? ART_STYLES.cozyForest;
    const dpal = art.decor;
    ctx.imageSmoothingEnabled = false;
    for (const d of map.decor) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.scale(d.scale, d.scale);
      if (d.kind === 0) {
        // Pixel pine / round canopy tree
        ctx.fillStyle = dpal.trunk;
        ctx.fillRect(-2, 2, 4, 10);
        ctx.fillStyle = dpal.leafDark;
        ctx.fillRect(-8, -6, 16, 10);
        ctx.fillStyle = dpal.leafMid;
        ctx.fillRect(-6, -12, 12, 8);
        ctx.fillStyle = dpal.leafLite;
        ctx.fillRect(-3, -14, 6, 4);
        ctx.fillRect(-5, -8, 3, 3);
      } else if (d.kind === 1) {
        ctx.fillStyle = dpal.bush;
        ctx.fillRect(-7, -2, 8, 6);
        ctx.fillRect(-1, -4, 8, 7);
        ctx.fillStyle = dpal.leafLite;
        ctx.fillRect(-5, -3, 3, 2);
      } else if (d.kind === 2) {
        ctx.fillStyle = this.colorblind ? '#e0c040' : dpal.flower;
        ctx.fillRect(-2, -2, 4, 4);
        ctx.fillStyle = '#f0e080';
        ctx.fillRect(-1, -1, 2, 2);
      } else if (d.kind === 3) {
        ctx.fillStyle = dpal.reed;
        ctx.fillRect(0, -8, 2, 14);
        ctx.fillRect(3, -6, 2, 10);
      } else {
        ctx.fillStyle = dpal.pebble;
        ctx.fillRect(-3, 0, 6, 3);
        ctx.fillStyle = shadeHex(dpal.pebble, 20);
        ctx.fillRect(-2, -1, 3, 2);
      }
      ctx.restore();
    }
  }

  private drawPathGlow(map: MapData): void {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const lanes = map.paths?.length ? map.paths : [map.path];

    for (let li = 0; li < lanes.length; li++) {
      const lane = lanes[li]!;
      ctx.strokeStyle = li === 0 ? 'rgba(30, 22, 14, 0.35)' : 'rgba(30, 22, 14, 0.22)';
      ctx.lineWidth = li === 0 ? 30 : 24;
      ctx.beginPath();
      for (let i = 0; i < lane.length; i++) {
        const p = lane[i]!;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      ctx.strokeStyle = li === 0 ? 'rgba(196, 163, 90, 0.22)' : 'rgba(160, 180, 200, 0.18)';
      ctx.lineWidth = 16;
      ctx.stroke();
    }

    // Bridge / gap markers
    for (const slot of map.bridgeSlots ?? []) {
      const x = slot.c * 48 + 24;
      const y = slot.r * 48 + 24;
      ctx.strokeStyle = slot.built ? 'rgba(196,163,90,0.7)' : 'rgba(100,180,220,0.55)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 18, y - 18, 36, 36);
      if (!slot.built) {
        ctx.fillStyle = 'rgba(80,140,180,0.2)';
        ctx.fillRect(x - 18, y - 18, 36, 36);
      }
    }
  }

  private drawSpawnBaseMarkers(map: MapData): void {
    const ctx = this.ctx;
    const pulse = 0.45 + Math.sin(this.animTime * 2.4) * 0.25;
    ctx.imageSmoothingEnabled = false;

    // Spawn — timber gate posts
    ctx.save();
    ctx.translate(map.spawn.x, map.spawn.y);
    ctx.fillStyle = `rgba(180, 100, 50, ${0.15 + pulse * 0.12})`;
    ctx.fillRect(-18, -18, 36, 36);
    ctx.fillStyle = '#5a3420';
    ctx.fillRect(-16, -10, 6, 20);
    ctx.fillRect(10, -10, 6, 20);
    ctx.fillStyle = '#8a5a30';
    ctx.fillRect(-16, -12, 6, 3);
    ctx.fillRect(10, -12, 6, 3);
    ctx.fillStyle = '#c4a35a';
    ctx.fillRect(-10, -14, 20, 3);
    ctx.restore();

    // Bastion keep — chunky pixel castle
    ctx.save();
    ctx.translate(map.base.x, map.base.y);
    ctx.fillStyle = '#3a453c';
    ctx.fillRect(-18, -6, 36, 20);
    ctx.fillRect(-12, -18, 24, 14);
    // battlements
    ctx.fillStyle = '#4a554c';
    for (let i = -12; i <= 8; i += 8) ctx.fillRect(i, -22, 5, 5);
    ctx.fillStyle = '#c4a35a';
    ctx.fillRect(-4, -28, 8, 8);
    ctx.fillStyle = '#d8c07a';
    ctx.fillRect(-2, -8, 4, 10);
    ctx.fillStyle = '#2a322c';
    ctx.fillRect(-3, 0, 6, 8);
    ctx.restore();
  }

  private drawShadow(x: number, y: number, r: number): void {
    const ctx = this.ctx;
    const art = ART_STYLES[this._artStyle] ?? ART_STYLES.cozyForest;
    ctx.fillStyle = art.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, r * 0.95, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawTower(t: Tower, selected: boolean, showRange: boolean): void {
    const ctx = this.ctx;
    const def = TOWER_DEFS[t.type];
    const recoil = t.recoil * 4;

    if (!t.isWall && (selected || showRange) && t.stats.range > 0) {
      ctx.strokeStyle = selected ? 'rgba(196,163,90,0.5)' : 'rgba(200,200,200,0.18)';
      ctx.fillStyle = selected ? 'rgba(196,163,90,0.08)' : 'rgba(200,200,200,0.035)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.stats.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(t.x, t.y);

    if (!t.isWall) {
      // Level pips
      for (let i = 0; i < t.level; i++) {
        ctx.fillStyle = i === t.level - 1 ? def.accent : shadeHex(def.accent, -30);
        ctx.fillRect(-12 + i * 5, 18, 4, 3);
      }
    }

    if (selected) {
      ctx.strokeStyle = 'rgba(196,163,90,0.7)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, t.isWall ? 20 : 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (!t.isWall) {
      ctx.rotate(t.angle);
      ctx.translate(-recoil, 0);
    }

    const clip = t.attacking ? `tower:${t.type}:attack` : `tower:${t.type}:idle`;
    this.atlas.draw(ctx, clip, t.animTime, {
      reduceMotion: this.reduceMotion,
      scale: t.isWall ? 1.05 : 1.1,
      flash: t.muzzleFlash,
    });

    const skin = TOWER_SKINS[this.towerSkin];
    if (skin?.tint) {
      ctx.fillStyle = skin.tint;
      ctx.beginPath();
      ctx.arc(0, 0, t.isWall ? 16 : 14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private drawGhost(
    type: TowerType,
    x: number,
    y: number,
    valid: boolean,
    reason: string | null,
  ): void {
    const def = TOWER_DEFS[type];
    const ctx = this.ctx;
    const snapPad = TILE_SIZE * 0.45;
    ctx.strokeStyle = valid ? 'rgba(120,255,140,0.65)' : 'rgba(255,80,80,0.65)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - snapPad, y - snapPad, snapPad * 2, snapPad * 2);

    ctx.globalAlpha = 0.55;
    if (!def.isWall && def.base.range > 0) {
      ctx.fillStyle = valid ? 'rgba(120,255,140,0.1)' : 'rgba(255,80,80,0.1)';
      ctx.beginPath();
      ctx.arc(x, y, def.base.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(x, y);
    this.atlas.draw(ctx, `tower:${type}:idle`, this.animTime, {
      reduceMotion: this.reduceMotion,
      scale: 1.1,
    });
    ctx.restore();
    ctx.globalAlpha = 1;

    if (!valid && reason) {
      ctx.font = '600 12px Sora, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      const tw = ctx.measureText(reason).width + 12;
      ctx.fillRect(x - tw / 2, y - 42, tw, 18);
      ctx.fillStyle = '#ffb0a8';
      ctx.fillText(reason, x, y - 29);
      ctx.textAlign = 'start';
    }
  }

  private drawEnemy(e: Enemy): void {
    const ctx = this.ctx;
    if (e.invisible && !e.isRevealed) {
      ctx.globalAlpha = 0.4;
    } else if (e.invisible) {
      ctx.globalAlpha = 0.75;
    }

    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.hitFlash > 0) {
      ctx.filter = 'brightness(1.8)';
    }
    const scale = Math.max(0.85, e.radius / 11);
    this.atlas.draw(ctx, `enemy:${e.type}:walk`, e.animTime, {
      reduceMotion: this.reduceMotion,
      scale,
    });
    ctx.filter = 'none';

    // Status rings
    if (e.status.slowTimer > 0 || e.status.freezeTimer > 0) {
      ctx.strokeStyle = 'rgba(150,220,255,0.8)';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.status.poisonTimer > 0) {
      ctx.strokeStyle = 'rgba(100,255,80,0.7)';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shield
    if (e.shield > 0) {
      ctx.strokeStyle = `rgba(100,200,255,${0.4 + (e.shield / e.maxShield) * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // HP bar
    const barW = Math.max(20, e.radius * 2.2);
    const hpPct = e.hp / e.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(-barW / 2, -e.radius - 10, barW, 4);
    ctx.fillStyle = hpPct > 0.5 ? '#5dcf6e' : hpPct > 0.25 ? '#e0c040' : '#e05050';
    ctx.fillRect(-barW / 2, -e.radius - 10, barW * hpPct, 4);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawProjectile(p: Projectile): void {
    const ctx = this.ctx;

    // Ribbon trail
    if (p.trailPoints.length > 1 && this.graphicsQuality !== 'low') {
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1.5, p.radius * 0.7);
      ctx.globalAlpha = 0.35;
      ctx.lineCap = 'round';
      ctx.moveTo(p.trailPoints[0]!.x, p.trailPoints[0]!.y);
      for (let i = 1; i < p.trailPoints.length; i++) {
        ctx.globalAlpha = 0.15 + (i / p.trailPoints.length) * 0.4;
        ctx.lineTo(p.trailPoints[i]!.x, p.trailPoints[i]!.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(p.vy, p.vx));
    ctx.fillStyle = p.color;
    ctx.imageSmoothingEnabled = false;
    if (this.graphicsQuality === 'high') {
      ctx.shadowBlur = 6;
      ctx.shadowColor = p.color;
    }

    switch (p.towerType) {
      case 'arrow':
      case 'sniper':
        // Pixel bolt
        ctx.fillRect(-6, -2, 12, 4);
        ctx.fillStyle = '#fff8d0';
        ctx.fillRect(4, -1, 6, 2);
        ctx.fillStyle = shadeHex(p.color, -30);
        ctx.fillRect(-8, -3, 3, 6);
        break;
      case 'cannon':
        ctx.fillRect(-6, -3, 10, 6);
        ctx.fillRect(3, -2, 5, 4);
        ctx.fillStyle = shadeHex(p.color, 30);
        ctx.fillRect(-4, -2, 3, 2);
        break;
      case 'rocket':
        ctx.fillRect(-6, -3, 10, 6);
        ctx.fillStyle = '#ff8844';
        ctx.fillRect(-10, -2, 4, 4);
        ctx.fillStyle = p.color;
        ctx.fillRect(3, -2, 5, 4);
        break;
      case 'magic':
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'poison':
        ctx.beginPath();
        ctx.arc(0, -1, p.radius + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(0, 4, 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'freeze':
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          const r = i % 2 === 0 ? p.radius + 3 : p.radius;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        break;
      default:
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  private drawBeam(tower: Tower, enemies: Enemy[]): void {
    const target = enemies.find((e) => e.id === tower.beamTargetId && e.active);
    if (!target) return;
    const ctx = this.ctx;
    const pulse = 2 + tower.beamRamp;
    ctx.strokeStyle = `rgba(255,60,90,${0.55 + Math.sin(this.animTime * 20) * 0.2})`;
    ctx.lineWidth = pulse;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff4d6d';
    ctx.beginPath();
    ctx.moveTo(tower.x, tower.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,200,200,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(tower.x, tower.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  private drawRain(camera: Camera): void {
    const ctx = this.ctx;
    const count = Math.floor(80 * this.weather);
    ctx.strokeStyle = 'rgba(180,200,220,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < count; i++) {
      const x = ((i * 97 + this.animTime * 220) % MAP_WIDTH);
      const y = ((i * 53 + this.animTime * 480) % MAP_HEIGHT);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 2, y + 10);
      ctx.stroke();
    }
    void camera;
  }

  private drawMinimap(
    map: MapData,
    towers: Tower[],
    enemies: Enemy[],
    camera: Camera,
  ): void {
    if (!this.minimapCtx || !this.minimapCanvas) return;
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;
    const sx = w / MAP_WIDTH;
    const sy = h / MAP_HEIGHT;

    ctx.fillStyle = '#152218';
    ctx.fillRect(0, 0, w, h);

    // Path
    ctx.strokeStyle = '#8a7a5a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < map.path.length; i++) {
      const p = map.path[i]!;
      if (i === 0) ctx.moveTo(p.x * sx, p.y * sy);
      else ctx.lineTo(p.x * sx, p.y * sy);
    }
    ctx.stroke();

    ctx.fillStyle = '#6af';
    for (const t of towers) {
      if (!t.active) continue;
      ctx.fillRect(t.x * sx - 1.5, t.y * sy - 1.5, 3, 3);
    }
    ctx.fillStyle = '#f44';
    for (const e of enemies) {
      if (!e.active) continue;
      ctx.fillRect(e.x * sx - 1, e.y * sy - 1, 2, 2);
    }

    // Camera rect (safe play area)
    const vw = camera.viewW / camera.zoom;
    const vh = camera.viewH / camera.zoom;
    ctx.strokeStyle = '#c4a35a';
    ctx.lineWidth = 1;
    ctx.strokeRect((camera.x - vw / 2) * sx, (camera.y - vh / 2) * sy, vw * sx, vh * sy);
  }

  private cbColor(c: string): string {
    // Shift reds/greens for deuteranopia-friendly accents
    if (c.startsWith('#') && c.length >= 7) {
      const r = parseInt(c.slice(1, 3), 16);
      const g = parseInt(c.slice(3, 5), 16);
      const b = parseInt(c.slice(5, 7), 16);
      const nr = Math.min(255, Math.round(r * 0.8 + b * 0.2));
      const ng = Math.min(255, Math.round(g * 0.5 + b * 0.4));
      return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    return c;
  }
}

/** Lighten/darken a hex color by delta (-255…255). */
function shadeHex(hex: string, delta: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  const clampByte = (v: number) => Math.max(0, Math.min(255, v));
  const r = clampByte(parseInt(hex.slice(1, 3), 16) + delta);
  const g = clampByte(parseInt(hex.slice(3, 5), 16) + delta);
  const b = clampByte(parseInt(hex.slice(5, 7), 16) + delta);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
