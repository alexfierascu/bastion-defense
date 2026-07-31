import { DamageType } from '../config/combatTypes';
import { TowerType } from '../config/towers';
import { Poolable } from '../utils/pool';
import { angleTo, dist, normalize } from '../utils/math';

export class Projectile implements Poolable {
  active = false;
  x = 0;
  y = 0;
  /** Ground-plane position (shadow). Visual uses y - height. */
  groundX = 0;
  groundY = 0;
  /** Arc height above ground (pixels). */
  height = 0;
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
  /** Remaining pierce jumps after first hit (0 = normal single-target). */
  pierceLeft = 0;
  private static readonly HIT_CAP = 6;
  readonly hitIds = new Int32Array(Projectile.HIT_CAP);
  hitCount = 0;
  lifetime = 3;
  age = 0;
  radius = 4;
  homing = true;
  color = '#fff';
  trail = true;
  fromTowerId = 0;
  /** Non-zero when fired by a hero (fromTowerId stays 0). */
  fromHeroId = 0;
  /** Ring buffer trail — fixed capacity, no per-frame alloc. */
  private static readonly TRAIL_CAP = 12;
  readonly trailX = new Float32Array(Projectile.TRAIL_CAP);
  readonly trailY = new Float32Array(Projectile.TRAIL_CAP);
  trailLen = 0;
  trailHead = 0;
  /** Ballistic arc (cannon / mortar / rocket). */
  ballistic = false;
  private startX = 0;
  private startY = 0;
  private endX = 0;
  private endY = 0;
  private flightDur = 0.4;
  private flightT = 0;
  private arcPeak = 0;
  /** Turn rate for homing (higher = snappier). */
  turnRate = 8;
  /** Previous visual position for motion blur. */
  prevDrawX = 0;
  prevDrawY = 0;
  /** Hit radius multiplier for impact tests. */
  hitPad = 10;

  reset(): void {
    this.active = false;
    this.age = 0;
    this.vx = 0;
    this.vy = 0;
    this.height = 0;
    this.targetId = 0;
    this.chainCount = 0;
    this.pierceLeft = 0;
    this.hitCount = 0;
    this.fromHeroId = 0;
    this.splashRadius = 0;
    this.slowAmount = 0;
    this.dotDamage = 0;
    this.damageType = 'physical';
    this.trailLen = 0;
    this.trailHead = 0;
    this.ballistic = false;
    this.flightT = 0;
    this.arcPeak = 0;
    this.turnRate = 8;
    this.hitPad = 10;
  }

  hasHit(id: number): boolean {
    for (let i = 0; i < this.hitCount; i++) {
      if (this.hitIds[i] === id) return true;
    }
    return false;
  }

  markHit(id: number): void {
    if (this.hitCount >= Projectile.HIT_CAP || this.hasHit(id)) return;
    this.hitIds[this.hitCount++] = id;
  }

  get drawX(): number {
    return this.groundX;
  }

  get drawY(): number {
    return this.groundY - this.height;
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
    pierce?: number;
    color: string;
    fromTowerId?: number;
    fromHeroId?: number;
    homing?: boolean;
    ballistic?: boolean;
    arcPeak?: number;
  }): void {
    this.active = true;
    this.groundX = opts.x;
    this.groundY = opts.y;
    this.x = opts.x;
    this.y = opts.y;
    this.height = 0;
    this.prevDrawX = opts.x;
    this.prevDrawY = opts.y;
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
    this.pierceLeft = Math.max(0, opts.pierce ?? 0);
    this.hitCount = 0;
    this.color = opts.color;
    this.fromTowerId = opts.fromTowerId ?? 0;
    this.fromHeroId = opts.fromHeroId ?? 0;
    this.homing = opts.homing ?? true;
    this.age = 0;
    this.lifetime = 4;
    this.trailLen = 0;
    this.trailHead = 0;

    // Per-type feel
    switch (opts.towerType) {
      case 'arrow':
        this.radius = 3.2;
        this.hitPad = 9;
        this.turnRate = 11;
        this.trail = true;
        break;
      case 'sniper':
        this.radius = 2.8;
        this.hitPad = 8;
        this.turnRate = 14;
        this.trail = true;
        break;
      case 'ballista':
        this.radius = 5.5;
        this.hitPad = 14;
        this.turnRate = 4.5;
        this.trail = true;
        this.speed *= 0.72;
        break;
      case 'cannon':
        this.radius = 6.5;
        this.hitPad = 16;
        this.turnRate = 0;
        this.trail = true;
        break;
      case 'rocket':
        this.radius = 6;
        this.hitPad = 14;
        this.turnRate = 5;
        this.trail = true;
        break;
      default:
        this.radius = 4;
        this.hitPad = 10;
        this.turnRate = 8;
        this.trail = opts.towerType !== 'tesla';
    }

    const travel = Math.max(24, dist(opts.x, opts.y, opts.targetX, opts.targetY));
    this.ballistic =
      opts.ballistic ??
      (opts.towerType === 'cannon' || opts.towerType === 'rocket' || (opts.arcPeak ?? 0) > 0);

    if (this.ballistic) {
      this.homing = false;
      this.startX = opts.x;
      this.startY = opts.y;
      this.endX = opts.targetX;
      this.endY = opts.targetY;
      this.flightT = 0;
      this.flightDur = Math.min(1.35, Math.max(0.28, travel / Math.max(80, this.speed)));
      this.arcPeak =
        opts.arcPeak ??
        (opts.towerType === 'rocket' ? 28 + travel * 0.06 : 42 + travel * 0.12);
      this.vx = (this.endX - this.startX) / this.flightDur;
      this.vy = (this.endY - this.startY) / this.flightDur;
    } else {
      const ang = angleTo(opts.x, opts.y, opts.targetX, opts.targetY);
      this.vx = Math.cos(ang) * this.speed;
      this.vy = Math.sin(ang) * this.speed;
      // Tiny loft so flat shots still cast a shadow
      this.arcPeak = opts.towerType === 'ballista' ? 6 : 3;
    }
  }

  /** @returns true if should despawn / impact */
  update(dt: number, targetPos: { x: number; y: number } | null): boolean {
    if (!this.active) return false;
    this.age += dt;
    if (this.age >= this.lifetime) return true;

    this.prevDrawX = this.drawX;
    this.prevDrawY = this.drawY;

    if (this.ballistic) {
      this.flightT += dt / this.flightDur;
      const t = Math.min(1, this.flightT);
      // Smoothstep for less linear motion
      const s = t * t * (3 - 2 * t);
      this.groundX = this.startX + (this.endX - this.startX) * s;
      this.groundY = this.startY + (this.endY - this.startY) * s;
      this.height = Math.sin(t * Math.PI) * this.arcPeak;
      this.vx = (this.endX - this.startX) / this.flightDur;
      this.vy = (this.endY - this.startY) / this.flightDur;
      this.x = this.groundX;
      this.y = this.groundY;
      this.pushTrail();
      if (t >= 1) {
        this.targetX = this.endX;
        this.targetY = this.endY;
        return true;
      }
      return false;
    }

    if (this.homing && targetPos) {
      const lead = Math.min(0.08, dist(this.groundX, this.groundY, targetPos.x, targetPos.y) / this.speed);
      const tx = targetPos.x + (targetPos.x - this.targetX) * lead * 8;
      const ty = targetPos.y + (targetPos.y - this.targetY) * lead * 8;
      const dir = normalize(tx - this.groundX, ty - this.groundY);
      const desiredVx = dir.x * this.speed;
      const desiredVy = dir.y * this.speed;
      const turn = Math.min(1, this.turnRate * dt);
      this.vx += (desiredVx - this.vx) * turn;
      this.vy += (desiredVy - this.vy) * turn;
      const spd = Math.hypot(this.vx, this.vy) || 1;
      this.vx = (this.vx / spd) * this.speed;
      this.vy = (this.vy / spd) * this.speed;
      this.targetX = targetPos.x;
      this.targetY = targetPos.y;
    }

    this.groundX += this.vx * dt;
    this.groundY += this.vy * dt;
    this.x = this.groundX;
    this.y = this.groundY;

    // Subtle loft that settles near impact
    const d = dist(this.groundX, this.groundY, this.targetX, this.targetY);
    const approach = Math.min(1, d / 120);
    this.height = this.arcPeak * approach * 0.85;

    this.pushTrail();

    return d < this.hitPad + this.radius;
  }

  private pushTrail(): void {
    if (!this.trail) return;
    this.trailX[this.trailHead] = this.drawX;
    this.trailY[this.trailHead] = this.drawY;
    this.trailHead = (this.trailHead + 1) % Projectile.TRAIL_CAP;
    if (this.trailLen < Projectile.TRAIL_CAP) this.trailLen++;
  }
}
