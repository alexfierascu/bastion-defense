/**
 * Enemy ability runtime — registry of handlers (composition, no giant switch).
 */

import {
  ENEMY_ABILITY_DEFS,
  EnemyAbilityId,
  MODIFIER_ABILITIES,
  ROLE_ABILITY_KITS,
} from '../config/enemyAbilities';
import { Enemy } from '../entities/enemy';
import { Tower } from '../entities/tower';
import { ParticleSystem } from './particles';
import { dist2 } from '../utils/math';

export interface AbilityRuntime {
  id: EnemyAbilityId;
  cd: number;
  /** Generic state slots (charge timer, enrage armed, etc.). */
  a: number;
  b: number;
  armed: boolean;
}

export interface AbilityHooks {
  playSound: (id: string, vol?: number) => void;
  particles: ParticleSystem;
  spawnMinion?: (type: string, near: Enemy, count: number) => void;
  damageGate?: (amount: number) => void;
  /** Temporary tower fire-rate debuff from freeze aura. */
  slowTowersNear?: (x: number, y: number, radius: number, mult: number, duration: number) => void;
}

export interface AbilityHandler {
  onAttach?: (enemy: Enemy, rt: AbilityRuntime) => void;
  onUpdate?: (enemy: Enemy, rt: AbilityRuntime, dt: number, allies: Enemy[], hooks: AbilityHooks) => void;
  onDamaged?: (enemy: Enemy, rt: AbilityRuntime, dealt: number, hooks: AbilityHooks) => void;
  onDeath?: (enemy: Enemy, rt: AbilityRuntime, hooks: AbilityHooks) => void;
}

const handlers: Record<EnemyAbilityId, AbilityHandler> = {
  shield: {
    onAttach(enemy) {
      if (enemy.shield <= 0) {
        enemy.shield = Math.max(20, enemy.maxHp * 0.18);
        enemy.maxShield = enemy.shield;
      }
    },
  },

  regeneration: {
    onAttach(enemy) {
      enemy.regenerates = true;
      if (enemy.regenRate < 2) enemy.regenRate = Math.max(2, enemy.maxHp * 0.012);
    },
    onUpdate(enemy, _rt, dt, _allies, hooks) {
      if (!enemy.active || enemy.hp >= enemy.maxHp) return;
      if (Math.random() < dt * 0.35) {
        hooks.particles.burst(enemy.x, enemy.y - enemy.radius, 2, ENEMY_ABILITY_DEFS.regeneration.color, 30, {
          glow: true,
          life: 0.25,
          size: 1.5,
          gravity: -20,
        });
      }
    },
  },

  charge: {
    onAttach(_e, rt) {
      rt.cd = 4 + Math.random() * 3;
      rt.a = 0;
    },
    onUpdate(enemy, rt, dt, _allies, hooks) {
      if (!enemy.active || enemy.flying) return;
      if (rt.a > 0) {
        rt.a -= dt;
        enemy.baseSpeed = enemy.nativeSpeed * 2.1;
        if (rt.a <= 0) enemy.baseSpeed = enemy.nativeSpeed;
        return;
      }
      rt.cd -= dt;
      if (rt.cd > 0) return;
      rt.cd = 7 + Math.random() * 4;
      rt.a = 0.85;
      enemy.bossPulse = 0.5;
      hooks.playSound(ENEMY_ABILITY_DEFS.charge.sound, 0.28);
      hooks.particles.burst(enemy.x, enemy.y, 10, ENEMY_ABILITY_DEFS.charge.color, 90, {
        glow: true,
        life: 0.28,
      });
    },
  },

  splitOnDeath: {
    onDeath(enemy, _rt, hooks) {
      hooks.playSound(ENEMY_ABILITY_DEFS.splitOnDeath.sound, 0.4);
      hooks.particles.burst(enemy.x, enemy.y, 18, ENEMY_ABILITY_DEFS.splitOnDeath.color, 120, {
        glow: true,
      });
      hooks.spawnMinion?.('scout', enemy, enemy.isBoss ? 3 : 2);
    },
  },

  poison: {
    onAttach(_e, rt) {
      rt.cd = 2;
    },
    onUpdate(enemy, rt, dt, _allies, hooks) {
      if (!enemy.active) return;
      rt.cd -= dt;
      if (rt.cd > 0) return;
      rt.cd = 2.4;
      hooks.particles.burst(enemy.x, enemy.y, 6, ENEMY_ABILITY_DEFS.poison.color, 40, {
        glow: true,
        life: 0.5,
        gravity: 10,
      });
      // Soft gate drip — poison pressure without deleting the run
      hooks.damageGate?.(0.15);
    },
  },

  freeze: {
    onAttach(_e, rt) {
      rt.cd = 1.2;
    },
    onUpdate(enemy, rt, dt, _allies, hooks) {
      if (!enemy.active) return;
      rt.cd -= dt;
      if (rt.cd > 0) return;
      rt.cd = 2.8;
      enemy.bannerPulse = 0.4;
      hooks.slowTowersNear?.(enemy.x, enemy.y, 120, 0.72, 1.6);
      hooks.playSound(ENEMY_ABILITY_DEFS.freeze.sound, 0.22);
      hooks.particles.burst(enemy.x, enemy.y, 8, ENEMY_ABILITY_DEFS.freeze.color, 50, {
        glow: true,
        life: 0.35,
      });
    },
  },

  armorAura: {
    onAttach(_e, rt) {
      rt.cd = 0.8;
    },
    onUpdate(enemy, rt, dt, allies, hooks) {
      if (!enemy.active) return;
      // Prefer legacy bannerAura path when set; still run for ability-only units
      if (enemy.bannerAura) return;
      rt.cd -= dt;
      if (rt.cd > 0) return;
      rt.cd = 1.1;
      enemy.bannerPulse = 0.45;
      for (const a of allies) {
        if (!a.active || a.id === enemy.id) continue;
        if (dist2(a.x, a.y, enemy.x, enemy.y) <= 110 * 110) {
          a.applyBannerBuff(0.12, 0.16, 1.4);
        }
      }
      hooks.particles.burst(enemy.x, enemy.y, 4, ENEMY_ABILITY_DEFS.armorAura.color, 35, {
        glow: true,
        life: 0.3,
      });
    },
  },

  healingAura: {
    onAttach(_e, rt) {
      rt.cd = 1;
    },
    onUpdate(enemy, rt, dt, allies, hooks) {
      if (!enemy.active) return;
      if (enemy.healsAura) return;
      rt.cd -= dt;
      if (rt.cd > 0) return;
      rt.cd = 1.35;
      enemy.healPulse = 0.45;
      const healAmt = Math.max(6, enemy.maxHp * 0.1);
      for (const a of allies) {
        if (!a.active || a.id === enemy.id) continue;
        if (dist2(a.x, a.y, enemy.x, enemy.y) <= 95 * 95) a.receiveHeal(healAmt);
      }
      hooks.playSound(ENEMY_ABILITY_DEFS.healingAura.sound, 0.15);
    },
  },

  teleport: {
    onAttach(_e, rt) {
      rt.cd = 5 + Math.random() * 4;
      rt.armed = true;
    },
    onDamaged(enemy, rt, dealt, hooks) {
      if (!rt.armed || !enemy.active || dealt < 8) return;
      if (rt.cd > 0) return;
      rt.cd = 8;
      rt.armed = true;
      const jump = 55 + Math.random() * 40;
      enemy.pathDist = Math.min(enemy.pathLen * 0.98, enemy.pathDist + jump);
      enemy.syncPathPosition();
      hooks.playSound(ENEMY_ABILITY_DEFS.teleport.sound, 0.35);
      hooks.particles.burst(enemy.x, enemy.y, 14, ENEMY_ABILITY_DEFS.teleport.color, 80, {
        glow: true,
        life: 0.35,
      });
    },
    onUpdate(_e, rt, dt) {
      if (rt.cd > 0) rt.cd -= dt;
    },
  },

  enrage: {
    onAttach(_e, rt) {
      rt.armed = false;
    },
    onUpdate(enemy, rt, _dt, _allies, hooks) {
      if (!enemy.active || rt.armed || enemy.hp <= 0) return;
      if (enemy.hp / enemy.maxHp > 0.4) return;
      rt.armed = true;
      enemy.berserkActive = true;
      enemy.nativeSpeed *= 1.55;
      enemy.baseSpeed = enemy.nativeSpeed;
      enemy.speed = enemy.baseSpeed;
      enemy.bossPulse = 0.7;
      enemy.accent = ENEMY_ABILITY_DEFS.enrage.color;
      hooks.playSound(ENEMY_ABILITY_DEFS.enrage.sound, 0.35);
      hooks.particles.burst(enemy.x, enemy.y, 16, ENEMY_ABILITY_DEFS.enrage.color, 100, {
        glow: true,
      });
    },
  },
};

export function createAbilityRuntime(id: EnemyAbilityId): AbilityRuntime {
  return { id, cd: 0, a: 0, b: 0, armed: false };
}

/** Build ability list from role kit + modifier labels + extras. */
export function collectEnemyAbilities(
  typeKey: string,
  modifierLabels: string[],
  extra: EnemyAbilityId[] = [],
): EnemyAbilityId[] {
  const set = new Set<EnemyAbilityId>();
  for (const id of ROLE_ABILITY_KITS[typeKey] ?? []) set.add(id);
  for (const label of modifierLabels) {
    const key = label.toLowerCase();
    for (const [mod, ab] of Object.entries(MODIFIER_ABILITIES)) {
      if (key.includes(mod) && ab) set.add(ab);
    }
  }
  for (const id of extra) set.add(id);
  return [...set];
}

export function attachAbilities(enemy: Enemy, ids: EnemyAbilityId[]): void {
  enemy.abilities = ids.map(createAbilityRuntime);
  for (const rt of enemy.abilities) {
    handlers[rt.id].onAttach?.(enemy, rt);
  }
}

export function tickEnemyAbilities(
  enemy: Enemy,
  dt: number,
  allies: Enemy[],
  hooks: AbilityHooks,
): void {
  if (!enemy.abilities.length) return;
  for (const rt of enemy.abilities) {
    handlers[rt.id].onUpdate?.(enemy, rt, dt, allies, hooks);
  }
}

export function notifyAbilityDamaged(
  enemy: Enemy,
  dealt: number,
  hooks: AbilityHooks,
): void {
  for (const rt of enemy.abilities) {
    handlers[rt.id].onDamaged?.(enemy, rt, dealt, hooks);
  }
}

export function notifyAbilityDeath(enemy: Enemy, hooks: AbilityHooks): void {
  for (const rt of enemy.abilities) {
    handlers[rt.id].onDeath?.(enemy, rt, hooks);
  }
}

/** Tower frost aura stacks — applied in combat via game-owned map. */
export interface TowerSlowAura {
  x: number;
  y: number;
  radius: number;
  fireRateMult: number;
  remaining: number;
}

export function tickTowerSlowAuras(auras: TowerSlowAura[], dt: number): void {
  for (let i = auras.length - 1; i >= 0; i--) {
    const a = auras[i]!;
    a.remaining -= dt;
    if (a.remaining <= 0) auras.splice(i, 1);
  }
}

export function towerFireRateFromAuras(tower: Tower, auras: TowerSlowAura[]): number {
  let m = 1;
  for (const a of auras) {
    if (dist2(tower.x, tower.y, a.x, a.y) <= a.radius * a.radius) {
      m = Math.min(m, a.fireRateMult);
    }
  }
  return m;
}
