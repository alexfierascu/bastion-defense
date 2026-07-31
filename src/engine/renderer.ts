import {
  ART_STYLES,
  ArtStyleId,
  DEFAULT_ART_STYLE,
} from '../config/artThemes';
import { TILE_SIZE, MAP_WIDTH, MAP_HEIGHT } from '../config/constants';
import { PATH_THEMES, PathThemeId, TowerSkinId, TOWER_SKINS } from '../config/cosmetics';
import { ENEMY_ABILITY_DEFS } from '../config/enemyAbilities';
import { getTowerSpecFlags } from '../config/towerSpecs';
import { TARGETING_LABELS, TOWER_DEFS, TowerType } from '../config/towers';
import { Enemy } from '../entities/enemy';
import { Hero } from '../entities/hero';
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
    selectedEnemy?: Enemy | null;
    hero?: Hero | null;
    selectedHero?: boolean;
    ghostType: TowerType | null;
    ghostX: number;
    ghostY: number;
    ghostValid: boolean;
    ghostReason?: string | null;
    abilityTargeting: boolean;
    showAllRanges: boolean;
    ghostInBounds: boolean;
    dt: number;
    /** Screen flash 0–1 (white sting). */
    hitFlash?: number;
    /** Crit flash 0–1 (gold sting). */
    critFlash?: number;
    /** Boss warning flash 0–1 (red). */
    bossFlash?: number;
    /** Gate-damage vignette 0–1. */
    damageVignette?: number;
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

    this.drawMap(map, !!params.ghostType);
    this.drawDecor(map);
    this.drawPathGlow(map);

    // Shadows under towers/enemies/projectiles
    if (this.graphicsQuality !== 'low') {
      for (const t of params.towers) {
        if (!t.active) continue;
        this.drawShadow(t.x, t.y + 6, 16);
      }
      for (const e of params.enemies) {
        if (!e.active && e.deathFade <= 0) continue;
        const deathT =
          !e.active && e.deathFade > 0
            ? Math.max(0, e.deathFade / Math.max(0.01, e.deathMax))
            : 1;
        this.drawShadow(e.x, e.y + 4, e.radius * 0.9 * (0.35 + deathT * 0.65), deathT);
      }
      for (const p of params.projectiles) {
        if (!p.active) continue;
        const shadowScale = 0.55 + Math.min(1, p.height / 80) * 0.45;
        const a = Math.max(0.2, 0.55 - p.height * 0.004);
        this.drawShadow(p.groundX, p.groundY + 2, p.radius * 1.6 * shadowScale, a);
      }
    }

    for (const t of params.towers) {
      if (t.active) {
        this.drawTower(t, params.selectedTower?.id === t.id, params.showAllRanges);
      }
    }

    if (params.hero) this.drawHero(params.hero, !!params.selectedHero);

    // Aim line from selected tower to its current target
    const sel = params.selectedTower;
    if (sel && sel.active && !sel.isWall) {
      const tgt = sel.selectTarget(params.enemies);
      if (tgt) {
        ctx.strokeStyle = 'rgba(196,163,90,0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(sel.x, sel.y);
        ctx.lineTo(tgt.x, tgt.y);
        ctx.stroke();
        ctx.setLineDash([]);
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
      if (e.active || e.deathFade > 0) this.drawEnemy(e);
    }

    const selEnemy = params.selectedEnemy;
    if (selEnemy && (selEnemy.active || selEnemy.deathFade > 0)) {
      ctx.strokeStyle = selEnemy.selectColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(selEnemy.x, selEnemy.y, selEnemy.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = `${selEnemy.selectColor}99`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(selEnemy.x, selEnemy.y, selEnemy.radius + 14, 0, Math.PI * 2);
      ctx.stroke();
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

    // Soft torch / hearth light pools on Bastion Approach
    if (map.id === 'bastion-approach' && this.graphicsQuality !== 'low') {
      this.drawBastionLights(map);
    }

    // Day/night overlay
    if (this.dayNight > 0.05 && this.graphicsQuality === 'high') {
      const nightA =
        map.id === 'bastion-approach' ? this.dayNight * 0.42 : this.dayNight * 0.35;
      ctx.fillStyle = `rgba(10, 16, 40, ${nightA})`;
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
    }

    // Weather — mist streaks for Bastion, rain for wet maps
    if (this.weather > 0.05 && this.graphicsQuality !== 'low') {
      if (map.id === 'bastion-approach') this.drawMist(camera);
      else this.drawRain(camera);
    }

    ctx.restore(); // end play-area clip

    this.drawMinimap(map, params.towers, params.enemies, camera);
    this.drawScreenFeedback(params, playX, playY, playW, playH, dpr);
  }

  private drawScreenFeedback(
    params: {
      hitFlash?: number;
      critFlash?: number;
      bossFlash?: number;
      damageVignette?: number;
    },
    playX: number,
    playY: number,
    playW: number,
    playH: number,
    dpr: number,
  ): void {
    const ctx = this.ctx;
    const x = playX * dpr;
    const y = playY * dpr;
    const w = playW * dpr;
    const h = playH * dpr;
    const hit = params.hitFlash ?? 0;
    const crit = params.critFlash ?? 0;
    const boss = params.bossFlash ?? 0;
    const vig = params.damageVignette ?? 0;

    if (hit > 0.01) {
      ctx.fillStyle = `rgba(255,255,245,${Math.min(0.18, hit * 0.22)})`;
      ctx.fillRect(x, y, w, h);
    }
    if (crit > 0.01) {
      ctx.fillStyle = `rgba(255,220,120,${Math.min(0.16, crit * 0.2)})`;
      ctx.fillRect(x, y, w, h);
    }
    if (boss > 0.01) {
      ctx.fillStyle = `rgba(180,40,30,${Math.min(0.22, boss * 0.28)})`;
      ctx.fillRect(x, y, w, h);
    }
    if (vig > 0.02) {
      const g = ctx.createRadialGradient(
        x + w * 0.5,
        y + h * 0.5,
        Math.min(w, h) * 0.28,
        x + w * 0.5,
        y + h * 0.5,
        Math.max(w, h) * 0.72,
      );
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(90,12,8,${Math.min(0.55, vig * 0.65)})`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
    }
  }

  private drawBastionLights(map: MapData): void {
    const ctx = this.ctx;
    const pulse = 0.85 + Math.sin(this.animTime * 1.6) * 0.08;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const lights = [
      { x: map.spawn.x, y: map.spawn.y, r: 70, a: 0.12 },
      { x: map.base.x, y: map.base.y, r: 110, a: 0.16 },
      { x: map.base.x - 80, y: map.base.y + 10, r: 55, a: 0.1 },
      { x: 19 * 48 + 24, y: 16 * 48 + 24, r: 50, a: 0.08 }, // bridge lantern
    ];
    for (const L of lights) {
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      g.addColorStop(0, `rgba(255, 180, 90, ${L.a * pulse})`);
      g.addColorStop(0.45, `rgba(220, 120, 40, ${L.a * 0.45 * pulse})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawMist(camera: Camera): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = this.dpr;
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      const t = this.animTime * 0.12 + i * 1.7;
      const x = ((Math.sin(t) * 0.5 + 0.5) * camera.viewW + camera.insets.left) * dpr;
      const y =
        (camera.insets.top + camera.viewH * (0.55 + (i % 5) * 0.08) + Math.cos(t * 0.7) * 12) *
        dpr;
      const w = (80 + (i % 4) * 30) * dpr;
      const g = ctx.createRadialGradient(x, y, 0, x, y, w);
      g.addColorStop(0, `rgba(180, 195, 185, ${0.04 * this.weather})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
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

  private drawMap(map: MapData, highlightBuildable = false): void {
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
            if (highlightBuildable) {
              ctx.fillStyle = 'rgba(120, 220, 140, 0.18)';
              ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
              ctx.strokeStyle = 'rgba(140, 240, 160, 0.5)';
              ctx.lineWidth = 1.5;
            } else {
              // Subtle always-on pad marker
              ctx.fillStyle = 'rgba(196, 163, 90, 0.07)';
              ctx.fillRect(x + 6, y + 6, TILE_SIZE - 12, TILE_SIZE - 12);
              ctx.strokeStyle = 'rgba(212, 180, 100, 0.28)';
              ctx.lineWidth = 1;
            }
            ctx.strokeRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            ctx.fillStyle = highlightBuildable
              ? 'rgba(160, 255, 180, 0.55)'
              : 'rgba(212, 180, 100, 0.35)';
            ctx.beginPath();
            ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 2.2, 0, Math.PI * 2);
            ctx.fill();
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

    if (map.id === 'bastion-approach') {
      this.drawBastionApproachMarkers(map, pulse);
      return;
    }

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

  /** Forest arch entrance + Great Tree bastion — matches title world. */
  private drawBastionApproachMarkers(map: MapData, pulse: number): void {
    const ctx = this.ctx;
    const art = ART_STYLES[this._artStyle] ?? ART_STYLES.cozyForest;

    // Forest entrance — timber arch with warm lantern glow
    ctx.save();
    ctx.translate(map.spawn.x, map.spawn.y);
    ctx.fillStyle = `rgba(255, 170, 80, ${0.1 + pulse * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(0, 4, 28, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = art.decor.trunk;
    ctx.fillRect(-20, -18, 8, 34);
    ctx.fillRect(12, -18, 8, 34);
    ctx.fillStyle = shadeHex(art.decor.trunk, 20);
    ctx.fillRect(-20, -22, 40, 7);
    ctx.fillStyle = art.decor.leafDark;
    ctx.fillRect(-24, -28, 18, 12);
    ctx.fillRect(6, -28, 18, 12);
    ctx.fillStyle = '#c4a35a';
    ctx.fillRect(-6, -20, 12, 3);
    ctx.restore();

    // Great Tree — living keep at the heart of the Bastion
    ctx.save();
    ctx.translate(map.base.x, map.base.y);
    // Warm hearth glow from within the trunk
    ctx.fillStyle = `rgba(255, 160, 70, ${0.14 + pulse * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(0, 8, 36, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    // Roots
    ctx.fillStyle = shadeHex(art.decor.trunk, -15);
    ctx.fillRect(-22, 10, 14, 8);
    ctx.fillRect(8, 12, 16, 6);
    ctx.fillRect(-6, 14, 12, 5);
    // Trunk
    ctx.fillStyle = art.decor.trunk;
    ctx.fillRect(-14, -20, 28, 36);
    ctx.fillStyle = shadeHex(art.decor.trunk, 18);
    ctx.fillRect(-10, -16, 8, 28);
    // Door / gate into the tree
    ctx.fillStyle = '#2a1c12';
    ctx.fillRect(-5, 0, 10, 14);
    ctx.fillStyle = '#c4a35a';
    ctx.fillRect(-1, 4, 2, 6);
    // Canopy
    ctx.fillStyle = art.decor.leafDark;
    ctx.fillRect(-32, -48, 64, 28);
    ctx.fillStyle = art.decor.leafMid;
    ctx.fillRect(-26, -56, 52, 22);
    ctx.fillStyle = art.decor.leafLite;
    ctx.fillRect(-14, -62, 28, 12);
    ctx.fillRect(-20, -44, 10, 8);
    // Stone bastion lip at the roots
    ctx.fillStyle = '#4a554c';
    ctx.fillRect(-28, 16, 56, 8);
    for (let i = -28; i <= 20; i += 12) {
      ctx.fillRect(i, 12, 8, 6);
    }
    ctx.restore();
  }

  private drawShadow(x: number, y: number, r: number, alpha = 1): void {
    const ctx = this.ctx;
    const art = ART_STYLES[this._artStyle] ?? ART_STYLES.cozyForest;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.85;
    ctx.fillStyle = art.shadow;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, r * 0.95, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawHero(h: Hero, selected: boolean): void {
    const ctx = this.ctx;
    const dying = !h.alive && h.deathFade > 0;
    const down = !h.alive && h.deathFade <= 0;
    if (down && h.respawnTimer > 0) {
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.globalAlpha = 0.45;
      ctx.strokeStyle = h.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, h.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = h.accent;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(h.respawnTimer)}s`, 0, -h.radius - 10);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(h.x, h.y);
    if (dying) {
      const t = Math.max(0, Math.min(1, h.deathFade / 0.9));
      ctx.globalAlpha = t;
      ctx.rotate((1 - t) * 1.2);
      ctx.scale(0.5 + t * 0.5, 0.4 + t * 0.6);
    } else if (h.respawnFlash > 0) {
      ctx.globalAlpha = 0.5 + h.respawnFlash * 0.5;
    }

    if (selected && h.alive) {
      ctx.strokeStyle = 'rgba(196,163,90,0.55)';
      ctx.fillStyle = 'rgba(196,163,90,0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, h.attackRange, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    if (h.shieldWallTimer > 0 && h.alive) {
      const pulse = 0.35 + Math.sin(h.animTime * 8) * 0.15;
      ctx.strokeStyle = `rgba(120,180,255,${pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 150, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (h.lastStandTimer > 0 && h.alive) {
      ctx.strokeStyle = `rgba(255,180,60,${0.4 + Math.sin(h.animTime * 10) * 0.2})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, h.radius + 16, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Selection ring
    if (selected && h.alive) {
      ctx.strokeStyle = h.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(0, 0, h.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const bob =
      h.anim === 'walk' ? Math.sin(h.animTime * 12) * 2 : Math.sin(h.animTime * 3) * 0.5;
    const lean = h.anim === 'attack' ? 3 : 0;

    ctx.rotate(h.angle * 0.15);
    // Body
    ctx.fillStyle = h.hurtFlash > 0 ? '#fff' : h.color;
    ctx.beginPath();
    ctx.ellipse(lean, bob, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Cape / accent
    ctx.fillStyle = h.accent;
    ctx.fillRect(-6, bob - 2, 4, 10);
    // Helm
    ctx.fillStyle = '#2a3238';
    ctx.beginPath();
    ctx.ellipse(lean, bob - 10, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = h.accent;
    ctx.fillRect(lean - 2, bob - 14, 4, 3);
    // Shield
    ctx.fillStyle = '#8ec8ff';
    ctx.beginPath();
    ctx.ellipse(lean + 8, bob + 2, 4, 7, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Sword swing
    if (h.attackFlash > 0) {
      ctx.strokeStyle = '#f0e0a0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lean + 4, bob - 4);
      ctx.lineTo(lean + 16 + h.attackFlash * 10, bob - 10);
      ctx.stroke();
    }
    // Legs
    if (h.anim === 'walk') {
      const s = Math.sin(h.animTime * 12);
      ctx.fillStyle = '#2a3238';
      ctx.fillRect(-4, bob + 10, 3, 5 + s * 2);
      ctx.fillRect(2, bob + 10, 3, 5 - s * 2);
    } else {
      ctx.fillStyle = '#2a3238';
      ctx.fillRect(-4, bob + 10, 3, 5);
      ctx.fillRect(2, bob + 10, 3, 5);
    }

    // HP bar
    if (h.alive && (selected || h.hp < h.maxHp)) {
      const w = 28;
      const pct = Math.max(0, h.hp / h.maxHp);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(-w / 2, -h.radius - 18, w, 5);
      ctx.fillStyle = pct > 0.35 ? '#5dcf6e' : '#e05050';
      ctx.fillRect(-w / 2, -h.radius - 18, w * pct, 5);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawTower(t: Tower, selected: boolean, showRange: boolean): void {
    const ctx = this.ctx;
    const def = TOWER_DEFS[t.type];
    const recoil = t.recoil * 4;

    const spec = getTowerSpecFlags(t.type, t.path, t.level);
    if (!t.isWall && (selected || showRange || spec.warBanner || spec.healBanner) && t.stats.range > 0) {
      const banner = spec.warBanner || spec.healBanner;
      ctx.strokeStyle = selected
        ? 'rgba(196,163,90,0.5)'
        : spec.warBanner
          ? 'rgba(224,160,80,0.35)'
          : spec.healBanner
            ? 'rgba(100,200,140,0.35)'
            : 'rgba(200,200,200,0.18)';
      ctx.fillStyle = selected
        ? 'rgba(196,163,90,0.08)'
        : banner
          ? 'rgba(200,180,100,0.05)'
          : 'rgba(200,200,200,0.035)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.stats.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(t.x, t.y);

    if (t.buildAnim > 0) {
      const rise = 1 - t.buildAnim;
      const s = 0.55 + rise * 0.45;
      ctx.translate(0, (1 - rise) * 10);
      ctx.scale(s, s);
      ctx.globalAlpha = 0.55 + rise * 0.45;
    }

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

    // Targeting mode label above selected tower
    if (selected && !t.isWall) {
      const label = TARGETING_LABELS[t.targeting] ?? t.targeting;
      ctx.save();
      ctx.font = '600 11px "Source Sans 3", sans-serif';
      ctx.textAlign = 'center';
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = 'rgba(10,14,12,0.72)';
      ctx.beginPath();
      ctx.roundRect(-tw / 2, -36, tw, 16, 3);
      ctx.fill();
      ctx.fillStyle = '#e8e0c8';
      ctx.fillText(label, 0, -24);
      ctx.restore();
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

    ctx.globalAlpha = 1;
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
    const ok = valid ? 'rgba(120,255,140,' : 'rgba(255,80,80,';
    ctx.fillStyle = `${ok}0.12)`;
    ctx.strokeStyle = `${ok}0.75)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - snapPad, y - snapPad, snapPad * 2, snapPad * 2, 4);
    ctx.fill();
    ctx.stroke();

    ctx.globalAlpha = 0.5;
    if (!def.isWall && def.base.range > 0) {
      ctx.fillStyle = `${ok}0.1)`;
      ctx.beginPath();
      ctx.arc(x, y, def.base.range, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `${ok}0.45)`;
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
      ctx.font = '600 12px "Source Sans 3", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      const tw = ctx.measureText(reason).width + 14;
      ctx.beginPath();
      ctx.roundRect(x - tw / 2, y - 44, tw, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#ffb0a8';
      ctx.fillText(reason, x, y - 30);
      ctx.textAlign = 'start';
    }
  }

  private drawEnemy(e: Enemy): void {
    const ctx = this.ctx;
    const dying = !e.active && e.deathFade > 0;
    const deathT = dying
      ? Math.max(0, Math.min(1, e.deathFade / Math.max(0.01, e.deathMax)))
      : 1;

    if (dying) {
      ctx.globalAlpha = deathT * deathT;
    } else if (e.invisible && !e.isRevealed) {
      ctx.globalAlpha = 0.4;
    } else if (e.invisible) {
      ctx.globalAlpha = 0.75;
    }

    ctx.save();
    ctx.translate(e.x, e.y);
    if (dying) {
      const s = 0.35 + deathT * 0.65;
      const squash = e.deathSpin > 1.5 ? 0.45 : 0.55;
      ctx.scale(s * (1 + (1 - deathT) * 0.15), s * (squash + deathT * (1 - squash)));
      ctx.rotate((1 - deathT) * 0.95 * e.deathSpin);
    } else {
      const punch = Math.max(
        e.hitFlash > 0 ? Math.min(1, e.hitFlash / 0.14) : 0,
        Math.min(1, e.hitPunch * 3),
      );
      if (punch > 0) {
        ctx.scale(1 + punch * 0.08, 1 - punch * 0.06);
      }
    }

    if (e.hitFlash > 0 && !dying) {
      ctx.filter = 'brightness(1.85)';
    }
    const scale = Math.max(0.85, e.radius / 11);
    // Face along the path so Shield Bearer front/rear reads correctly
    if (!dying && !e.flying) {
      ctx.rotate(e.angle);
    }
    this.atlas.draw(ctx, `enemy:${e.type}:walk`, e.animTime, {
      reduceMotion: this.reduceMotion,
      scale: scale * (e.berserkActive ? 1.08 : 1),
    });
    if (!dying && !e.flying) {
      ctx.rotate(-e.angle);
    }
    ctx.filter = 'none';

    // Brief weapon flake during death (no blood)
    if (dying && e.deathLoot > 0) {
      const lt = Math.min(1, e.deathLoot / 0.5);
      ctx.save();
      ctx.globalAlpha = lt * deathT;
      ctx.rotate(e.deathLootAngle + (1 - deathT) * 2);
      ctx.fillStyle = '#c4a070';
      ctx.fillRect(6 + (1 - deathT) * 10, -1, 8, 2.5);
      ctx.fillStyle = '#8a7050';
      ctx.fillRect(4 + (1 - deathT) * 10, -2, 3, 4);
      ctx.restore();
    }

    if (!dying) {
      if (e.healPulse > 0) {
        ctx.strokeStyle = `rgba(100,255,160,${0.35 + e.healPulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 10 + (1 - e.healPulse) * 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (e.bannerPulse > 0) {
        ctx.strokeStyle = `rgba(220,160,255,${0.35 + e.bannerPulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 12 + (1 - e.bannerPulse) * 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (e.berserkActive) {
        ctx.strokeStyle = 'rgba(255,60,40,0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (e.directionalShield) {
        ctx.strokeStyle = 'rgba(140,200,255,0.55)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 6, e.angle - 0.9, e.angle + 0.9);
        ctx.stroke();
      }

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

      if (e.shield > 0) {
        ctx.strokeStyle = `rgba(100,200,255,${0.4 + (e.shield / Math.max(1, e.maxShield)) * 0.5})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 7, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Ability icons — instant recognition
      if (e.active && e.abilities.length && !e.isBoss) {
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.globalAlpha = 0.9 * (dying ? deathT : 1);
        const icons = e.abilities.slice(0, 3);
        const startX = -((icons.length - 1) * 7);
        for (let i = 0; i < icons.length; i++) {
          const def = ENEMY_ABILITY_DEFS[icons[i]!.id];
          ctx.fillText(def.icon, startX + i * 14, -e.radius - 16);
        }
        ctx.globalAlpha = 1;
      }

      // Smooth HP bar — fades when full (bosses use the HUD boss bar)
      if (e.hpBarAlpha > 0.02 && !e.bossControlled) {
        const barW = Math.max(24, e.radius * 2.5);
        const hpPct = Math.max(0, Math.min(1, e.hpDisplay / e.maxHp));
        const flash = e.hpBarFlash > 0 ? Math.min(1, e.hpBarFlash / 0.28) : 0;
        ctx.globalAlpha = e.hpBarAlpha * (dying ? deathT : 1);
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.beginPath();
        ctx.roundRect(-barW / 2 - 1, -e.radius - 13, barW + 2, 6, 2);
        ctx.fill();
        ctx.fillStyle =
          flash > 0.2
            ? `rgba(255,${Math.round(220 - flash * 120)},${Math.round(220 - flash * 140)},1)`
            : hpPct > 0.5
              ? '#5dcf6e'
              : hpPct > 0.25
                ? '#e0c040'
                : '#e05050';
        ctx.beginPath();
        ctx.roundRect(-barW / 2, -e.radius - 12, Math.max(1, barW * hpPct), 4, 1.5);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawProjectile(p: Projectile): void {
    const ctx = this.ctx;
    const dx = p.drawX;
    const dy = p.drawY;

    // Ribbon trail from ring buffer (follows visual arc)
    if (p.trailLen > 1 && this.graphicsQuality !== 'low') {
      const cap = p.trailX.length;
      ctx.beginPath();
      ctx.strokeStyle = p.color;
      const thick =
        p.towerType === 'ballista'
          ? Math.max(2.4, p.radius * 0.95)
          : Math.max(1.6, p.radius * 0.8);
      ctx.lineWidth = thick;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const start = (p.trailHead - p.trailLen + cap) % cap;
      for (let i = 0; i < p.trailLen; i++) {
        const idx = (start + i) % cap;
        const x = p.trailX[idx]!;
        const y = p.trailY[idx]!;
        ctx.globalAlpha = 0.08 + (i / p.trailLen) * 0.5;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Subtle motion blur streak
    if (this.graphicsQuality === 'high') {
      const mx = dx - p.prevDrawX;
      const my = dy - p.prevDrawY;
      const mlen = Math.hypot(mx, my);
      if (mlen > 2.5) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = Math.min(0.35, mlen * 0.02);
        ctx.lineWidth = Math.max(1.5, p.radius * 0.7);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(dx - mx * 0.85, dy - my * 0.85);
        ctx.lineTo(dx, dy);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    ctx.save();
    ctx.translate(dx, dy);
    // Ballistic shells tip along velocity; loft adds slight pitch
    const ang = Math.atan2(p.vy, p.vx);
    ctx.rotate(ang + (p.ballistic ? -0.25 * Math.sin(Math.min(1, p.age * 3)) : 0));
    ctx.fillStyle = p.color;
    ctx.imageSmoothingEnabled = false;
    if (this.graphicsQuality === 'high') {
      ctx.shadowBlur = p.towerType === 'ballista' ? 8 : 6;
      ctx.shadowColor = p.color;
    }

    switch (p.towerType) {
      case 'arrow':
      case 'sniper':
        ctx.fillRect(-6, -1.5, 12, 3);
        ctx.fillStyle = '#fff8d0';
        ctx.fillRect(4, -1, 6, 2);
        ctx.fillStyle = shadeHex(p.color, -30);
        ctx.fillRect(-8, -2.5, 3, 5);
        break;
      case 'ballista':
        // Heavy bolt — longer, thicker
        ctx.fillRect(-11, -3, 18, 6);
        ctx.fillStyle = '#fff0c8';
        ctx.fillRect(5, -2, 8, 4);
        ctx.fillStyle = shadeHex(p.color, -40);
        ctx.fillRect(-12, -4, 4, 8);
        ctx.fillStyle = '#5a4030';
        ctx.fillRect(-2, -4, 3, 8);
        break;
      case 'cannon':
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shadeHex(p.color, 35);
        ctx.beginPath();
        ctx.arc(-1, -1, p.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'support':
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();
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

    ctx.fillStyle = '#c4a070';
    for (const t of towers) {
      if (!t.active) continue;
      ctx.fillRect(t.x * sx - 1.5, t.y * sy - 1.5, 3, 3);
    }
    ctx.fillStyle = '#b05040';
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
