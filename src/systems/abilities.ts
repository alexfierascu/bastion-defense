import { ABILITY_DEFS, AbilityType, ABILITY_ORDER } from '../config/abilities';
import { Enemy } from '../entities/enemy';
import { ParticleSystem } from './particles';
import { dist2 } from '../utils/math';

export class AbilitySystem {
  cooldowns: Record<AbilityType, number> = {
    meteor: 0,
    freeze: 0,
    airstrike: 0,
    emp: 0,
    nuke: 0,
    goldboost: 0,
  };

  goldBoostTimer = 0;
  pendingTargeted: AbilityType | null = null;
  cdr = 0;

  reset(): void {
    for (const id of ABILITY_ORDER) this.cooldowns[id] = 0;
    this.goldBoostTimer = 0;
    this.pendingTargeted = null;
  }

  setCooldownReduction(amount: number): void {
    this.cdr = amount;
  }

  update(dt: number): void {
    for (const id of ABILITY_ORDER) {
      if (this.cooldowns[id]! > 0) this.cooldowns[id]! -= dt;
    }
    if (this.goldBoostTimer > 0) this.goldBoostTimer -= dt;
  }

  isReady(id: AbilityType): boolean {
    return this.cooldowns[id]! <= 0;
  }

  goldMultiplier(): number {
    return this.goldBoostTimer > 0 ? 2 : 1;
  }

  needsTarget(id: AbilityType): boolean {
    return id === 'meteor' || id === 'airstrike';
  }

  tryActivate(
    id: AbilityType,
    gold: number,
    x: number,
    y: number,
    enemies: Enemy[],
    particles: ParticleSystem,
  ): { ok: boolean; cost: number; reason?: string } {
    const def = ABILITY_DEFS[id];
    if (!this.isReady(id)) return { ok: false, cost: 0, reason: 'Cooldown' };
    if (gold < def.cost) return { ok: false, cost: 0, reason: 'Not enough gold' };

    this.cooldowns[id] = def.cooldown * (1 - this.cdr);

    switch (id) {
      case 'meteor':
        this.aoeDamage(x, y, def.radius, def.damage, enemies, particles, '#ff6b35');
        particles.explosion(x, y, def.radius);
        particles.burst(x, y, 30, '#ffaa00', 220, { glow: true, gravity: 80 });
        break;
      case 'airstrike':
        for (let i = -2; i <= 2; i++) {
          const px = x + i * 36;
          const py = y + Math.sin(i) * 20;
          this.aoeDamage(px, py, def.radius * 0.7, def.damage * 0.7, enemies, particles, '#e8c547');
          particles.explosion(px, py, def.radius * 0.6);
        }
        break;
      case 'freeze':
        for (const e of enemies) {
          if (e.active) e.applyFreeze(def.duration);
        }
        particles.burst(x, y, 20, '#a8e8ff', 100, { glow: true, gravity: 0 });
        break;
      case 'emp':
        for (const e of enemies) {
          if (!e.active) continue;
          e.stripShield();
          e.applyStun(def.duration);
          e.status.revealTimer = 3;
        }
        particles.burst(x, y, 25, '#66ccff', 150, { glow: true, gravity: 0 });
        break;
      case 'nuke':
        for (const e of enemies) {
          if (!e.active) continue;
          e.applyDamage(def.damage, 0.5);
          if (e.hp <= 0) e.active = false;
        }
        particles.burst(x, y, 60, '#ff3344', 280, { glow: true });
        particles.burst(x, y, 40, '#ffaa44', 200, { glow: true });
        break;
      case 'goldboost':
        this.goldBoostTimer = def.duration;
        particles.burst(x, y, 16, '#f0c040', 80, { glow: true, gravity: -40 });
        break;
    }

    return { ok: true, cost: def.cost };
  }

  private aoeDamage(
    x: number,
    y: number,
    radius: number,
    damage: number,
    enemies: Enemy[],
    particles: ParticleSystem,
    color: string,
  ): void {
    const r2 = radius * radius;
    for (const e of enemies) {
      if (!e.active) continue;
      if (dist2(x, y, e.x, e.y) <= r2) {
        const dealt = e.applyDamage(damage, 0.25);
        particles.showDamage(e.x, e.y, dealt, false, color);
        if (e.hp <= 0) e.active = false;
      }
    }
  }
}
