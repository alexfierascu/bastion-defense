/**
 * Boss state machine + ability executor.
 * Composed onto an Enemy — does not subclass Enemy.
 */

import {
  BOSS_ABILITIES,
  BOSS_DEFS,
  BossAbilityId,
  BossDef,
  BossId,
  BossState,
  bossIdForEnemyType,
} from '../config/bosses';
import { Enemy } from '../entities/enemy';
import { ParticleSystem } from './particles';
import { dist2 } from '../utils/math';

export interface BossWorldHooks {
  playSound: (id: string, vol?: number) => void;
  particles: ParticleSystem;
  spawnMinion: (type: string, near: Enemy, count: number) => void;
  damageGate: (amount: number) => void;
  shake: (amount: number) => void;
  toast: (msg: string) => void;
  banner: (title: string, sub?: string) => void;
  onPhase: (boss: BossController, phase: number) => void;
  /** Gate world position for charge. */
  gateX: number;
  gateY: number;
}

export interface BossHudModel {
  name: string;
  title: string;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  phase: number;
  phaseName: string;
  intro: boolean;
  abilityHint: string;
}

export class BossController {
  readonly def: BossDef;
  readonly enemy: Enemy;
  state: BossState = 'idle';
  phase = 0;
  introTimer = 0;
  deathTimer = 0;
  abilityCd: Partial<Record<BossAbilityId, number>> = {};
  /** Difficulty scales cast frequency (<1 = more aggressive). */
  abilityCdMult = 1;
  chargeTimer = 0;
  private lastAbilityHint = '';

  constructor(enemy: Enemy, bossId: BossId) {
    this.def = BOSS_DEFS[bossId];
    this.enemy = enemy;
    enemy.bossId = bossId;
    enemy.bossControlled = true;
    for (const a of this.def.abilities) {
      this.abilityCd[a.id] = 1.5 + Math.random() * 2;
    }
  }

  static tryCreate(enemy: Enemy): BossController | null {
    const id = bossIdForEnemyType(enemy.type) ?? (enemy.bossId as BossId | undefined);
    if (!id || !enemy.isBoss) return null;
    return new BossController(enemy, id);
  }

  beginIntro(hooks: BossWorldHooks): void {
    this.state = 'intro';
    this.introTimer = 2.4;
    this.phase = 0;
    hooks.banner(this.def.name, this.def.title);
    hooks.toast(this.def.introLine);
    hooks.shake(8);
    hooks.playSound('wave_clear', 0.5);
    hooks.particles.burst(this.enemy.x, this.enemy.y, 40, this.def.accent, 160, {
      glow: true,
      life: 0.6,
    });
  }

  update(dt: number, hooks: BossWorldHooks): void {
    const e = this.enemy;
    if (this.state === 'dead') return;

    if (this.state === 'intro') {
      this.introTimer -= dt;
      e.baseSpeed = e.nativeSpeed * 0.35;
      if (this.introTimer <= 0) {
        this.state = 'fighting';
        e.baseSpeed = e.nativeSpeed;
      }
      return;
    }

    if (this.state === 'dying') {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.state = 'dead';
      return;
    }

    if (!e.active || e.hp <= 0) {
      this.beginDeath(hooks);
      return;
    }

    if (this.state !== 'fighting') this.state = 'fighting';

    this.tickPhases(hooks);

    if (this.chargeTimer > 0) {
      this.chargeTimer -= dt;
      // Rush toward gate along path by boosting path speed
      e.baseSpeed = e.nativeSpeed * 2.4;
      if (this.chargeTimer <= 0) e.baseSpeed = e.nativeSpeed;
    }

    for (const id of Object.keys(this.abilityCd) as BossAbilityId[]) {
      const v = this.abilityCd[id] ?? 0;
      if (v > 0) this.abilityCd[id] = Math.max(0, v - dt);
    }

    this.tryCast(hooks);
  }

  private currentPhaseAbilities(): BossAbilityId[] {
    const p = this.def.phases[this.phase] ?? this.def.phases[0]!;
    return p.abilities;
  }

  private tickPhases(hooks: BossWorldHooks): void {
    const e = this.enemy;
    const ratio = e.maxHp > 0 ? e.hp / e.maxHp : 1;
    for (let i = this.def.phases.length - 1; i > this.phase; i--) {
      const p = this.def.phases[i]!;
      if (ratio <= p.hpThreshold) {
        this.enterPhase(i, hooks);
        break;
      }
    }
  }

  private enterPhase(phase: number, hooks: BossWorldHooks): void {
    if (phase <= this.phase) return;
    this.phase = phase;
    const p = this.def.phases[phase]!;
    const e = this.enemy;
    e.phase = phase;
    e.bossPulse = 1;
    if (p.speedMult) {
      e.nativeSpeed *= p.speedMult;
      e.baseSpeed = e.nativeSpeed;
    }
    if (p.shieldFrac) {
      const add = e.maxHp * p.shieldFrac;
      e.shield += add;
      e.maxShield = Math.max(e.maxShield, e.shield);
    }
    if (p.enrageSec) {
      e.status.phaseEnrage = Math.max(e.status.phaseEnrage, p.enrageSec);
      e.status.stunTimer = 0;
      e.status.freezeTimer = 0;
    }
    if (p.regenMult) e.regenRate *= p.regenMult;
    this.lastAbilityHint = p.name;
    hooks.toast(`${this.def.name} — ${p.name}!`);
    hooks.shake(6 + phase * 2);
    hooks.playSound('explosion', 0.4);
    hooks.particles.burst(e.x, e.y, 28, this.def.accent, 140, { glow: true });
    hooks.onPhase(this, phase);
  }

  private tryCast(hooks: BossWorldHooks): void {
    const ready = this.currentPhaseAbilities().filter((id) => (this.abilityCd[id] ?? 0) <= 0);
    if (!ready.length) return;
    // Prefer variety: pick first ready with slight random skip
    const id = ready[Math.floor(Math.random() * ready.length)]!;
    this.cast(id, hooks);
  }

  private cast(id: BossAbilityId, hooks: BossWorldHooks): void {
    const def = BOSS_ABILITIES[id];
    this.abilityCd[id] =
      def.cooldown * this.abilityCdMult * (0.85 + Math.random() * 0.3);
    this.lastAbilityHint = def.name;
    const e = this.enemy;
    hooks.playSound(def.sound, 0.45);
    hooks.particles.burst(e.x, e.y, 16, def.color, 100, { glow: true, life: 0.4 });

    switch (id) {
      case 'groundSlam': {
        hooks.shake(7);
        const r = def.radius ?? 110;
        // Gate pressure scales with proximity
        const nearGate = dist2(e.x, e.y, hooks.gateX, hooks.gateY) < 220 * 220;
        hooks.damageGate(nearGate ? def.power * 1.5 : def.power * 0.6);
        hooks.particles.burst(e.x, e.y, 36, def.color, 160, { glow: true, life: 0.45 });
        break;
      }
      case 'boulderThrow': {
        hooks.shake(4);
        // Long-range gate chip — "backline" pressure
        hooks.damageGate(def.power * 0.85);
        hooks.particles.burst(
          (e.x + hooks.gateX) * 0.5,
          (e.y + hooks.gateY) * 0.5,
          12,
          def.color,
          80,
          { glow: true },
        );
        break;
      }
      case 'summonMinions': {
        const count = Math.max(2, Math.round(def.power + this.phase));
        const type = this.phase >= 2 ? 'raider' : 'scout';
        hooks.spawnMinion(type, e, count);
        hooks.toast(`${this.def.name} summons thralls!`);
        break;
      }
      case 'chargeGate': {
        this.chargeTimer = 2.2;
        hooks.shake(5);
        hooks.toast('Siege Charge!');
        break;
      }
      case 'barrierPulse': {
        const add = e.maxHp * def.power;
        e.shield += add;
        e.maxShield = Math.max(e.maxShield, e.shield);
        break;
      }
      case 'enrageRoar': {
        e.status.phaseEnrage = Math.max(e.status.phaseEnrage, 5);
        e.status.stunTimer = 0;
        e.status.freezeTimer = 0;
        e.nativeSpeed *= 1.15;
        e.baseSpeed = e.nativeSpeed;
        hooks.shake(8);
        break;
      }
      default:
        break;
    }
  }

  beginDeath(hooks: BossWorldHooks): void {
    this.state = 'dying';
    this.deathTimer = 1.4;
    hooks.shake(12);
    hooks.playSound('explosion', 0.65);
    hooks.particles.burst(this.enemy.x, this.enemy.y, 56, this.def.accent, 220, {
      glow: true,
      life: 0.7,
    });
    hooks.particles.burst(this.enemy.x, this.enemy.y, 24, '#fff0c0', 120, {
      glow: true,
      life: 0.4,
    });
    hooks.banner(`${this.def.name} Defeated`, 'The Bastion stands');
  }

  hud(): BossHudModel {
    const e = this.enemy;
    const phaseDef = this.def.phases[this.phase] ?? this.def.phases[0]!;
    return {
      name: this.def.name,
      title: this.def.title,
      hp: Math.max(0, e.hp),
      maxHp: e.maxHp,
      shield: e.shield,
      maxShield: e.maxShield,
      phase: this.phase,
      phaseName: phaseDef.name,
      intro: this.state === 'intro',
      abilityHint: this.lastAbilityHint,
    };
  }
}

export function resolveBossIdForWave(isBossWave: boolean, isMiniboss: boolean): BossId | null {
  if (isMiniboss) return 'champion';
  if (isBossWave) return 'siegeGolem';
  return null;
}
