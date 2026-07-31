import { POOL_SIZES } from '../config/constants';
import { TowerType } from '../config/towers';
import { ObjectPool, Poolable } from '../utils/pool';
import { randomRange } from '../utils/math';

export class Particle implements Poolable {
  active = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  life = 0;
  maxLife = 1;
  size = 3;
  color = '#fff';
  gravity = 0;
  drag = 0.98;
  glow = false;

  reset(): void {
    this.active = false;
    this.life = 0;
  }

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: string,
    opts?: { gravity?: number; drag?: number; glow?: boolean },
  ): void {
    this.active = true;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.size = size;
    this.color = color;
    this.gravity = opts?.gravity ?? 0;
    this.drag = opts?.drag ?? 0.98;
    this.glow = opts?.glow ?? false;
  }

  update(dt: number): void {
    this.life -= dt;
    if (this.life <= 0) {
      this.active = false;
      return;
    }
    this.vy += this.gravity * dt;
    this.vx *= this.drag;
    this.vy *= this.drag;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}

export class DamageNumber implements Poolable {
  active = false;
  x = 0;
  y = 0;
  vy = -40;
  life = 0.8;
  maxLife = 0.8;
  text = '';
  color = '#fff';
  crit = false;
  gold = false;

  reset(): void {
    this.active = false;
    this.gold = false;
  }

  spawn(x: number, y: number, amount: number, crit: boolean, color = '#fff'): void {
    this.active = true;
    this.gold = false;
    this.x = x + randomRange(-6, 6);
    this.y = y - 10;
    this.vy = -50 - Math.random() * 20;
    this.life = crit ? 1.1 : 0.75;
    this.maxLife = this.life;
    this.text = crit ? `${Math.round(amount)}!` : `${Math.round(amount)}`;
    this.color = color;
    this.crit = crit;
  }

  spawnGold(x: number, y: number, amount: number): void {
    this.active = true;
    this.gold = true;
    this.crit = false;
    this.x = x + randomRange(-4, 4);
    this.y = y - 14;
    this.vy = -70 - Math.random() * 25;
    this.life = 1.0;
    this.maxLife = 1.0;
    this.text = `+${Math.round(amount)}g`;
    this.color = '#f0d060';
  }

  update(dt: number): void {
    this.life -= dt;
    this.y += this.vy * dt;
    this.vy += (this.gold ? 45 : 30) * dt;
    if (this.life <= 0) this.active = false;
  }
}

export class ParticleSystem {
  readonly particles = new ObjectPool(() => new Particle(), 400, POOL_SIZES.particles);
  readonly damageNumbers = new ObjectPool(() => new DamageNumber(), 80, POOL_SIZES.damageNumbers);
  /** 0–1 density scale from graphics quality. */
  qualityScale = 1;

  clear(): void {
    this.particles.releaseAll();
    this.damageNumbers.releaseAll();
  }

  private scaled(count: number): number {
    return Math.max(0, Math.round(count * this.qualityScale));
  }

  update(dt: number): void {
    this.particles.forEachActive((p) => {
      p.update(dt);
      if (!p.active) this.particles.release(p);
    });
    this.damageNumbers.forEachActive((d) => {
      d.update(dt);
      if (!d.active) this.damageNumbers.release(d);
    });
  }

  burst(
    x: number,
    y: number,
    count: number,
    color: string,
    speed = 120,
    opts?: { gravity?: number; glow?: boolean; size?: number; life?: number },
  ): void {
    const n = this.scaled(count);
    for (let i = 0; i < n; i++) {
      const p = this.particles.acquire();
      if (!p) break;
      const ang = Math.random() * Math.PI * 2;
      const spd = speed * (0.4 + Math.random() * 0.8);
      p.spawn(
        x,
        y,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd,
        opts?.life ?? randomRange(0.25, 0.7),
        opts?.size ?? randomRange(2, 5),
        color,
        { gravity: opts?.gravity ?? 40, glow: opts?.glow },
      );
    }
  }

  explosion(x: number, y: number, radius: number): void {
    this.burst(x, y, 18, '#ffaa44', 180, { glow: true, gravity: 20 });
    this.burst(x, y, 12, '#ff5522', 140, { glow: true });
    this.burst(x, y, 8, '#555', 80, { gravity: -20, life: 0.9 }); // smoke
    void radius;
  }

  smoke(x: number, y: number, count = 4): void {
    const n = this.scaled(count);
    for (let i = 0; i < n; i++) {
      const p = this.particles.acquire();
      if (!p) break;
      p.spawn(
        x + randomRange(-4, 4),
        y + randomRange(-4, 4),
        randomRange(-15, 15),
        randomRange(-40, -10),
        randomRange(0.5, 1.2),
        randomRange(4, 9),
        `rgba(80,80,80,0.7)`,
        { gravity: -10, drag: 0.96 },
      );
    }
  }

  /** Soft ground mist / fireflies for Bastion Approach atmosphere. */
  ambientBastion(path: { x: number; y: number }[], dt: number): void {
    if (path.length < 2 || this.qualityScale < 0.3) return;
    if (Math.random() > dt * 8) return;
    const p = this.particles.acquire();
    if (!p) return;
    const pt = path[Math.floor(Math.random() * path.length)]!;
    const firefly = Math.random() < 0.25;
    if (firefly) {
      p.spawn(
        pt.x + randomRange(-40, 40),
        pt.y + randomRange(-30, 10),
        randomRange(-8, 8),
        randomRange(-12, -2),
        randomRange(1.2, 2.4),
        randomRange(1.5, 2.5),
        'rgba(220, 200, 120, 0.7)',
        { gravity: -4, drag: 0.99, glow: true },
      );
    } else {
      p.spawn(
        pt.x + randomRange(-60, 60),
        pt.y + randomRange(-10, 20),
        randomRange(-18, -4),
        randomRange(-6, 4),
        randomRange(1.8, 3.2),
        randomRange(6, 14),
        'rgba(170, 185, 175, 0.18)',
        { gravity: -2, drag: 0.99 },
      );
    }
  }

  lightning(x1: number, y1: number, x2: number, y2: number): void {
    const midX = (x1 + x2) / 2 + randomRange(-12, 12);
    const midY = (y1 + y2) / 2 + randomRange(-12, 12);
    this.burst(midX, midY, 6, '#ffe066', 60, { glow: true, gravity: 0, life: 0.2 });
    this.burst(x2, y2, 8, '#fff8a0', 90, { glow: true, gravity: 0, life: 0.25 });
  }

  fire(x: number, y: number): void {
    this.burst(x, y, 6, '#ff6622', 50, { gravity: -60, glow: true, life: 0.4 });
  }

  /** Type-specific muzzle / impact FX. */
  impact(type: TowerType, x: number, y: number): void {
    switch (type) {
      case 'arrow':
        this.burst(x, y, 5, '#c4e09a', 90, { glow: true, life: 0.25, size: 2, gravity: 10 });
        break;
      case 'cannon':
        this.explosion(x, y, 40);
        break;
      case 'magic':
        this.burst(x, y, 10, '#b388ff', 100, { glow: true, gravity: -30, life: 0.45 });
        this.burst(x, y, 6, '#e0d0ff', 60, { glow: true, gravity: 0, life: 0.35 });
        break;
      case 'sniper':
        this.burst(x, y, 4, '#fff8e0', 160, { glow: true, life: 0.2, size: 2, gravity: 0 });
        break;
      case 'poison':
        this.burst(x, y, 10, '#7dff6a', 70, { gravity: 50, life: 0.55, size: 3 });
        this.burst(x, y, 4, '#3a8a30', 40, { gravity: 20, life: 0.7 });
        break;
      case 'freeze':
        this.burst(x, y, 12, '#a8e8ff', 90, { glow: true, gravity: 10, life: 0.5 });
        this.burst(x, y, 6, '#ffffff', 50, { glow: true, gravity: 0, life: 0.3, size: 2 });
        break;
      case 'tesla':
        this.burst(x, y, 8, '#ffe066', 110, { glow: true, gravity: 0, life: 0.25 });
        break;
      case 'laser':
        this.fire(x, y);
        this.burst(x, y, 4, '#ff4d6d', 70, { glow: true, life: 0.2 });
        break;
      case 'rocket':
        this.explosion(x, y, 60);
        this.burst(x, y, 10, '#ffaa44', 200, { glow: true });
        break;
      default:
        this.burst(x, y, 6, '#fff', 80, { glow: true, life: 0.3 });
    }
  }

  trail(type: TowerType, x: number, y: number): void {
    switch (type) {
      case 'rocket':
      case 'cannon':
        this.smoke(x, y, 1);
        break;
      case 'magic':
        this.burst(x, y, 1, '#b388ff', 20, { glow: true, gravity: -20, life: 0.35, size: 2 });
        break;
      case 'poison':
        this.burst(x, y, 1, '#7dff6a', 15, { gravity: 30, life: 0.4, size: 2 });
        break;
      case 'freeze':
        this.burst(x, y, 1, '#a8e8ff', 15, { glow: true, gravity: 0, life: 0.3, size: 2 });
        break;
      case 'arrow':
      case 'sniper':
        this.burst(x, y, 1, '#ddd', 10, { gravity: 0, life: 0.15, size: 1.5 });
        break;
      default:
        this.smoke(x, y, 1);
    }
  }

  showDamage(x: number, y: number, amount: number, crit: boolean, color?: string): void {
    const d = this.damageNumbers.acquire();
    if (!d) return;
    d.spawn(x, y, amount, crit, color ?? (crit ? '#ffee66' : '#ffffff'));
  }

  showGold(x: number, y: number, amount: number): void {
    if (amount <= 0) return;
    const d = this.damageNumbers.acquire();
    if (!d) return;
    d.spawnGold(x, y, amount);
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.particles.forEachActive((p) => {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      if (p.glow) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
      }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;

    this.damageNumbers.forEachActive((d) => {
      const a = Math.min(1, (d.life / Math.max(0.01, d.maxLife)) * 1.6);
      ctx.globalAlpha = a;
      if (d.gold) {
        ctx.font = 'bold 15px "Source Sans 3", sans-serif';
      } else {
        ctx.font = d.crit
          ? 'bold 16px "Source Sans 3", sans-serif'
          : '13px "Source Sans 3", sans-serif';
      }
      ctx.fillStyle = d.color;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 3;
      ctx.strokeText(d.text, d.x, d.y);
      ctx.fillText(d.text, d.x, d.y);
    });
    ctx.globalAlpha = 1;
  }
}
