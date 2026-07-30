import { DamageType } from '../config/combatTypes';
import { TOWER_DEFS } from '../config/towers';
import { Enemy } from '../entities/enemy';
import { Projectile } from '../entities/projectile';
import { Tower } from '../entities/tower';
import { ObjectPool } from '../utils/pool';
import { POOL_SIZES } from '../config/constants';
import { dist2, chance } from '../utils/math';
import { ParticleSystem } from './particles';

export interface CombatHooks {
  onDamage: (enemy: Enemy, amount: number, crit: boolean, towerType: string) => void;
  onKill: (enemy: Enemy, tower: Tower | null) => void;
  onChainHit: (count: number) => void;
  playSound: (id: string, volume?: number) => void;
}

/** Handles tower firing, projectiles, beams, and splash/chain resolution. */
export class CombatSystem {
  readonly projectiles = new ObjectPool(() => new Projectile(), 120, POOL_SIZES.projectiles);
  private enemyById = new Map<number, Enemy>();
  globalCritBonus = 0;
  envDamageMult = 1;
  envCritMult = 1;
  envProjectileSpeedMult = 1;
  globalDamageMult = 1;
  globalRangeMult = 1;
  showDamageNumbers = true;
  onSplashWorld?: (x: number, y: number, radius: number, damage: number, damageType: DamageType) => void;

  clear(): void {
    this.projectiles.releaseAll();
    this.enemyById.clear();
  }

  indexEnemies(enemies: Enemy[]): void {
    this.enemyById.clear();
    for (const e of enemies) {
      if (e.active) this.enemyById.set(e.id, e);
    }
  }

  update(
    dt: number,
    towers: Tower[],
    enemies: Enemy[],
    particles: ParticleSystem,
    hooks: CombatHooks,
  ): void {
    this.indexEnemies(enemies);

    for (const tower of towers) {
      if (!tower.active) continue;
      tower.updateAnim(dt);
      if (tower.isWall) continue;

      const baseStats = tower.stats;
      const eff = tower.getEffectiveStats(towers);
      tower.stats = {
        ...eff,
        range: eff.range * this.globalRangeMult,
      };
      const def = TOWER_DEFS[tower.type];

      try {
        if (def.isBeam) {
          this.updateLaser(dt, tower, enemies, particles, hooks);
          continue;
        }

        if (tower.cooldown > 0) continue;
        const target = tower.selectTarget(enemies);
        if (!target) {
          tower.beamActive = false;
          continue;
        }

        tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);

        if (tower.type === 'tesla') {
          this.fireTesla(tower, target, enemies, particles, hooks);
        } else {
          this.fireProjectile(tower, target, hooks);
        }
        tower.cooldown = 1 / Math.max(0.05, tower.stats.fireRate);
        tower.recoil = 1;
        tower.muzzleFlash = 1;
      } finally {
        tower.stats = baseStats;
      }
    }

    this.updateProjectiles(dt, enemies, particles, towers, hooks);
  }

  private fireProjectile(tower: Tower, target: Enemy, hooks: CombatHooks): void {
    const def = TOWER_DEFS[tower.type];
    const p = this.projectiles.acquire();
    if (!p) return;
    p.launch({
      x: tower.x + Math.cos(tower.angle) * 16,
      y: tower.y + Math.sin(tower.angle) * 16,
      targetX: target.x,
      targetY: target.y,
      targetId: target.id,
      speed: tower.stats.projectileSpeed * this.envProjectileSpeedMult,
      damage: tower.stats.damage,
      armorPen: tower.stats.armorPen,
      splashRadius: tower.stats.splashRadius,
      critChance: tower.stats.critChance,
      critMultiplier: tower.stats.critMultiplier,
      towerType: tower.type,
      damageType: def.damageType,
      slowAmount: tower.stats.slowAmount,
      slowDuration: tower.stats.slowDuration,
      dotDamage: tower.stats.dotDamage,
      dotDuration: tower.stats.dotDuration,
      color: def.accent,
      fromTowerId: tower.id,
      homing: tower.type !== 'cannon',
    });
    hooks.playSound(`attack_${tower.type}`, 0.35);
  }

  private fireTesla(
    tower: Tower,
    primary: Enemy,
    enemies: Enemy[],
    particles: ParticleSystem,
    hooks: CombatHooks,
  ): void {
    const damageType = TOWER_DEFS[tower.type].damageType;
    const chainLimit = Math.max(1, Math.round(tower.stats.chainCount));
    const hit = new Set<number>();
    let current: Enemy | null = primary;
    let fromX = tower.x;
    let fromY = tower.y;
    let dmgScale = 1;
    let chains = 0;

    while (current && chains < chainLimit) {
      hit.add(current.id);
      const result = this.applyHit(
        current,
        tower.stats.damage * dmgScale,
        tower.stats.armorPen,
        tower.stats.critChance,
        tower.stats.critMultiplier,
        tower,
        particles,
        hooks,
        false,
        damageType,
      );
      particles.lightning(fromX, fromY, current.x, current.y);
      fromX = current.x;
      fromY = current.y;
      chains++;
      dmgScale *= 0.75;

      if (result.killed) break;

      // Find next chain target
      let next: Enemy | null = null;
      let best = Infinity;
      const range2 = tower.stats.splashRadius * tower.stats.splashRadius;
      for (const e of enemies) {
        if (!e.active || hit.has(e.id)) continue;
        const d2 = dist2(current.x, current.y, e.x, e.y);
        if (d2 < best && d2 <= range2) {
          best = d2;
          next = e;
        }
      }
      current = next;
    }
    if (chains >= 5) hooks.onChainHit(chains);
    hooks.playSound('attack_tesla', 0.4);
  }

  private updateLaser(
    dt: number,
    tower: Tower,
    enemies: Enemy[],
    particles: ParticleSystem,
    hooks: CombatHooks,
  ): void {
    const target = tower.selectTarget(enemies);
    if (!target) {
      tower.beamActive = false;
      tower.beamRamp = Math.max(0, tower.beamRamp - dt * 2);
      tower.beamTargetId = 0;
      return;
    }

    tower.angle = Math.atan2(target.y - tower.y, target.x - tower.x);
    if (tower.beamTargetId !== target.id) {
      tower.beamTargetId = target.id;
      tower.beamRamp = 0;
    }
    tower.beamActive = true;
    tower.beamRamp = Math.min(2.5, tower.beamRamp + dt);
    const dps = tower.stats.beamDps * (1 + tower.beamRamp * 0.35);
    const tick = dps * dt;
    this.applyHit(
      target,
      tick,
      tower.stats.armorPen,
      tower.stats.critChance * dt,
      tower.stats.critMultiplier,
      tower,
      particles,
      hooks,
      true,
      TOWER_DEFS[tower.type].damageType,
    );
    if (Math.random() < 0.3) particles.fire(target.x, target.y);
  }

  private updateProjectiles(
    dt: number,
    enemies: Enemy[],
    particles: ParticleSystem,
    towers: Tower[],
    hooks: CombatHooks,
  ): void {
    this.projectiles.forEachActive((p) => {
      const target = this.enemyById.get(p.targetId) ?? null;
      const targetPos = target?.active ? { x: target.x, y: target.y } : { x: p.targetX, y: p.targetY };
      const impact = p.update(dt, target?.active ? targetPos : null);
      if (!impact) {
        if (p.trail && Math.random() < 0.45) {
          particles.trail(p.towerType, p.x, p.y);
        }
        return;
      }

      const tower = towers.find((t) => t.id === p.fromTowerId) ?? null;

      if (p.splashRadius > 0) {
        const r2 = p.splashRadius * p.splashRadius;
        for (const e of enemies) {
          if (!e.active) continue;
          if (dist2(p.x, p.y, e.x, e.y) <= r2) {
            this.applyProjectileEffects(e, p, tower, particles, hooks);
          }
        }
        particles.impact(p.towerType, p.x, p.y);
        hooks.playSound('explosion', 0.45);
        this.onSplashWorld?.(p.x, p.y, p.splashRadius, p.damage, p.damageType);
      } else if (target?.active) {
        this.applyProjectileEffects(target, p, tower, particles, hooks);
        particles.impact(p.towerType, p.x, p.y);
      } else {
        particles.impact(p.towerType, p.x, p.y);
      }

      this.projectiles.release(p);
    });
  }

  private applyProjectileEffects(
    enemy: Enemy,
    p: Projectile,
    tower: Tower | null,
    particles: ParticleSystem,
    hooks: CombatHooks,
  ): void {
    this.applyHit(
      enemy,
      p.damage,
      p.armorPen,
      p.critChance,
      p.critMultiplier,
      tower,
      particles,
      hooks,
      false,
      p.damageType,
    );
    if (p.slowAmount > 0) enemy.applySlow(p.slowAmount, p.slowDuration);
    if (p.dotDamage > 0) enemy.applyPoison(p.dotDamage, p.dotDuration);
  }

  private applyHit(
    enemy: Enemy,
    damage: number,
    armorPen: number,
    critChance: number,
    critMult: number,
    tower: Tower | null,
    particles: ParticleSystem,
    hooks: CombatHooks,
    isBeam = false,
    damageType: DamageType = 'physical',
  ): { dealt: number; crit: boolean; killed: boolean } {
    let dmg = damage * this.envDamageMult * this.globalDamageMult;
    let crit = false;
    if (chance(critChance * this.envCritMult + this.globalCritBonus)) {
      dmg *= critMult;
      crit = true;
    }
    const dealt = enemy.applyDamage(dmg, armorPen, damageType);
    if (tower) tower.damageDealt += dealt;
    if (this.showDamageNumbers && (!isBeam || dealt > 2)) {
      particles.showDamage(enemy.x, enemy.y - enemy.radius, dealt, crit);
    }
    hooks.onDamage(enemy, dealt, crit, tower?.type ?? '');

    if (enemy.hp <= 0) {
      enemy.active = false;
      if (tower) tower.kills++;
      particles.burst(enemy.x, enemy.y, enemy.isBoss ? 40 : 14, enemy.accent, 160, { glow: true });
      hooks.onKill(enemy, tower);
      return { dealt, crit, killed: true };
    }
    return { dealt, crit, killed: false };
  }
}
