import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_MAX_ZOOM,
  CAMERA_MIN_ZOOM,
  CAMERA_PAN_SPEED,
  MAP_HEIGHT,
  MAP_WIDTH,
} from '../config/constants';
import { clamp } from '../utils/math';

export interface CameraInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** World-space camera with pan, zoom, shake, and HUD-safe insets. */
export class Camera {
  x = MAP_WIDTH / 2;
  y = MAP_HEIGHT / 2;
  zoom = CAMERA_DEFAULT_ZOOM;
  targetZoom = CAMERA_DEFAULT_ZOOM;

  private shakeIntensity = 0;
  private shakeDecay = 9;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;
  /** Soft pan velocity for key / edge feel. */
  private velX = 0;
  private velY = 0;

  viewportW = 800;
  viewportH = 600;
  insets: CameraInsets = { top: 0, right: 0, bottom: 0, left: 0 };

  get viewW(): number {
    return Math.max(1, this.viewportW - this.insets.left - this.insets.right);
  }

  get viewH(): number {
    return Math.max(1, this.viewportH - this.insets.top - this.insets.bottom);
  }

  get viewCenterX(): number {
    return this.insets.left + this.viewW / 2;
  }

  get viewCenterY(): number {
    return this.insets.top + this.viewH / 2;
  }

  resize(w: number, h: number): void {
    this.viewportW = w;
    this.viewportH = h;
    this.clampToBounds();
  }

  setInsets(insets: Partial<CameraInsets>): void {
    this.insets = { ...this.insets, ...insets };
    this.targetZoom = clamp(this.targetZoom, this.minZoom(), CAMERA_MAX_ZOOM);
    this.clampToBounds();
  }

  /** Smallest zoom that still fits the map in the safe play area. */
  private fitZoom(): number {
    const pad = 48;
    return Math.min(this.viewW / (MAP_WIDTH + pad), this.viewH / (MAP_HEIGHT + pad));
  }

  private minZoom(): number {
    const fit = this.fitZoom();
    if (fit >= 1) return CAMERA_MIN_ZOOM;
    return Math.max(0.2, fit);
  }

  setZoom(z: number): void {
    this.targetZoom = clamp(z, this.minZoom(), CAMERA_MAX_ZOOM);
  }

  zoomBy(delta: number, screenX?: number, screenY?: number): void {
    const prevZoom = this.zoom;
    const prevTarget = this.targetZoom;
    this.setZoom(this.targetZoom + delta);
    if (screenX !== undefined && screenY !== undefined && prevTarget !== this.targetZoom) {
      // Keep cursor world point stable without snapping zoom hard
      const worldBefore = this.screenToWorld(screenX, screenY);
      const blend = 0.55;
      this.zoom = prevZoom + (this.targetZoom - prevZoom) * blend;
      const worldAfter = this.screenToWorld(screenX, screenY);
      this.x += worldBefore.x - worldAfter.x;
      this.y += worldBefore.y - worldAfter.y;
      this.clampToBounds();
    }
  }

  pan(dx: number, dy: number): void {
    // Mostly direct drag with light momentum — no sticky lag
    const wx = dx / this.zoom;
    const wy = dy / this.zoom;
    this.x += wx * 0.88;
    this.y += wy * 0.88;
    this.velX += wx * 3.5;
    this.velY += wy * 3.5;
    this.clampToBounds();
  }

  panWorld(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    this.clampToBounds();
  }

  centerOn(wx: number, wy: number): void {
    this.x = wx;
    this.y = wy;
    this.velX = 0;
    this.velY = 0;
    this.clampToBounds();
  }

  /** Smooth fly-to used by level intro (disables key pan while active). */
  private flyTx = 0;
  private flyTy = 0;
  private flyTz = 0;
  private flying = false;
  private flyElapsed = 0;
  private static readonly FLY_MAX_SEC = 2.8;

  flyTo(wx: number, wy: number, zoom?: number): void {
    const z = clamp(zoom ?? this.targetZoom, this.minZoom(), CAMERA_MAX_ZOOM);
    // Resolve a reachable target — clamp uses zoom, so evaluate at destination zoom.
    const prevX = this.x;
    const prevY = this.y;
    const prevZoom = this.zoom;
    const prevTarget = this.targetZoom;
    this.zoom = z;
    this.targetZoom = z;
    this.x = wx;
    this.y = wy;
    this.clampToBounds();
    this.flyTx = this.x;
    this.flyTy = this.y;
    this.flyTz = z;
    this.x = prevX;
    this.y = prevY;
    this.zoom = prevZoom;
    this.targetZoom = prevTarget;
    this.flyElapsed = 0;
    this.flying = true;
  }

  get isFlying(): boolean {
    return this.flying;
  }

  /** Force-end cinematic fly (intro failsafe). */
  stopFlying(): void {
    if (!this.flying) return;
    this.x = this.flyTx;
    this.y = this.flyTy;
    this.zoom = this.flyTz;
    this.targetZoom = this.flyTz;
    this.clampToBounds();
    this.flying = false;
  }

  shake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  /** Brief zoom punch that eases back — used for wave/boss stings. */
  private zoomPunch = 0;
  private zoomPunchTarget = 0;

  impactZoom(amount = 0.04): void {
    this.zoomPunchTarget = Math.max(this.zoomPunchTarget, amount);
  }

  update(dt: number, keys: { left: boolean; right: boolean; up: boolean; down: boolean }): void {
    this.targetZoom = clamp(this.targetZoom, this.minZoom(), CAMERA_MAX_ZOOM);

    // Soft impact zoom ease
    this.zoomPunch += (this.zoomPunchTarget - this.zoomPunch) * Math.min(1, dt * 14);
    this.zoomPunchTarget = Math.max(0, this.zoomPunchTarget - dt * 0.12);
    if (this.zoomPunch < 0.0005 && this.zoomPunchTarget <= 0) this.zoomPunch = 0;

    if (this.flying) {
      this.velX = 0;
      this.velY = 0;
      this.flyElapsed += dt;
      const k = 1 - Math.exp(-dt * 2.2);
      this.x += (this.flyTx - this.x) * k;
      this.y += (this.flyTy - this.y) * k;
      this.targetZoom = clamp(this.flyTz, this.minZoom(), CAMERA_MAX_ZOOM);
      this.zoom = lerpZoom(this.zoom, this.targetZoom, 3.2 * dt);
      this.clampToBounds();
      const arrived =
        Math.hypot(this.flyTx - this.x, this.flyTy - this.y) < 4 &&
        Math.abs(this.zoom - this.targetZoom) < 0.01;
      if (arrived || this.flyElapsed >= Camera.FLY_MAX_SEC) {
        this.x = this.flyTx;
        this.y = this.flyTy;
        this.zoom = this.targetZoom;
        this.clampToBounds();
        this.flying = false;
      }
    } else {
      const want = this.targetZoom * (1 + this.zoomPunch);
      this.zoom = lerpZoom(this.zoom, want, 6.5 * dt);
      if (Math.abs(this.zoom - want) < 0.0008 && this.zoomPunch <= 0) this.zoom = this.targetZoom;

      const speed = CAMERA_PAN_SPEED / this.zoom;
      const accel = speed * 3.2;
      if (keys.left) this.velX -= accel * dt;
      if (keys.right) this.velX += accel * dt;
      if (keys.up) this.velY -= accel * dt;
      if (keys.down) this.velY += accel * dt;

      // Soft damping — no abrupt stops
      const damp = Math.exp(-dt * 8);
      this.velX *= damp;
      this.velY *= damp;
      if (Math.abs(this.velX) < 0.5) this.velX = 0;
      if (Math.abs(this.velY) < 0.5) this.velY = 0;

      const maxVel = speed * 1.15;
      this.velX = clamp(this.velX, -maxVel, maxVel);
      this.velY = clamp(this.velY, -maxVel, maxVel);
      this.x += this.velX * dt;
      this.y += this.velY * dt;
      this.clampToBounds();
    }

    if (this.shakeIntensity > 0.08) {
      // Soft noise shake — less harsh than raw random per frame
      this.shakeOffsetX += ((Math.random() - 0.5) * this.shakeIntensity * 2 - this.shakeOffsetX) * 0.55;
      this.shakeOffsetY += ((Math.random() - 0.5) * this.shakeIntensity * 2 - this.shakeOffsetY) * 0.55;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt * this.shakeIntensity);
    } else {
      this.shakeIntensity = 0;
      this.shakeOffsetX *= Math.max(0, 1 - dt * 18);
      this.shakeOffsetY *= Math.max(0, 1 - dt * 18);
      if (Math.abs(this.shakeOffsetX) < 0.05) this.shakeOffsetX = 0;
      if (Math.abs(this.shakeOffsetY) < 0.05) this.shakeOffsetY = 0;
    }
  }

  /** Apply world→screen transform into the HUD-safe play rect. */
  applyTransform(ctx: CanvasRenderingContext2D, dpr = 1): void {
    ctx.setTransform(
      this.zoom * dpr,
      0,
      0,
      this.zoom * dpr,
      (this.viewCenterX - (this.x + this.shakeOffsetX) * this.zoom) * dpr,
      (this.viewCenterY - (this.y + this.shakeOffsetY) * this.zoom) * dpr,
    );
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.viewCenterX) / this.zoom + this.x + this.shakeOffsetX,
      y: (sy - this.viewCenterY) / this.zoom + this.y + this.shakeOffsetY,
    };
  }

  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: (wx - this.x - this.shakeOffsetX) * this.zoom + this.viewCenterX,
      y: (wy - this.y - this.shakeOffsetY) * this.zoom + this.viewCenterY,
    };
  }

  private clampToBounds(): void {
    const halfW = this.viewW / (2 * this.zoom);
    const halfH = this.viewH / (2 * this.zoom);
    const margin = 48;

    const minX = halfW - margin;
    const maxX = MAP_WIDTH - halfW + margin;
    const minY = halfH - margin;
    const maxY = MAP_HEIGHT - halfH + margin;

    this.x = minX > maxX ? MAP_WIDTH / 2 : clamp(this.x, minX, maxX);
    this.y = minY > maxY ? MAP_HEIGHT / 2 : clamp(this.y, minY, maxY);
  }
}

function lerpZoom(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, t);
}
