/**
 * Player-controlled hero unit — moves freely, auto-attacks, abilities.
 */

import {
  HERO_DEFS,
  HERO_LEVEL_CAP,
  HERO_RESPAWN_SEC,
  HERO_TALENT_TIERS,
  HERO_TALENTS,
  HeroAbilityId,
  HeroId,
  HeroTalentId,
  xpToNextLevel,
} from '../config/heroes';
import { Enemy } from './enemy';
import { dist2 } from '../utils/math';

export type HeroAnim = 'idle' | 'walk' | 'attack' | 'hurt' | 'death' | 'respawn';

export class Hero {
  id = 1;
  heroId: HeroId = 'warden';
  active = false;
  alive = true;
  x = 0;
  y = 0;
  angle = 0;
  targetX = 0;
  targetY = 0;
  hasMoveTarget = false;

  level = 1;
  xp = 0;
  xpToNext = xpToNextLevel(1);

  maxHp = 1;
  hp = 1;
  armor = 0;
  damage = 0;
  attackSpeed = 1;
  moveSpeed = 100;
  attackRange = 120;
  critChance = 0.08;
  radius = 14;

  cooldown = 0;
  abilityCd: Record<HeroAbilityId, number> = {
    shieldWall: 0,
    rally: 0,
    lastStand: 0,
  };

  /** Active effect timers. */
  shieldWallTimer = 0;
  lastStandTimer = 0;
  respawnTimer = 0;

  talents: HeroTalentId[] = [];
  pendingTalentLevel = 0;

  anim: HeroAnim = 'idle';
  animTime = 0;
  attackFlash = 0;
  hurtFlash = 0;
  deathFade = 0;
  respawnFlash = 0;
  footstepTimer = 0;

  color = '#3a4a5a';
  accent = '#c4a050';

  reset(): void {
    this.active = false;
    this.alive = true;
    this.hasMoveTarget = false;
    this.level = 1;
    this.xp = 0;
    this.talents = [];
    this.pendingTalentLevel = 0;
    this.cooldown = 0;
    this.abilityCd.shieldWall = 0;
    this.abilityCd.rally = 0;
    this.abilityCd.lastStand = 0;
    this.shieldWallTimer = 0;
    this.lastStandTimer = 0;
    this.respawnTimer = 0;
    this.anim = 'idle';
    this.animTime = 0;
    this.attackFlash = 0;
    this.hurtFlash = 0;
    this.deathFade = 0;
    this.respawnFlash = 0;
  }

  spawn(heroId: HeroId, x: number, y: number): void {
    const def = HERO_DEFS[heroId];
    this.reset();
    this.heroId = heroId;
    this.active = true;
    this.alive = true;
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.color = def.color;
    this.accent = def.accent;
    this.radius = def.radius;
    this.refreshStats();
    this.hp = this.maxHp;
    this.anim = 'idle';
    this.respawnFlash = 0.6;
  }

  refreshStats(): void {
    const def = HERO_DEFS[this.heroId];
    const lv = this.level - 1;
    let rangeMult = 1;
    let asMult = 1;
    let critBonus = 0;
    let moveMult = 1;
    for (const t of this.talents) {
      if (t === 'range') rangeMult *= 1.1;
      if (t === 'attackSpeed') asMult *= 1.15;
      if (t === 'crit') critBonus += 0.2;
      if (t === 'moveSpeed') moveMult *= 1.1;
    }
    this.maxHp = Math.round(def.hp + def.hpPerLevel * lv);
    this.armor = def.armor + def.armorPerLevel * lv;
    this.damage = def.damage + def.damagePerLevel * lv;
    this.attackSpeed = def.attackSpeed * asMult;
    this.moveSpeed = def.moveSpeed * moveMult;
    this.attackRange = def.attackRange * rangeMult;
    this.critChance = def.critChance + critBonus;
    if (this.lastStandTimer > 0) {
      this.attackSpeed *= 2;
      this.attackRange *= 1.35;
    }
  }

  abilityDurationMult(): number {
    return this.talents.includes('abilityDuration') ? 1.15 : 1;
  }

  commandMove(x: number, y: number): void {
    if (!this.alive) return;
    this.targetX = x;
    this.targetY = y;
    this.hasMoveTarget = true;
  }

  selectTarget(enemies: Enemy[]): Enemy | null {
    if (!this.alive) return null;
    const r2 = this.attackRange * this.attackRange;
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of enemies) {
      if (!e.active) continue;
      const d = dist2(this.x, this.y, e.x, e.y);
      if (d > r2) continue;
      // Prefer supports, then closest
      const score = d - e.threatPriority * 40;
      if (score < bestD) {
        bestD = score;
        best = e;
      }
    }
    return best;
  }

  gainXp(amount: number): { leveled: boolean; talentReady: boolean } {
    if (!this.alive && this.respawnTimer > 0) {
      // Still gain XP while down
    }
    this.xp += amount;
    let leveled = false;
    let talentReady = false;
    while (this.level < HERO_LEVEL_CAP && this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpToNextLevel(this.level);
      leveled = true;
      const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 1;
      this.refreshStats();
      this.hp = Math.min(this.maxHp, Math.max(1, Math.round(this.maxHp * ratio)));
      if (HERO_TALENT_TIERS.some((t) => t.level === this.level)) {
        this.pendingTalentLevel = this.level;
        talentReady = true;
      }
    }
    return { leveled, talentReady };
  }

  pickTalent(id: HeroTalentId): boolean {
    const tier = HERO_TALENT_TIERS.find((t) => t.level === this.pendingTalentLevel);
    if (!tier || !tier.options.includes(id)) return false;
    if (this.talents.includes(id) && id !== 'attackSpeed') return false;
    this.talents.push(id);
    this.pendingTalentLevel = 0;
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 1;
    this.refreshStats();
    this.hp = Math.min(this.maxHp, Math.round(this.maxHp * ratio));
    return true;
  }

  talentOptions(): HeroTalentId[] {
    const tier = HERO_TALENT_TIERS.find((t) => t.level === this.pendingTalentLevel);
    return tier ? [...tier.options] : [];
  }

  canCast(id: HeroAbilityId): boolean {
    return this.alive && this.abilityCd[id] <= 0 && this.pendingTalentLevel === 0;
  }

  startAbilityCd(id: HeroAbilityId, baseCd: number): void {
    this.abilityCd[id] = baseCd;
  }

  applyDamage(raw: number): number {
    if (!this.alive) return 0;
    if (this.lastStandTimer > 0) return 0;
    let dmg = Math.max(1, raw - this.armor * 0.5);
    this.hp -= dmg;
    this.hurtFlash = 0.25;
    this.anim = 'hurt';
    if (this.hp <= 0) {
      this.hp = 0;
      this.beginDeath();
    }
    return dmg;
  }

  beginDeath(): void {
    this.alive = false;
    this.hasMoveTarget = false;
    this.deathFade = 0.9;
    this.anim = 'death';
    this.respawnTimer = HERO_RESPAWN_SEC;
    this.shieldWallTimer = 0;
    this.lastStandTimer = 0;
  }

  respawnAt(x: number, y: number): void {
    this.alive = true;
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.hasMoveTarget = false;
    this.hp = this.maxHp;
    this.respawnTimer = 0;
    this.deathFade = 0;
    this.respawnFlash = 0.8;
    this.anim = 'respawn';
    this.animTime = 0;
  }

  update(dt: number): void {
    this.animTime += dt;
    if (this.attackFlash > 0) this.attackFlash = Math.max(0, this.attackFlash - dt);
    if (this.hurtFlash > 0) this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.respawnFlash > 0) this.respawnFlash = Math.max(0, this.respawnFlash - dt);

    for (const k of Object.keys(this.abilityCd) as HeroAbilityId[]) {
      if (this.abilityCd[k] > 0) this.abilityCd[k] = Math.max(0, this.abilityCd[k] - dt);
    }
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);

    if (this.shieldWallTimer > 0) {
      this.shieldWallTimer = Math.max(0, this.shieldWallTimer - dt);
    }
    if (this.lastStandTimer > 0) {
      this.lastStandTimer = Math.max(0, this.lastStandTimer - dt);
      if (this.lastStandTimer <= 0) this.refreshStats();
    }

    if (!this.alive) {
      if (this.deathFade > 0) this.deathFade = Math.max(0, this.deathFade - dt);
      if (this.respawnTimer > 0) this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      return;
    }

    // Movement
    let moving = false;
    if (this.hasMoveTarget) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 4) {
        this.hasMoveTarget = false;
        this.x = this.targetX;
        this.y = this.targetY;
      } else {
        const step = this.moveSpeed * dt;
        const nx = dx / dist;
        const ny = dy / dist;
        this.x += nx * Math.min(step, dist);
        this.y += ny * Math.min(step, dist);
        this.angle = Math.atan2(dy, dx);
        moving = true;
        this.footstepTimer -= dt;
      }
    }

    if (this.attackFlash > 0.05) this.anim = 'attack';
    else if (this.hurtFlash > 0.05) this.anim = 'hurt';
    else if (this.respawnFlash > 0.2) this.anim = 'respawn';
    else if (moving) this.anim = 'walk';
    else this.anim = 'idle';
  }

  talentLabel(): string {
    if (!this.talents.length) return 'None';
    return this.talents.map((t) => HERO_TALENTS[t].name).join(', ');
  }

  toSnapshot(): {
    heroId: HeroId;
    x: number;
    y: number;
    hp: number;
    level: number;
    xp: number;
    talents: HeroTalentId[];
    abilityCd: Record<HeroAbilityId, number>;
    alive: boolean;
    respawnTimer: number;
    pendingTalentLevel: number;
  } {
    return {
      heroId: this.heroId,
      x: this.x,
      y: this.y,
      hp: this.hp,
      level: this.level,
      xp: this.xp,
      talents: [...this.talents],
      abilityCd: { ...this.abilityCd },
      alive: this.alive,
      respawnTimer: this.respawnTimer,
      pendingTalentLevel: this.pendingTalentLevel,
    };
  }

  fromSnapshot(snap: {
    heroId: HeroId;
    x: number;
    y: number;
    hp: number;
    level: number;
    xp: number;
    talents: HeroTalentId[];
    abilityCd: Record<string, number>;
    alive: boolean;
    respawnTimer: number;
    pendingTalentLevel?: number;
  }): void {
    this.spawn(snap.heroId, snap.x, snap.y);
    this.level = snap.level;
    this.xp = snap.xp;
    this.xpToNext = xpToNextLevel(this.level);
    this.talents = [...snap.talents];
    this.refreshStats();
    this.hp = Math.min(this.maxHp, snap.hp);
    this.abilityCd.shieldWall = snap.abilityCd.shieldWall ?? 0;
    this.abilityCd.rally = snap.abilityCd.rally ?? 0;
    this.abilityCd.lastStand = snap.abilityCd.lastStand ?? 0;
    this.pendingTalentLevel = snap.pendingTalentLevel ?? 0;
    this.alive = snap.alive;
    this.respawnTimer = snap.respawnTimer;
    if (!this.alive) {
      this.anim = 'death';
      this.deathFade = 0;
    }
  }
}
