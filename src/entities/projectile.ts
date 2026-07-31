import { DamageType } from '../config/combatTypes';
import { TowerType } from '../config/towers';
import { Poolable } from '../utils/pool';
import { angleTo, dist, normalize } from '../utils/math';

export class Projectile implements Poolable {
  active = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  speed = 400;
  damage = 0;
  armorPen = 0;
  splashRadius = 0;
  critChance = 0;
  critMultiplier = 1.5;
  damageType: DamageType = 'physical';
  targetId = 0;
  targetX = 0;
  targetY = 0;
  towerType: TowerType = 'arrow';
  slowAmount = 0;
  slowDuration = 0;
  dotDamage = 0;
  dotDuration = 0;
  chainCount = 0;
  lifetime = 3;
  age = 0;
  radius = 4;
  homing = true;
  color = '#fff';
  trail = true;
  fromTowerId = 0;
  /** Ring buffer trail — fixed capacity, no per-frame alloc. */
  private static readonly TRAIL_CAP = 12;
  readonly trailX = new Float32Array(Projectile.TRAIL_CAP);
  readonly trailY = new Float32Array(Projectile.TRAIL_CAP);
  trailLen = 0;
  trailHead = 0;

  reset(): void {
    this.active = false;
    this.age = 0;
    this.vx = 0;
    this.vy = 0;
    this.targetId = 0;
    this.chainCount = 0;
    this.splashRadius = 0;
    this.slowAmount = 0;
    this.dotDamage = 0;
    this.damageType = 'physical';
    this.trailLen = 0;
    this.trailHead = 0;
  }

  launch(opts: {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    targetId: number;
    speed: number;
    damage: number;
    armorPen: number;
    splashRadius: number;
    critChance: number;
    critMultiplier: number;
    towerType: TowerType;
    damageType?: DamageType;
    slowAmount?: number;
    slowDuration?: number;
    dotDamage?: number;
    dotDuration?: number;
    chainCount?: number;
    color: string;
    fromTowerId: number;
    homing?: boolean;
  }): void {
    this.active = true;
    this.x = opts.x;
    this.y = opts.y;
    this.targetX = opts.targetX;
    this.targetY = opts.targetY;
    this.targetId = opts.targetId;
    this.speed = opts.speed;
    this.damage = opts.damage;
    this.armorPen = opts.armorPen;
    this.splashRadius = opts.splashRadius;
    this.critChance = opts.critChance;
    this.critMultiplier = opts.critMultiplier;
    this.damageType = opts.damageType ?? 'physical';
    this.towerType = opts.towerType;
    this.slowAmount = opts.slowAmount ?? 0;
    this.slowDuration = opts.slowDuration ?? 0;
    this.dotDamage = opts.dotDamage ?? 0;
    this.dotDuration = opts.dotDuration ?? 0;
    this.chainCount = opts.chainCount ?? 0;
    this.color = opts.color;
    this.fromTowerId = opts.fromTowerId;
    this.homing = opts.homing ?? true;
    this.age = 0;
    this.lifetime = 4;
    this.radius = opts.towerType === 'rocket' || opts.towerType === 'cannon' ? 6 : 3.5;
    this.trail = opts.towerType !== 'tesla';

    const ang = angleTo(opts.x, opts.y, opts.targetX, opts.targetY);
    this.vx = Math.cos(ang) * this.speed;
    this.vy = Math.sin(ang) * this.speed;
  }

  /** @returns true if should despawn / impact */
  update(dt: number, targetPos: { x: number; y: number } | null): boolean {
    if (!this.active) return false;
    this.age += dt;
    if (this.age >= this.lifetime) return true;

    if (this.homing && targetPos) {
      // Predict slightly ahead for smoother intercept feel
      const lead = Math.min(0.08, dist(this.x, this.y, targetPos.x, targetPos.y) / this.speed);
      const tx = targetPos.x + (targetPos.x - this.targetX) * lead * 8;
      const ty = targetPos.y + (targetPos.y - this.targetY) * lead * 8;
      const dir = normalize(tx - this.x, ty - this.y);
      const desiredVx = dir.x * this.speed;
      const desiredVy = dir.y * this.speed;
      const turn = Math.min(1, 8 * dt);
      this.vx += (desiredVx - this.vx) * turn;
      this.vy += (desiredVy - this.vy) * turn;
      // Keep speed stable
      const spd = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / spd) * this.speed;
      this.vy = (this.vy / spd) * this.speed;
      this.targetX = targetPos.x;
      this.targetY = targetPos.y;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.trail) {
      this.trailX[this.trailHead] = this.x;
      this.trailY[this.trailHead] = this.y;
      this.trailHead = (this.trailHead + 1) % Projectile.TRAIL_CAP;
      if (this.trailLen < Projectile.TRAIL_CAP) this.trailLen++;
    }

    const d = dist(this.x, this.y, this.targetX, this.targetY);
    return d < 10 + this.radius;
  }
}
