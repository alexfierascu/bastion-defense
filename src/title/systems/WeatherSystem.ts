/**
 * Visual weather modulation — rain, snow, storm flashes, dawn wash.
 * Driven by EnvironmentState.weather; no engine rewrite needed to add seasons.
 */

import { EnvironmentState, WeatherId } from '../types';

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  a: number;
}

const POOL = 160;

export class WeatherSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private weather: WeatherId = 'mist';
  private wind = 0.35;
  private reduceMotion = false;
  private drops: Drop[] = [];
  private flash = 0;
  private flashAcc = 0;
  private skyWarmth = 0;
  private fogDensity = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < POOL; i++) {
      this.drops.push({ x: 0, y: 0, vx: 0, vy: 0, len: 1, a: 0 });
    }
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on;
  }

  apply(env: EnvironmentState): void {
    this.weather = env.weather;
    this.wind = env.wind;
    this.skyWarmth = env.skyWarmth;
    this.fogDensity = env.fogDensity;
  }

  update(dt: number, w: number, h: number, root: HTMLElement): void {
    this.resize(w, h);
    root.dataset.weather = this.weather;
    root.style.setProperty('--sky-warmth', String(this.skyWarmth));
    root.style.setProperty('--fog-density', String(this.fogDensity));
    root.style.setProperty('--time-of-day', String(0)); // reserved

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    if (this.reduceMotion) {
      this.paintSkyTint(ctx, w, h);
      return;
    }

    this.paintSkyTint(ctx, w, h);

    if (this.weather === 'rain' || this.weather === 'storm') {
      this.tickRain(dt, w, h, this.weather === 'storm' ? 1.35 : 1);
      this.drawRain(ctx);
    } else if (this.weather === 'snow') {
      this.tickSnow(dt, w, h);
      this.drawSnow(ctx);
    } else {
      for (const d of this.drops) d.a = 0;
    }

    if (this.weather === 'storm') {
      this.flashAcc += dt;
      if (this.flash <= 0 && this.flashAcc > 3 + Math.random() * 6) {
        this.flash = 0.18 + Math.random() * 0.15;
        this.flashAcc = 0;
      }
      if (this.flash > 0) {
        this.flash -= dt;
        ctx.fillStyle = `rgba(200, 220, 255, ${Math.max(0, this.flash) * 0.22})`;
        ctx.fillRect(0, 0, w, h);
      }
    }
  }

  private paintSkyTint(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (this.skyWarmth > 0.05) {
      const g = ctx.createLinearGradient(0, 0, 0, h * 0.55);
      g.addColorStop(0, `rgba(255, 160, 90, ${0.12 * this.skyWarmth})`);
      g.addColorStop(0.5, `rgba(255, 120, 70, ${0.06 * this.skyWarmth})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    if (this.weather === 'storm' || this.weather === 'rain') {
      ctx.fillStyle = `rgba(10, 14, 20, ${this.weather === 'storm' ? 0.18 : 0.1})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private tickRain(dt: number, w: number, h: number, mult: number): void {
    const budget = Math.floor(90 * mult);
    let active = 0;
    for (const d of this.drops) if (d.a > 0) active++;
    while (active < budget) {
      const d = this.drops.find((x) => x.a <= 0);
      if (!d) break;
      d.x = Math.random() * w;
      d.y = Math.random() * h;
      d.vx = this.wind * 80 + 20;
      d.vy = 420 + Math.random() * 280;
      d.len = 8 + Math.random() * 14;
      d.a = 0.25 + Math.random() * 0.25;
      active++;
    }
    for (const d of this.drops) {
      if (d.a <= 0) continue;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y > h || d.x > w + 20) {
        d.x = Math.random() * w;
        d.y = -20;
      }
    }
  }

  private drawRain(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = 'rgba(180, 200, 220, 0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of this.drops) {
      if (d.a <= 0) continue;
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.vx * 0.02, d.y + d.len);
    }
    ctx.stroke();
  }

  private tickSnow(dt: number, w: number, h: number): void {
    const budget = 70;
    let active = 0;
    for (const d of this.drops) if (d.a > 0) active++;
    while (active < budget) {
      const d = this.drops.find((x) => x.a <= 0);
      if (!d) break;
      d.x = Math.random() * w;
      d.y = Math.random() * h;
      d.vx = this.wind * 20 + (Math.random() - 0.5) * 16;
      d.vy = 28 + Math.random() * 36;
      d.len = 1.2 + Math.random() * 2;
      d.a = 0.35 + Math.random() * 0.4;
      active++;
    }
    for (const d of this.drops) {
      if (d.a <= 0) continue;
      d.x += (d.vx + Math.sin(d.y * 0.02) * 12) * dt;
      d.y += d.vy * dt;
      if (d.y > h) {
        d.y = -4;
        d.x = Math.random() * w;
      }
    }
  }

  private drawSnow(ctx: CanvasRenderingContext2D): void {
    for (const d of this.drops) {
      if (d.a <= 0) continue;
      ctx.fillStyle = `rgba(230, 235, 245, ${d.a})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.len, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private resize(w: number, h: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const tw = Math.floor(w * dpr);
    const th = Math.floor(h * dpr);
    if (this.canvas.width !== tw || this.canvas.height !== th) {
      this.canvas.width = tw;
      this.canvas.height = th;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
}
