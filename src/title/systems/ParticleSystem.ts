/**
 * Pooled particle engine: leaves, fireflies, dust, embers.
 * docs/06-PARTICLE_SYSTEM.md · docs/10-PERFORMANCE.md
 */

type Kind = 'leaf' | 'firefly' | 'dust' | 'ember';

interface Particle {
  active: boolean;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  phase: number;
}

const POOL = 120;

export class ParticleSystem {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pool: Particle[] = [];
  private wind = 0.35;
  private scale = 1;
  private reduceMotion = false;
  private spawnAcc = 0;
  private seed = Math.random() * 1000;
  private elapsed = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    for (let i = 0; i < POOL; i++) {
      this.pool.push({
        active: false,
        kind: 'dust',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 1,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  setWind(w: number): void {
    this.wind = w;
  }

  setScale(s: number): void {
    this.scale = Math.max(0.2, Math.min(1.5, s));
  }

  setReduceMotion(on: boolean): void {
    this.reduceMotion = on;
    if (on) for (const p of this.pool) p.active = false;
  }

  /** Auto-scale from FPS. */
  tuneForFps(fps: number): void {
    if (fps < 40) this.scale = Math.min(this.scale, 0.45);
    else if (fps < 50) this.scale = Math.min(this.scale, 0.7);
  }

  update(dt: number, w: number, h: number): void {
    this.resize(w, h);
    this.elapsed += dt;
    if (this.reduceMotion) {
      this.ctx.clearRect(0, 0, w, h);
      return;
    }

    this.spawnAcc += dt;
    const budget = Math.floor(40 * this.scale);
    let active = 0;
    for (const p of this.pool) if (p.active) active++;

    while (this.spawnAcc > 0.12 && active < budget) {
      this.spawnAcc -= 0.12;
      const roll = Math.random();
      if (roll < 0.55) this.spawn('leaf', w, h);
      else if (roll < 0.75) this.spawn('dust', w, h);
      else if (roll < 0.9) this.spawn('firefly', w, h);
      else this.spawn('ember', w, h);
      active++;
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);

    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      p.x += (p.vx + this.wind * 18) * dt;
      p.y += p.vy * dt;
      p.phase += dt;

      if (p.kind === 'leaf') {
        p.x += Math.sin(p.phase * 2) * 10 * dt;
        p.vy += 6 * dt;
      } else if (p.kind === 'firefly') {
        p.vx += Math.sin(p.phase * 3) * 4 * dt;
        p.vy += Math.cos(p.phase * 2.2) * 3 * dt;
      } else if (p.kind === 'ember') {
        p.vy -= 8 * dt;
        p.vx += (Math.random() - 0.5) * 10 * dt;
      }

      const a = Math.max(0, p.life / p.maxLife);
      this.draw(p, a);
    }

    this.drawBirds(w, h);
  }

  /** Subtle flock orbiting the moon — atmosphere, not spectacle. */
  private drawBirds(w: number, h: number): void {
    const ctx = this.ctx;
    const t = this.elapsed;
    const cx = w * 0.78;
    const cy = h * 0.14;
    const rx = w * 0.07;
    const ry = h * 0.045;
    const count = Math.max(3, Math.round(6 * this.scale));

    ctx.save();
    ctx.strokeStyle = 'rgba(12, 14, 12, 0.5)';
    ctx.fillStyle = 'rgba(10, 12, 10, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';

    for (let i = 0; i < count; i++) {
      const speed = 0.35 + (i % 3) * 0.08;
      const a = t * speed + i * 0.9 + this.seed * 0.01;
      const x = cx + Math.cos(a) * rx * (1 + (i % 4) * 0.12);
      const y = cy + Math.sin(a) * ry * (1 + (i % 3) * 0.15);
      const flap = Math.sin(t * 14 + i * 2) * 3;
      const facing = Math.cos(a) >= 0 ? 1 : -1;
      const s = 3.5 + (i % 3);

      ctx.beginPath();
      ctx.moveTo(x - s * facing, y + flap * 0.15);
      ctx.quadraticCurveTo(x, y - s * 0.7 - flap, x + s * facing, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(x, y, s * 0.35, s * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private spawn(kind: Kind, w: number, h: number): void {
    const p = this.pool.find((x) => !x.active);
    if (!p) return;
    p.active = true;
    p.kind = kind;
    p.phase = Math.random() * 6;

    if (kind === 'leaf') {
      p.x = Math.random() * w;
      p.y = -10;
      p.vx = -10 - Math.random() * 20;
      p.vy = 12 + Math.random() * 24;
      p.size = 2 + Math.random() * 3;
      p.maxLife = 6 + Math.random() * 5;
    } else if (kind === 'firefly') {
      p.x = w * (0.2 + Math.random() * 0.6);
      p.y = h * (0.45 + Math.random() * 0.35);
      p.vx = (Math.random() - 0.5) * 8;
      p.vy = (Math.random() - 0.5) * 6;
      p.size = 1.2 + Math.random();
      p.maxLife = 4 + Math.random() * 4;
    } else if (kind === 'dust') {
      p.x = Math.random() * w;
      p.y = h * (0.4 + Math.random() * 0.5);
      p.vx = (Math.random() - 0.5) * 6;
      p.vy = -2 - Math.random() * 4;
      p.size = 0.8;
      p.maxLife = 5 + Math.random() * 4;
    } else {
      // ember from gate torch region
      p.x = w * (0.38 + Math.random() * 0.24);
      p.y = h * (0.48 + Math.random() * 0.06);
      p.vx = (Math.random() - 0.5) * 12;
      p.vy = -20 - Math.random() * 20;
      p.size = 1 + Math.random();
      p.maxLife = 1.2 + Math.random();
    }
    p.life = p.maxLife;
  }

  private draw(p: Particle, a: number): void {
    const ctx = this.ctx;
    if (p.kind === 'leaf') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.phase);
      ctx.fillStyle = `rgba(70, 90, 55, ${0.35 * a})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (p.kind === 'firefly') {
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.phase * 5));
      ctx.fillStyle = `rgba(220, 200, 120, ${0.45 * a * pulse})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'dust') {
      ctx.fillStyle = `rgba(200, 200, 180, ${0.08 * a})`;
      ctx.fillRect(p.x, p.y, 1, 1);
    } else {
      ctx.fillStyle = `rgba(255, 160, 60, ${0.5 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
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
