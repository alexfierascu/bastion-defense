/**
 * Moon (cold/static) + torch (warm/dynamic) + fog light catch + ground reflection.
 * docs/07-LIGHTING.md
 */

import { TorchController } from './TorchController';

export class LightingSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private reduceMotion = false;
  private moonDim = 0;
  private gateFocus = 0;
  private fogDensity = 1;
  private t = 0;

  private readonly anchors = [
    { x: 0.385, y: 0.5, r: 0.08, power: 0.4 },
    { x: 0.615, y: 0.5, r: 0.08, power: 0.4 },
    { x: 0.5, y: 0.78, r: 0.055, power: 0.28 },
    { x: 0.86, y: 0.74, r: 0.065, power: 0.32 },
  ];

  constructor(
    canvas: HTMLCanvasElement,
    private readonly torches: TorchController,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on;
  }

  setMoonDim(v: number): void {
    this.moonDim = v;
  }

  setGateFocus(v: number): void {
    this.gateFocus = v;
  }

  setFogDensity(v: number): void {
    this.fogDensity = v;
  }

  update(dt: number, w: number, h: number): void {
    this.t += dt;
    this.resize(w, h);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    // Cold moonlight — static shape, only cloud-dim modulates
    const moonA = 0.07 * (1 - this.moonDim);
    if (moonA > 0.01) {
      const g = ctx.createRadialGradient(w * 0.78, h * 0.12, 0, w * 0.78, h * 0.12, h * 0.5);
      g.addColorStop(0, `rgba(180, 200, 220, ${moonA})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < this.anchors.length; i++) {
      const anchor = this.anchors[i]!;
      const flicker = this.torches.get(i);
      const focusBoost =
        this.gateFocus > 0 && i < 2 ? 1 + this.gateFocus * 0.45 : 1;
      const power = anchor.power * flicker.intensity * flicker.brightness * focusBoost;
      const px = anchor.x * w;
      const py = anchor.y * h;
      const r = anchor.r * Math.min(w, h) * flicker.radius * (1 + this.gateFocus * 0.08);

      // Warm torch core
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(255, 190, 100, ${0.28 * power})`);
      g.addColorStop(0.35, `rgba(220, 120, 40, ${0.14 * power})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();

      // Fog catches light — soft horizontal scatter near torch height
      const fogA = 0.1 * power * this.fogDensity;
      if (fogA > 0.01) {
        const fog = ctx.createRadialGradient(px, py + h * 0.04, 0, px, py + h * 0.06, r * 1.8);
        fog.addColorStop(0, `rgba(255, 170, 90, ${fogA})`);
        fog.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = fog;
        ctx.beginPath();
        ctx.ellipse(px, py + h * 0.05, r * 1.6, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Ground reflects torchlight (wet path)
      const gy = h * 0.82;
      const ground = ctx.createRadialGradient(px, gy, 0, px, gy, r * 1.4);
      ground.addColorStop(0, `rgba(255, 160, 80, ${0.12 * power})`);
      ground.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ground;
      ctx.beginPath();
      ctx.ellipse(px, gy, r * 1.3, r * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Soft bloom on gate focus
    if (this.gateFocus > 0.05) {
      const bx = w * 0.5;
      const by = h * 0.55;
      const br = Math.min(w, h) * (0.22 + this.gateFocus * 0.06);
      const bloom = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      bloom.addColorStop(0, `rgba(255, 200, 120, ${0.12 * this.gateFocus})`);
      bloom.addColorStop(0.5, `rgba(255, 160, 80, ${0.05 * this.gateFocus})`);
      bloom.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
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
