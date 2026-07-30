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
  private shakeDecay = 8;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;

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
    const prevTarget = this.targetZoom;
    this.setZoom(this.targetZoom + delta);
    if (screenX !== undefined && screenY !== undefined && prevTarget !== this.targetZoom) {
      const worldBefore = this.screenToWorld(screenX, screenY);
      this.zoom = this.targetZoom;
      const worldAfter = this.screenToWorld(screenX, screenY);
      this.x += worldBefore.x - worldAfter.x;
      this.y += worldBefore.y - worldAfter.y;
      this.clampToBounds();
    }
  }

  pan(dx: number, dy: number): void {
    this.x += dx / this.zoom;
    this.y += dy / this.zoom;
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
    this.clampToBounds();
  }

  shake(intensity: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  update(dt: number, keys: { left: boolean; right: boolean; up: boolean; down: boolean }): void {
    this.targetZoom = clamp(this.targetZoom, this.minZoom(), CAMERA_MAX_ZOOM);
    this.zoom = lerpZoom(this.zoom, this.targetZoom, 12 * dt);
    if (Math.abs(this.zoom - this.targetZoom) < 0.0008) this.zoom = this.targetZoom;

    const speed = CAMERA_PAN_SPEED / this.zoom;
    if (keys.left) this.x -= speed * dt;
    if (keys.right) this.x += speed * dt;
    if (keys.up) this.y -= speed * dt;
    if (keys.down) this.y += speed * dt;
    this.clampToBounds();

    if (this.shakeIntensity > 0.1) {
      this.shakeOffsetX = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeOffsetY = (Math.random() - 0.5) * this.shakeIntensity * 2;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt * this.shakeIntensity);
    } else {
      this.shakeIntensity = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
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
