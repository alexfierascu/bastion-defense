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
  /** Recent positions for ribbon trails. */
  trailPoints: { x: number; y: number }[] = [];

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
    this.trailPoints.length = 0;
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
      const dir = normalize(targetPos.x - this.x, targetPos.y - this.y);
      const desiredVx = dir.x * this.speed;
      const desiredVy = dir.y * this.speed;
      this.vx += (desiredVx - this.vx) * Math.min(1, 10 * dt);
      this.vy += (desiredVy - this.vy) * Math.min(1, 10 * dt);
      this.targetX = targetPos.x;
      this.targetY = targetPos.y;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (this.trail) {
      this.trailPoints.push({ x: this.x, y: this.y });
      if (this.trailPoints.length > 10) this.trailPoints.shift();
    }

    const d = dist(this.x, this.y, this.targetX, this.targetY);
    return d < 10 + this.radius;
  }
}
