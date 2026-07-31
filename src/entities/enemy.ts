import { ENEMY_DEFS, EnemyType, scaleEnemyStats } from '../config/enemies';
import { DamageType, resistMultiplier } from '../config/combatTypes';
import { getPositionAlongPath, PathPoint } from '../systems/map';

let nextEnemyId = 1;

export interface StatusEffect {
  slowAmount: number;
  slowTimer: number;
  freezeTimer: number;
  stunTimer: number;
  poisonDps: number;
  poisonTimer: number;
  revealTimer: number;
  /** Remaining freeze-immunity seconds (boss phase enrage). */
  phaseEnrage: number;
}

export class Enemy {
  id = 0;
  active = false;
  type: EnemyType = 'basic';
  x = 0;
  y = 0;
  angle = 0;
  pathDist = 0;

  maxHp = 1;
  hp = 1;
  armor = 0;
  speed = 70;
  baseSpeed = 70;
  reward = 0;
  radius = 12;
  flying = false;
  invisible = false;
  regenerates = false;
  regenRate = 0;
  shield = 0;
  maxShield = 0;
  isBoss = false;
  damageToBase = 1;
  resistances: Partial<Record<DamageType, number>> = {};

  path: PathPoint[] = [];
  pathLen = 0;
  pathIndex = 0;
  /** Boss phase 0–2. */
  phase = 0;
  phaseAnnounced = 0;
  /** Visual telegraph timer for boss phase transitions. */
  bossPulse = 0;
  onBossPhase?: (enemy: Enemy, phase: number) => void;

  color = '#888';
  accent = '#ccc';

  status: StatusEffect = {
    slowAmount: 0,
    slowTimer: 0,
    freezeTimer: 0,
    stunTimer: 0,
    poisonDps: 0,
    poisonTimer: 0,
    revealTimer: 0,
    phaseEnrage: 0,
  };

  hitFlash = 0;
  bobPhase = 0;
  animTime = 0;
  /** Seconds of death dissolve remaining (inactive but still drawn). */
  deathFade = 0;

  reset(): void {
    this.active = false;
    this.pathDist = 0;
    this.hp = 0;
    this.shield = 0;
    this.path = [];
    this.pathLen = 0;
    this.pathIndex = 0;
    this.phase = 0;
    this.phaseAnnounced = 0;
    this.bossPulse = 0;
    this.onBossPhase = undefined;
    this.resistances = {};
    this.status.slowAmount = 0;
    this.status.slowTimer = 0;
    this.status.freezeTimer = 0;
    this.status.stunTimer = 0;
    this.status.poisonDps = 0;
    this.status.poisonTimer = 0;
    this.status.revealTimer = 0;
    this.status.phaseEnrage = 0;
    this.hitFlash = 0;
    this.deathFade = 0;
  }

  spawn(
    type: EnemyType,
    wave: number,
    path: PathPoint[],
    opts?: {
      hpMult?: number;
      rewardMult?: number;
      speedMult?: number;
      pathIndex?: number;
    },
  ): void {
    const def = ENEMY_DEFS[type];
    const scaled = scaleEnemyStats(
      type,
      wave,
      opts?.hpMult ?? 1,
      opts?.rewardMult ?? 1,
      opts?.speedMult ?? 1,
    );
    this.id = nextEnemyId++;
    this.active = true;
    this.type = type;
    this.maxHp = scaled.hp;
    this.hp = scaled.hp;
    this.armor = scaled.armor;
    this.baseSpeed = scaled.speed;
    this.speed = scaled.speed;
    this.reward = scaled.reward;
    this.radius = def.radius;
    this.flying = def.flying;
    this.invisible = def.invisible;
    this.regenerates = def.regenerates;
    this.regenRate = scaled.regenRate;
    this.shield = scaled.shield;
    this.maxShield = scaled.shield;
    this.isBoss = def.isBoss;
    this.damageToBase = def.damageToBase;
    this.resistances = { ...def.resistances };
    this.color = def.color;
    this.accent = def.accent;
    this.path = path;
    this.pathLen = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      this.pathLen += Math.hypot(b.x - a.x, b.y - a.y);
    }
    this.pathIndex = opts?.pathIndex ?? 0;
    this.phase = 0;
    this.phaseAnnounced = 0;
    this.bossPulse = 0;
    this.status.phaseEnrage = 0;
    this.pathDist = 0;
    this.bobPhase = Math.random() * Math.PI * 2;
    const pos = getPositionAlongPath(path, this.pathDist);
    this.x = pos.x;
    this.y = pos.y;
    this.angle = pos.angle;
  }

  get progress(): number {
    return this.pathDist;
  }

  get isRevealed(): boolean {
    return !this.invisible || this.status.revealTimer > 0;
  }

  applyDamage(raw: number, armorPen: number, damageType?: DamageType): number {
    let dmg = raw;
    if (damageType) {
      const resist = this.resistances[damageType] ?? 0;
      dmg *= resistMultiplier(resist);
    }
    const effectiveArmor = this.armor * (1 - armorPen);
    dmg = Math.max(1, dmg - effectiveArmor);

    let dealt = 0;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, dmg);
      this.shield -= absorbed;
      dmg -= absorbed;
      dealt += absorbed;
    }
    if (dmg > 0) {
      this.hp -= dmg;
      dealt += dmg;
    }
    this.hitFlash = 0.12;
    if (this.invisible) this.status.revealTimer = 1.5;
    return dealt;
  }

  applySlow(amount: number, duration: number): void {
    if (amount >= this.status.slowAmount) {
      this.status.slowAmount = amount;
      this.status.slowTimer = Math.max(this.status.slowTimer, duration);
    } else {
      this.status.slowTimer = Math.max(this.status.slowTimer, duration * 0.5);
    }
  }

  applyFreeze(duration: number): void {
    if (this.status.phaseEnrage > 0) return;
    this.status.freezeTimer = Math.max(this.status.freezeTimer, duration);
  }

  applyStun(duration: number): void {
    if (this.status.phaseEnrage > 0) return;
    this.status.stunTimer = Math.max(this.status.stunTimer, duration);
  }

  applyPoison(dps: number, duration: number): void {
    this.status.poisonDps = Math.max(this.status.poisonDps, dps);
    this.status.poisonTimer = Math.max(this.status.poisonTimer, duration);
  }

  stripShield(): void {
    this.shield = 0;
  }

  /** Switch path while preserving progress ratio (used when walls reroute lanes). */
  repath(path: PathPoint[]): void {
    const ratio = this.pathLen > 0 ? Math.min(0.98, this.pathDist / this.pathLen) : 0;
    this.path = path;
    this.pathLen = 0;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!;
      const b = path[i]!;
      this.pathLen += Math.hypot(b.x - a.x, b.y - a.y);
    }
    this.pathDist = ratio * this.pathLen;
    const pos = getPositionAlongPath(path, this.pathDist);
    this.x = pos.x;
    this.y = pos.y;
    this.angle = pos.angle;
  }

  private checkBossPhases(): void {
    if (!this.isBoss || this.hp <= 0) return;
    const ratio = this.hp / this.maxHp;

    if (this.phase < 1 && ratio <= 0.66) {
      this.phase = 1;
      this.phaseAnnounced = 1;
      const bonus = this.maxHp * 0.15;
      this.shield += bonus;
      this.maxShield = Math.max(this.maxShield, this.shield);
      this.baseSpeed *= 1.15;
      this.speed = this.baseSpeed;
      this.bossPulse = 0.9;
      this.onBossPhase?.(this, 1);
    }

    if (this.phase < 2 && ratio <= 0.33) {
      this.phase = 2;
      this.phaseAnnounced = 2;
      this.status.stunTimer = 0;
      this.status.freezeTimer = 0;
      this.status.phaseEnrage = 2;
      this.regenRate *= 2;
      this.baseSpeed *= 1.25;
      this.speed = this.baseSpeed;
      this.bossPulse = 1.1;
      this.onBossPhase?.(this, 2);
    }
  }

  /**
   * @returns 'alive' | 'dead' | 'leaked'
   */
  update(
    dt: number,
    path?: PathPoint[],
    pathLen?: number,
    _ctx?: unknown,
  ): 'alive' | 'dead' | 'leaked' {
    if (!this.active) return 'dead';

    const activePath = this.path.length > 0 ? this.path : (path ?? []);
    const activeLen = this.path.length > 0 ? this.pathLen : (pathLen ?? 0);

    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.status.revealTimer > 0) this.status.revealTimer -= dt;
    if (this.bossPulse > 0) this.bossPulse = Math.max(0, this.bossPulse - dt);
    if (this.status.phaseEnrage > 0) this.status.phaseEnrage = Math.max(0, this.status.phaseEnrage - dt);
    this.bobPhase += dt * 4;
    this.animTime += dt * (this.flying ? 1.2 : 1);

    if (this.status.poisonTimer > 0) {
      this.status.poisonTimer -= dt;
      this.applyDamage(this.status.poisonDps * dt, 0.2, 'poison');
      if (this.status.poisonTimer <= 0) this.status.poisonDps = 0;
    }

    this.checkBossPhases();

    if (this.hp <= 0) {
      this.active = false;
      return 'dead';
    }

    if (this.regenerates && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + this.regenRate * dt);
    }

    if (this.status.freezeTimer > 0) {
      this.status.freezeTimer -= dt;
      return 'alive';
    }
    if (this.status.stunTimer > 0) {
      this.status.stunTimer -= dt;
      return 'alive';
    }

    let speedMult = 1;
    if (this.status.slowTimer > 0) {
      this.status.slowTimer -= dt;
      speedMult *= 1 - this.status.slowAmount;
      if (this.status.slowTimer <= 0) this.status.slowAmount = 0;
    }

    this.pathDist += this.baseSpeed * speedMult * dt;
    if (this.pathDist >= activeLen) {
      this.active = false;
      return 'leaked';
    }

    const pos = getPositionAlongPath(activePath, this.pathDist);
    this.x = pos.x;
    this.y = this.flying ? pos.y - 8 + Math.sin(this.bobPhase) * 4 : pos.y;
    this.angle = pos.angle;
    return 'alive';
  }
}
