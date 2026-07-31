import { DamageType } from '../config/combatTypes';
import { getTowerSpecFlags } from '../config/towerSpecs';
import { TOWER_DEFS, TowerType } from '../config/towers';
import { Enemy } from '../entities/enemy';
import { Projectile } from '../entities/projectile';
import { Tower } from '../entities/tower';
import { ObjectPool } from '../utils/pool';
import { POOL_SIZES } from '../config/constants';
import { dist2, chance } from '../utils/math';
import { ParticleSystem } from './particles';
import { TowerSlowAura, towerFireRateFromAuras } from './enemyAbilities';

export interface CombatHooks {
  onDamage: (enemy: Enemy, amount: number, crit: boolean, towerType: string) => void;
  onKill: (enemy: Enemy, tower: Tower | null) => void;
  onHeroKill?: (enemy: Enemy) => void;
  onChainHit: (count: number) => void;
  playSound: (id: string, volume?: number) => void;
  /** Subtle screen sting — 'hit' | 'crit' | 'explosion' | 'boss' */
  screenFeedback?: (kind: 'hit' | 'crit' | 'explosion' | 'boss') => void;
}

/** Temporary aura from hero Shield Wall. */
export interface TowerAura {
  x: number;
  y: number;
  radius: number;
  fireRateMult: number;
  remaining: number;
}

/** Handles tower firing, projectiles, beams, and splash/chain resolution. */
export class CombatSystem {
  readonly projectiles = new ObjectPool(() => new Projectile(), 120, POOL_SIZES.projectiles);
  private enemyById = new Map<number, Enemy>();
  private towerById = new Map<number, Tower>();
  globalCritBonus = 0;
  envDamageMult = 1;
  envCritMult = 1;
  envProjectileSpeedMult = 1;
  globalDamageMult = 1;
  globalRangeMult = 1;
  globalFireRateMult = 1;
  globalPierceBonus = 0;
  typeDamageMult: Partial<Record<TowerType, number>> = {};
  freezeSlowBonus = 0;
  sniperCritBonus = 0;
  teslaChainBonus = 0;
  rainFireMult = 1;
  rainTeslaMult = 1;
  bossEliteDamageMult = 1;
  splashDamageMult = 1;
  showDamageNumbers = true;
  towerAura: TowerAura | null = null;
  /** Enemy freeze auras + support war banners stack here. */
  fireRateAuras: TowerSlowAura[] = [];
  /** Next shot from these tower ids deals empowered damage (Rally). */
  empoweredTowerShots = new Map<number, number>();
  /** Gate regen from Healing Banner supports (applied by game). */
  gateRegenPerSec = 0;
  onSplashWorld?: (x: number, y: number, radius: number, damage: number, damageType: DamageType) => void;

  clear(): void {
    this.projectiles.releaseAll();
    this.enemyById.clear();
    this.towerById.clear();
    this.towerAura = null;
    this.fireRateAuras.length = 0;
    this.empoweredTowerShots.clear();
    this.gateRegenPerSec = 0;
  }

  indexEnemies(enemies: Enemy[]): void {
    this.enemyById.clear();
    for (const e of enemies) {
      if (e.active) this.enemyById.set(e.id, e);
    }
  }

  private indexTowers(towers: Tower[]): void {
    this.towerById.clear();
    for (const t of towers) {
      if (t.active) this.towerById.set(t.id, t);
    }
  }

  update(
    dt: number,
    towers: Tower[],
    enemies: Enemy[],
    particles: ParticleSystem,
    hooks: CombatHooks,
  ): void {
    this.indexTowers(towers);
    this.indexEnemies(enemies);
    if (this.towerAura) {
      this.towerAura.remaining -= dt;
      if (this.towerAura.remaining <= 0) this.towerAura = null;
    }
    // Tick enemy frost auras; war banners are rebuilt below
    for (let i = this.fireRateAuras.length - 1; i >= 0; i--) {
      const a = this.fireRateAuras[i]!;
      if (a.remaining >= 9000) continue;
      a.remaining -= dt;
      if (a.remaining <= 0) this.fireRateAuras.splice(i, 1);
    }
    this.refreshSupportAuras(towers);

    for (const tower of towers) {
      if (!tower.active) continue;
      tower.updateAnim(dt);
      if (tower.isWall) continue;

      const baseStats = tower.stats;
      const eff = tower.getEffectiveStats(towers);
      const sniperCrit =
        tower.type === 'sniper' ? eff.critChance + this.sniperCritBonus : eff.critChance;
      const slowAmt = Math.min(0.9, eff.slowAmount + (tower.type === 'freeze' ? this.freezeSlowBonus : 0));
      let auraAs = 1;
      if (this.towerAura) {
        const d = dist2(tower.x, tower.y, this.towerAura.x, this.towerAura.y);
        if (d <= this.towerAura.radius * this.towerAura.radius) {
          auraAs = this.towerAura.fireRateMult;
        }
      }
      auraAs *= towerFireRateFromAuras(tower, this.fireRateAuras);
      const spec = getTowerSpecFlags(tower.type, tower.path, tower.level);
      tower.stats = {
        ...eff,
        range: eff.range * this.globalRangeMult,
        fireRate: eff.fireRate * this.globalFireRateMult * auraAs,
        critChance: sniperCrit,
        slowAmount: slowAmt,
        armorPen: Math.min(0.95, eff.armorPen + spec.armorPenFlat),
        chainCount:
          eff.chainCount +
          (tower.type === 'tesla' ? this.teslaChainBonus : 0) +
          (spec.chainBolts > 0 ? spec.chainBolts : 0),
        splashRadius: eff.splashRadius * (spec.shrapnel ? 1.25 : spec.mortar ? 1.15 : 1),
      };
      const def = TOWER_DEFS[tower.type];

      try {
        if (def.isBeam) {
          this.updateLaser(dt, tower, enemies, particles, hooks);
          continue;
        }

        // Support banners pulse without requiring a target
        if (tower.type === 'support' && (spec.healBanner || spec.warBanner)) {
          if (tower.cooldown <= 0) {
            tower.cooldown = 1 / Math.max(0.2, tower.stats.fireRate);
            tower.muzzleFlash = 0.6;
            particles.burst(tower.x, tower.y, 8, def.accent, 50, { glow: true, life: 0.35 });
            hooks.playSound(spec.warBanner ? 'upgrade' : 'attack_magic', 0.22);
          }
          continue;
        }

        if (tower.cooldown > 0) continue;
        const multi = Math.max(1, spec.multiTarget || 1);
        const targets = tower.selectTargets(enemies, multi);
        if (!targets.length) {
          tower.beamActive = false;
          continue;
        }

        const primary = targets[0]!;
        tower.angle = Math.atan2(primary.y - tower.y, primary.x - tower.x);

        const empower = this.empoweredTowerShots.get(tower.id) ?? 0;
        if (empower > 0) {
          tower.stats = { ...tower.stats, damage: tower.stats.damage * empower };
          this.empoweredTowerShots.delete(tower.id);
        }

        const useChain =
          tower.type === 'tesla' || (spec.chainBolts > 0 && tower.stats.chainCount >= 2);
        if (useChain) {
          this.fireTesla(tower, primary, enemies, particles, hooks);
        } else {
          for (const t of targets) {
            this.fireProjectile(tower, t, hooks, spec.mortar, spec.shrapnel, spec.skin);
          }
        }
        tower.cooldown = 1 / Math.max(0.05, tower.stats.fireRate);
        tower.recoil = 1;
        tower.muzzleFlash = 1;
        const mx = tower.x + Math.cos(tower.angle) * 18;
        const my = tower.y + Math.sin(tower.angle) * 18;
        particles.burst(mx, my, 4, TOWER_DEFS[tower.type].accent, 70, {
          glow: true,
          life: 0.15,
          size: 2,
          gravity: 0,
        });
      } finally {
        tower.stats = baseStats;
      }
    }

    this.updateProjectiles(dt, enemies, particles, towers, hooks);
  }

  private refreshSupportAuras(towers: Tower[]): void {
    // Drop prior war-banner markers, keep frost auras
    this.fireRateAuras = this.fireRateAuras.filter((a) => a.remaining < 9000);
    this.gateRegenPerSec = 0;
    for (const tower of towers) {
      if (!tower.active || tower.type !== 'support') continue;
      const spec = getTowerSpecFlags(tower.type, tower.path, tower.level);
      const range = (tower.stats.range || TOWER_DEFS.support.base.range) * this.globalRangeMult;
      if (spec.warBanner) {
        this.fireRateAuras.push({
          x: tower.x,
          y: tower.y,
          radius: range,
          fireRateMult: 1.22 + (tower.level >= 3 ? 0.08 : 0),
          remaining: 9999,
        });
      }
      if (spec.healBanner) {
        this.gateRegenPerSec += 0.12 + (tower.level >= 3 ? 0.08 : 0);
      }
    }
  }

  private fireProjectile(
    tower: Tower,
    target: Enemy,
    hooks: CombatHooks,
    mortar = false,
    shrapnel = false,
    skin = '',
  ): void {
    const def = TOWER_DEFS[tower.type];
    const p = this.projectiles.acquire();
    if (!p) return;
    let splash = tower.stats.splashRadius;
    if (shrapnel) splash = Math.max(splash, 48) * 1.15;
    if (mortar) splash = Math.max(splash, 60);
    const ballistic =
      tower.type === 'cannon' || tower.type === 'rocket' || mortar;
    const travelHint = Math.hypot(target.x - tower.x, target.y - tower.y);
    p.launch({
      x: tower.x + Math.cos(tower.angle) * 16,
      y: tower.y + Math.sin(tower.angle) * 16,
      targetX: target.x,
      targetY: target.y,
      targetId: target.id,
      speed:
        tower.stats.projectileSpeed *
        this.envProjectileSpeedMult *
        (mortar ? 0.78 : tower.type === 'ballista' ? 0.9 : 1),
      damage: tower.stats.damage * (mortar ? 1.1 : 1),
      armorPen: tower.stats.armorPen,
      splashRadius: splash,
      critChance: tower.stats.critChance,
      critMultiplier: tower.stats.critMultiplier,
      towerType: tower.type,
      damageType: def.damageType,
      slowAmount: tower.stats.slowAmount,
      slowDuration: tower.stats.slowDuration,
      dotDamage: tower.stats.dotDamage,
      dotDuration: tower.stats.dotDuration,
      pierce: splash > 0 ? 0 : this.globalPierceBonus + (skin.includes('longbow') ? 1 : 0),
      color: mortar ? '#c4a070' : shrapnel ? '#ffcc88' : def.accent,
      fromTowerId: tower.id,
      homing: !ballistic && tower.type !== 'cannon',
      ballistic,
      arcPeak: mortar
        ? 55 + travelHint * 0.14
        : tower.type === 'cannon'
          ? 36 + travelHint * 0.1
          : tower.type === 'rocket'
            ? 22 + travelHint * 0.05
            : undefined,
    });
    const soundId = skin ? `attack_${skin}` : `attack_${tower.type}`;
    hooks.playSound(soundId, 0.35);
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
        { x: fromX, y: fromY },
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

      const tower =
        p.fromTowerId > 0 ? (this.towerById.get(p.fromTowerId) ?? null) : null;

      const ix = p.groundX;
      const iy = p.groundY;
      if (p.splashRadius > 0) {
        const r2 = p.splashRadius * p.splashRadius;
        for (const e of enemies) {
          if (!e.active) continue;
          if (dist2(ix, iy, e.x, e.y) <= r2) {
            this.applyProjectileEffects(e, p, tower, particles, hooks);
          }
        }
        particles.impact(p.towerType, ix, iy);
        if (p.towerType === 'cannon' || p.towerType === 'rocket') {
          particles.fragments(ix, iy, p.towerType === 'rocket' ? 10 : 8);
          particles.dust(ix, iy, 6);
        }
        hooks.playSound('explosion', 0.45);
        hooks.screenFeedback?.('explosion');
        this.onSplashWorld?.(ix, iy, p.splashRadius, p.damage, p.damageType);
      } else if (target?.active && !p.hasHit(target.id)) {
        this.applyProjectileEffects(target, p, tower, particles, hooks);
        p.markHit(target.id);
        particles.impact(p.towerType, ix, iy);
        hooks.playSound('impact', 0.28);
        if (p.pierceLeft > 0) {
          p.pierceLeft--;
          const next = this.findPierceTarget(p, enemies);
          if (next) {
            p.targetId = next.id;
            p.targetX = next.x;
            p.targetY = next.y;
            p.damage *= 0.85;
            return;
          }
        }
      } else {
        particles.impact(p.towerType, ix, iy);
        particles.dust(ix, iy, 3);
      }

      this.projectiles.release(p);
    });
  }

  private findPierceTarget(p: Projectile, enemies: Enemy[]): Enemy | null {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of enemies) {
      if (!e.active || p.hasHit(e.id)) continue;
      const d = dist2(p.x, p.y, e.x, e.y);
      if (d < bestD && d < 220 * 220) {
        bestD = d;
        best = e;
      }
    }
    return best;
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
      { x: p.x, y: p.y },
      p.fromHeroId > 0 ? 'hero' : tower?.type ?? '',
      p.fromHeroId > 0,
    );
    if (p.slowAmount > 0) enemy.applySlow(p.slowAmount, p.slowDuration);
    if (p.dotDamage > 0) enemy.applyPoison(p.dotDamage, p.dotDuration);
  }

  /** Fire a hero projectile using the shared pool. */
  fireHeroShot(opts: {
    x: number;
    y: number;
    target: Enemy;
    damage: number;
    critChance: number;
    heroId: number;
    color: string;
  }): void {
    const p = this.projectiles.acquire();
    if (!p) return;
    p.launch({
      x: opts.x,
      y: opts.y,
      targetX: opts.target.x,
      targetY: opts.target.y,
      targetId: opts.target.id,
      speed: 420 * this.envProjectileSpeedMult,
      damage: opts.damage,
      armorPen: 0.15,
      splashRadius: 0,
      critChance: opts.critChance,
      critMultiplier: 1.6,
      towerType: 'arrow',
      damageType: 'physical',
      color: opts.color,
      fromTowerId: 0,
      fromHeroId: opts.heroId,
      homing: true,
    });
  }

  setShieldWallAura(x: number, y: number, radius: number, duration: number): void {
    this.towerAura = { x, y, radius, fireRateMult: 1.2, remaining: duration };
  }

  rallyTowers(towers: Tower[], x: number, y: number, radius: number): number {
    let n = 0;
    const r2 = radius * radius;
    for (const t of towers) {
      if (!t.active || t.isWall) continue;
      if (dist2(t.x, t.y, x, y) > r2) continue;
      t.cooldown = 0;
      this.empoweredTowerShots.set(t.id, 1.75);
      n++;
    }
    return n;
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
    attackerPos?: { x: number; y: number } | null,
    damageSourceLabel = '',
    _fromHero = false,
  ): { dealt: number; crit: boolean; killed: boolean } {
    const typeMult = tower ? (this.typeDamageMult[tower.type] ?? 1) : 1;
    let weatherMult = 1;
    if (tower) {
      if (tower.type === 'cannon' || tower.type === 'rocket' || tower.type === 'poison') {
        weatherMult *= this.rainFireMult;
      }
      if (tower.type === 'tesla' || tower.type === 'laser') {
        weatherMult *= this.rainTeslaMult;
      }
    }
    let dmg = damage * this.envDamageMult * this.globalDamageMult * typeMult * weatherMult;
    if (
      tower &&
      (tower.type === 'cannon' || tower.type === 'rocket' || tower.type === 'freeze') &&
      this.splashDamageMult !== 1
    ) {
      dmg *= this.splashDamageMult;
    }
    if (enemy.isBoss || enemy.modifiers.includes('elite')) {
      dmg *= this.bossEliteDamageMult;
    }
    let crit = false;
    if (chance(critChance * this.envCritMult + this.globalCritBonus)) {
      dmg *= critMult;
      crit = true;
    }
    const from = attackerPos ?? (tower ? { x: tower.x, y: tower.y } : null);
    const dealt = enemy.applyDamage(dmg, armorPen, damageType, from);
    if (tower) tower.damageDealt += dealt;
    if (this.showDamageNumbers && (!isBeam || dealt > 2)) {
      particles.showDamage(enemy.x, enemy.y - enemy.radius, dealt, crit);
    }
    const sourceLabel = damageSourceLabel || tower?.type || '';
    hooks.onDamage(enemy, dealt, crit, sourceLabel);

    if (dealt > 0 && from && !isBeam) {
      enemy.applyHitReaction(sourceLabel || 'arrow', from.x, from.y, {
        splash: !!(tower && (tower.type === 'cannon' || tower.type === 'rocket' || tower.type === 'freeze')),
        crit,
      });
    }

    if (enemy.hp <= 0) {
      let kx = 0;
      let ky = -55;
      if (from) {
        const dx = enemy.x - from.x;
        const dy = enemy.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        const force =
          sourceLabel === 'ballista'
            ? 95
            : sourceLabel === 'cannon' || sourceLabel === 'rocket'
              ? 80
              : 55;
        kx = (dx / len) * force;
        ky = (dy / len) * (force * 0.55) - 30;
      }
      enemy.beginDeath(kx, ky);
      if (tower) tower.kills++;
      particles.deathBurst(enemy.x, enemy.y, enemy.type, enemy.accent, enemy.isBoss);
      hooks.playSound(enemy.isBoss ? 'explosion' : 'death', enemy.isBoss ? 0.5 : 0.38);
      if (enemy.isBoss) hooks.screenFeedback?.('boss');
      if (_fromHero) hooks.onHeroKill?.(enemy);
      else hooks.onKill(enemy, tower);
      return { dealt, crit, killed: true };
    }

    if (!isBeam && dealt > 0) {
      particles.burst(
        enemy.x,
        enemy.y - enemy.radius * 0.3,
        crit ? 7 : 4,
        tower ? (TOWER_DEFS[tower.type]?.accent ?? '#fff') : '#fff',
        crit ? 120 : 80,
        { glow: true, life: 0.2, size: 2, gravity: 20 },
      );
      hooks.playSound(crit ? 'hit_crit' : 'hit', crit ? 0.28 : 0.18);
      hooks.screenFeedback?.(crit ? 'crit' : 'hit');
    }
    return { dealt, crit, killed: false };
  }
}
