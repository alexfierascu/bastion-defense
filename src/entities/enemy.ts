import {
  canonicalEnemyType,
  directionalDamageMult,
  ENEMY_DEFS,
  EnemyType,
  scaleEnemyStats,
} from '../config/enemies';
import { DamageType, resistMultiplier } from '../config/combatTypes';
import type { AbilityRuntime } from '../systems/enemyAbilities';
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
  phaseEnrage: number;
  /** Banner aura resist bonus (0–1). */
  resistBuff: number;
  resistBuffTimer: number;
  /** Banner / haste speed bonus multiplier additive. */
  hasteBuff: number;
  hasteBuffTimer: number;
}

export class Enemy {
  id = 0;
  active = false;
  type: EnemyType = 'raider';
  x = 0;
  y = 0;
  angle = 0;
  pathDist = 0;

  maxHp = 1;
  hp = 1;
  armor = 0;
  speed = 70;
  baseSpeed = 70;
  /** Unmodified spawn speed (berserk / auras layer on top). */
  nativeSpeed = 70;
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
  modifiers: string[] = [];
  explosive = false;

  directionalShield = false;
  berserk = false;
  berserkActive = false;
  healsAura = false;
  bannerAura = false;
  siege = false;
  supportPace = false;
  selectColor = '#d4a574';
  healPulse = 0;
  bannerPulse = 0;
  auraTimer = 0;

  path: PathPoint[] = [];
  pathLen = 0;
  pathIndex = 0;
  phase = 0;
  phaseAnnounced = 0;
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
    resistBuff: 0,
    resistBuffTimer: 0,
    hasteBuff: 0,
    hasteBuffTimer: 0,
  };

  hitFlash = 0;
  /** Brief movement hitch after impact (seconds). */
  hitStagger = 0;
  /** Soft knockback offset from path (decays). */
  hitOffX = 0;
  hitOffY = 0;
  /** Squash/stretch punch from heavy hits. */
  hitPunch = 0;
  bobPhase = 0;
  animTime = 0;
  deathFade = 0;
  deathMax = 0.6;
  deathVx = 0;
  deathVy = 0;
  deathSpin = 1;
  /** Brief weapon/loot flake during death (seconds remaining). */
  deathLoot = 0;
  deathLootAngle = 0;
  hpDisplay = 0;
  hpBarAlpha = 0;
  hpBarFlash = 0;
  lastHitZone: 'front' | 'side' | 'rear' | null = null;
  /** Cooldown for attacking a nearby hero. */
  heroAttackCd = 0;

  /** Modular ability runtimes (TICKET-010). */
  abilities: AbilityRuntime[] = [];
  /** Boss framework id when controlled by BossController. */
  bossId: string | null = null;
  bossControlled = false;

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
    this.modifiers = [];
    this.explosive = false;
    this.directionalShield = false;
    this.berserk = false;
    this.berserkActive = false;
    this.healsAura = false;
    this.bannerAura = false;
    this.siege = false;
    this.supportPace = false;
    this.healPulse = 0;
    this.bannerPulse = 0;
    this.auraTimer = 0;
    this.lastHitZone = null;
    this.heroAttackCd = 0;
    this.abilities = [];
    this.bossId = null;
    this.bossControlled = false;
    this.status.slowAmount = 0;
    this.status.slowTimer = 0;
    this.status.freezeTimer = 0;
    this.status.stunTimer = 0;
    this.status.poisonDps = 0;
    this.status.poisonTimer = 0;
    this.status.revealTimer = 0;
    this.status.phaseEnrage = 0;
    this.status.resistBuff = 0;
    this.status.resistBuffTimer = 0;
    this.status.hasteBuff = 0;
    this.status.hasteBuffTimer = 0;
    this.hitFlash = 0;
    this.hitStagger = 0;
    this.hitOffX = 0;
    this.hitOffY = 0;
    this.hitPunch = 0;
    this.deathFade = 0;
    this.deathMax = 0.6;
    this.deathVx = 0;
    this.deathVy = 0;
    this.deathSpin = 1;
    this.deathLoot = 0;
    this.deathLootAngle = 0;
    this.hpDisplay = 0;
    this.hpBarAlpha = 0;
    this.hpBarFlash = 0;
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
      armorFlat?: number;
      shieldFlat?: number;
      radiusMult?: number;
      leakBonus?: number;
      forceRegen?: boolean;
      explosive?: boolean;
      modifierLabels?: string[];
      stealthForce?: boolean;
    },
  ): void {
    const canon = canonicalEnemyType(type);
    const def = ENEMY_DEFS[canon];
    const scaled = scaleEnemyStats(
      canon,
      wave,
      opts?.hpMult ?? 1,
      opts?.rewardMult ?? 1,
      opts?.speedMult ?? 1,
    );
    this.id = nextEnemyId++;
    this.active = true;
    this.type = canon;
    this.maxHp = scaled.hp;
    this.hp = scaled.hp;
    this.armor = scaled.armor + (opts?.armorFlat ?? 0);
    this.nativeSpeed = scaled.speed;
    this.baseSpeed = scaled.speed;
    this.speed = scaled.speed;
    this.reward = scaled.reward;
    this.radius = def.radius * (opts?.radiusMult ?? 1);
    this.flying = def.flying;
    this.invisible = def.invisible || !!opts?.stealthForce;
    this.regenerates = def.regenerates || !!opts?.forceRegen;
    this.regenRate = scaled.regenRate + (opts?.forceRegen && !def.regenerates ? 4 : 0);
    this.shield = scaled.shield + (opts?.shieldFlat ?? 0);
    this.maxShield = this.shield;
    this.isBoss = def.isBoss;
    this.damageToBase = def.damageToBase + (opts?.leakBonus ?? 0);
    this.resistances = { ...def.resistances };
    this.modifiers = opts?.modifierLabels ? [...opts.modifierLabels] : [];
    this.explosive = !!opts?.explosive;
    this.directionalShield = !!def.directionalShield;
    this.berserk = !!def.berserk;
    this.berserkActive = false;
    this.healsAura = !!def.healsAura;
    this.bannerAura = !!def.bannerAura;
    this.siege = !!def.siege;
    this.supportPace = !!def.supportPace;
    this.selectColor = def.selectColor;
    this.color = def.color;
    this.accent = def.accent;
    this.auraTimer = 0.4 + Math.random() * 0.6;
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
    this.hpDisplay = scaled.hp;
    this.hpBarAlpha = 0;
    this.hpBarFlash = 0;
    this.deathFade = 0;
    this.deathVx = 0;
    this.deathVy = 0;
    this.deathSpin = 1;
    this.animTime = Math.random();
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

  /** Threat weight for targeting (supports must die first). */
  get threatPriority(): number {
    if (this.healsAura) return 280;
    if (this.bannerAura) return 260;
    if (this.siege) return 200;
    if (this.berserk && this.berserkActive) return 120;
    if (this.isBoss) return 180;
    return 0;
  }

  applyDamage(
    raw: number,
    armorPen: number,
    damageType?: DamageType,
    attacker?: { x: number; y: number } | null,
  ): number {
    let dmg = raw;
    if (damageType) {
      let resist = this.resistances[damageType] ?? 0;
      if (this.status.resistBuffTimer > 0) resist += this.status.resistBuff;
      dmg *= resistMultiplier(Math.min(0.75, resist));
    }

    if (this.directionalShield && attacker) {
      const dir = directionalDamageMult(this.angle, this.x, this.y, attacker.x, attacker.y);
      dmg *= dir.mult;
      this.lastHitZone = dir.zone;
    } else {
      this.lastHitZone = null;
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
    this.hitFlash = 0.14;
    this.hpBarFlash = 0.28;
    this.hpBarAlpha = 1;
    if (this.invisible) this.status.revealTimer = 1.5;
    this.tryBerserk();
    return dealt;
  }

  /**
   * Per-attack-type impact feel. Bosses barely flinch; arrows stagger lightly;
   * ballista knocks hard; splash applies area impulse.
   */
  applyHitReaction(
    source: string,
    fromX: number,
    fromY: number,
    opts?: { splash?: boolean; crit?: boolean },
  ): void {
    if (dealtIsBossMass(this)) {
      this.hitFlash = Math.max(this.hitFlash, 0.1);
      this.hitPunch = Math.max(this.hitPunch, 0.08);
      return;
    }

    const dx = this.x - fromX;
    const dy = this.y - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const critBoost = opts?.crit ? 1.25 : 1;

    let knock = 4;
    let stagger = 0.05;
    let punch = 0.12;

    switch (source) {
      case 'arrow':
      case 'sniper':
        knock = 5 * critBoost;
        stagger = 0.06;
        punch = 0.1;
        break;
      case 'ballista':
        knock = 22 * critBoost;
        stagger = 0.18;
        punch = 0.28;
        break;
      case 'cannon':
      case 'rocket':
        knock = opts?.splash ? 16 : 12;
        stagger = 0.12;
        punch = 0.22;
        break;
      case 'magic':
        knock = 7;
        stagger = 0.08;
        punch = 0.14;
        break;
      case 'freeze':
        knock = 3;
        stagger = 0.1;
        punch = 0.1;
        break;
      case 'poison':
        knock = 2;
        stagger = 0.04;
        punch = 0.08;
        break;
      case 'tesla':
      case 'laser':
        knock = 3;
        stagger = 0.05;
        punch = 0.12;
        break;
      case 'hero':
        knock = 10;
        stagger = 0.1;
        punch = 0.16;
        break;
      default:
        knock = 6;
        stagger = 0.07;
        punch = 0.12;
    }

    if (this.siege || this.bruteLike()) {
      knock *= 0.45;
      stagger *= 0.55;
    }

    this.hitOffX += nx * knock;
    this.hitOffY += ny * knock * 0.65;
    const maxOff = this.isBoss ? 4 : 28;
    const offLen = Math.hypot(this.hitOffX, this.hitOffY);
    if (offLen > maxOff) {
      this.hitOffX = (this.hitOffX / offLen) * maxOff;
      this.hitOffY = (this.hitOffY / offLen) * maxOff;
    }
    this.hitStagger = Math.max(this.hitStagger, stagger);
    this.hitPunch = Math.max(this.hitPunch, punch);
    this.hitFlash = Math.max(this.hitFlash, 0.1 + punch * 0.2);
  }

  private tryBerserk(): void {
    // Enrage ability owns this transition when attached
    if (this.abilities.some((a) => a.id === 'enrage')) return;
    if (!this.berserk || this.berserkActive || this.hp <= 0) return;
    if (this.hp / this.maxHp > 0.4) return;
    this.berserkActive = true;
    this.nativeSpeed *= 1.55;
    this.baseSpeed = this.nativeSpeed;
    this.speed = this.baseSpeed;
    this.bossPulse = 0.7;
    this.accent = '#ff2200';
  }

  beginDeath(kx = 0, ky = 0): void {
    this.active = false;
    const def = ENEMY_DEFS[this.type];
    switch (def.deathStyle) {
      case 'pop':
        this.deathMax = 0.42 + Math.random() * 0.12;
        this.deathSpin = 2.6;
        break;
      case 'burst':
        this.deathMax = 0.78 + Math.random() * 0.18;
        this.deathSpin = 1.6;
        break;
      case 'fade':
        this.deathMax = 0.85 + Math.random() * 0.2;
        this.deathSpin = 0.35;
        break;
      case 'crumble':
        this.deathMax = 0.7 + Math.random() * 0.18;
        this.deathSpin = 0.85;
        break;
      default:
        this.deathMax = this.isBoss ? 1.05 : 0.6 + Math.random() * 0.22;
        this.deathSpin = 1;
    }
    this.deathFade = this.deathMax;
    this.deathVx = kx;
    this.deathVy = ky;
    this.deathLoot = this.isBoss ? 0 : 0.45 + Math.random() * 0.25;
    this.deathLootAngle = Math.random() * Math.PI * 2;
    this.hpBarAlpha = 0;
  }

  updateFeel(dt: number): void {
    const targetHp = Math.max(0, this.hp);
    this.hpDisplay += (targetHp - this.hpDisplay) * Math.min(1, dt * 14);
    if (Math.abs(this.hpDisplay - targetHp) < 0.4) this.hpDisplay = targetHp;

    if (this.hpBarFlash > 0) this.hpBarFlash -= dt;
    const full = this.maxHp > 0 && this.hpDisplay >= this.maxHp - 0.5 && this.hp >= this.maxHp;
    const want = full && this.hpBarFlash <= 0 ? 0 : this.active ? 1 : 0;
    this.hpBarAlpha += (want - this.hpBarAlpha) * Math.min(1, dt * 6);
    if (this.hpBarAlpha < 0.02) this.hpBarAlpha = 0;

    if (this.healPulse > 0) this.healPulse = Math.max(0, this.healPulse - dt);
    if (this.bannerPulse > 0) this.bannerPulse = Math.max(0, this.bannerPulse - dt);
    if (this.hitPunch > 0) this.hitPunch = Math.max(0, this.hitPunch - dt * 4);
    if (this.hitStagger > 0) this.hitStagger = Math.max(0, this.hitStagger - dt);
    // Soft spring-back for knock offset
    this.hitOffX *= Math.max(0, 1 - dt * 7);
    this.hitOffY *= Math.max(0, 1 - dt * 7);
    if (Math.abs(this.hitOffX) < 0.15) this.hitOffX = 0;
    if (Math.abs(this.hitOffY) < 0.15) this.hitOffY = 0;

    if (!this.active && this.deathFade > 0) {
      this.x += this.deathVx * dt;
      this.y += this.deathVy * dt;
      this.deathVx *= Math.max(0, 1 - dt * 3.2);
      this.deathVy *= Math.max(0, 1 - dt * 3.2);
      this.deathVy += 28 * dt; // light gravity on corpses
      if (this.deathLoot > 0) this.deathLoot = Math.max(0, this.deathLoot - dt);
    }
  }

  applySlow(amount: number, duration: number): void {
    if (this.siege) {
      amount *= 0.25;
      duration *= 0.5;
    }
    if (amount >= this.status.slowAmount) {
      this.status.slowAmount = amount;
      this.status.slowTimer = Math.max(this.status.slowTimer, duration);
    } else {
      this.status.slowTimer = Math.max(this.status.slowTimer, duration * 0.5);
    }
  }

  applyFreeze(duration: number): void {
    if (this.status.phaseEnrage > 0) return;
    if (this.siege) duration *= 0.2;
    if (duration <= 0.05) return;
    this.status.freezeTimer = Math.max(this.status.freezeTimer, duration);
  }

  applyStun(duration: number): void {
    if (this.status.phaseEnrage > 0) return;
    if (this.siege) duration *= 0.35;
    this.status.stunTimer = Math.max(this.status.stunTimer, duration);
  }

  applyPoison(dps: number, duration: number): void {
    this.status.poisonDps = Math.max(this.status.poisonDps, dps);
    this.status.poisonTimer = Math.max(this.status.poisonTimer, duration);
  }

  stripShield(): void {
    this.shield = 0;
  }

  applyBannerBuff(speedBonus: number, resistBonus: number, duration: number): void {
    if (this.healsAura || this.bannerAura) return;
    this.status.hasteBuff = Math.max(this.status.hasteBuff, speedBonus);
    this.status.hasteBuffTimer = Math.max(this.status.hasteBuffTimer, duration);
    this.status.resistBuff = Math.max(this.status.resistBuff, resistBonus);
    this.status.resistBuffTimer = Math.max(this.status.resistBuffTimer, duration);
  }

  receiveHeal(amount: number): void {
    if (!this.active || this.hp <= 0) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.hpBarAlpha = 1;
  }

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
    this.syncPathPosition();
  }

  syncPathPosition(): void {
    if (!this.path.length) return;
    const pos = getPositionAlongPath(this.path, this.pathDist);
    this.x = pos.x;
    this.y = pos.y;
    this.angle = pos.angle;
  }

  private checkBossPhases(): void {
    // BossController owns phases for framed bosses
    if (this.bossControlled || !this.isBoss || this.hp <= 0) return;
    const ratio = this.hp / this.maxHp;

    if (this.phase < 1 && ratio <= 0.66) {
      this.phase = 1;
      this.phaseAnnounced = 1;
      const bonus = this.maxHp * 0.15;
      this.shield += bonus;
      this.maxShield = Math.max(this.maxShield, this.shield);
      this.nativeSpeed *= 1.15;
      this.baseSpeed = this.nativeSpeed;
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
      this.nativeSpeed *= 1.25;
      this.baseSpeed = this.nativeSpeed;
      this.speed = this.baseSpeed;
      this.bossPulse = 1.1;
      this.onBossPhase?.(this, 2);
    }
  }

  /**
   * Support pacing + auras. Call once per tick with the live enemy list.
   */
  tickRoles(dt: number, allies: Enemy[]): void {
    if (!this.active) return;

    if (this.supportPace) {
      let frontProgress = this.pathDist;
      let foundTank = false;
      for (const a of allies) {
        if (!a.active || a.id === this.id || a.flying) continue;
        if (a.supportPace || a.healsAura || a.bannerAura) continue;
        if (a.pathIndex !== this.pathIndex && a.pathLen > 0) continue;
        foundTank = true;
        if (a.pathDist > frontProgress) frontProgress = a.pathDist;
      }
      if (foundTank) {
        const lead = this.pathDist - frontProgress;
        // Stay ~40–90px behind the front line
        if (lead > 55) this.baseSpeed = this.nativeSpeed * 0.45;
        else if (lead < 15) this.baseSpeed = this.nativeSpeed * 1.05;
        else this.baseSpeed = this.nativeSpeed * 0.85;
      } else {
        this.baseSpeed = this.nativeSpeed * 0.9;
      }
    } else if (!this.berserkActive) {
      this.baseSpeed = this.nativeSpeed;
    } else {
      this.baseSpeed = this.nativeSpeed;
    }

    this.auraTimer -= dt;
    if (this.auraTimer > 0) return;
    this.auraTimer = this.healsAura ? 1.35 : 1.1;

    if (this.healsAura) {
      this.healPulse = 0.45;
      const healAmt = Math.max(6, this.maxHp * 0.12);
      for (const a of allies) {
        if (!a.active || a.id === this.id) continue;
        const dx = a.x - this.x;
        const dy = a.y - this.y;
        if (dx * dx + dy * dy <= 95 * 95) a.receiveHeal(healAmt);
      }
    }

    if (this.bannerAura) {
      this.bannerPulse = 0.5;
      for (const a of allies) {
        if (!a.active || a.id === this.id) continue;
        const dx = a.x - this.x;
        const dy = a.y - this.y;
        if (dx * dx + dy * dy <= 110 * 110) {
          a.applyBannerBuff(0.18, 0.12, 1.4);
        }
      }
    }
  }

  update(
    dt: number,
    path?: PathPoint[],
    pathLen?: number,
    _ctx?: unknown,
  ): 'alive' | 'dead' | 'leaked' {
    if (!this.active) {
      this.updateFeel(dt);
      return 'dead';
    }

    const activePath = this.path.length > 0 ? this.path : (path ?? []);
    const activeLen = this.path.length > 0 ? this.pathLen : (pathLen ?? 0);

    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.updateFeel(dt);
    if (this.status.revealTimer > 0) this.status.revealTimer -= dt;
    if (this.bossPulse > 0) this.bossPulse = Math.max(0, this.bossPulse - dt);
    if (this.status.phaseEnrage > 0) this.status.phaseEnrage = Math.max(0, this.status.phaseEnrage - dt);
    if (this.status.resistBuffTimer > 0) {
      this.status.resistBuffTimer -= dt;
      if (this.status.resistBuffTimer <= 0) this.status.resistBuff = 0;
    }
    if (this.status.hasteBuffTimer > 0) {
      this.status.hasteBuffTimer -= dt;
      if (this.status.hasteBuffTimer <= 0) this.status.hasteBuff = 0;
    }

    const animRate = this.scoutAnimRate();
    this.bobPhase += dt * (4 + (this.berserkActive ? 3 : 0));
    this.animTime += dt * animRate;

    if (this.status.poisonTimer > 0) {
      this.status.poisonTimer -= dt;
      this.applyDamage(this.status.poisonDps * dt, 0.2, 'poison');
      if (this.status.poisonTimer <= 0) this.status.poisonDps = 0;
    }

    this.checkBossPhases();
    this.tryBerserk();

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

    let speedMult = 1 + (this.status.hasteBuffTimer > 0 ? this.status.hasteBuff : 0);
    if (this.status.slowTimer > 0) {
      this.status.slowTimer -= dt;
      speedMult *= 1 - this.status.slowAmount;
      if (this.status.slowTimer <= 0) this.status.slowAmount = 0;
    }
    if (this.hitStagger > 0) {
      speedMult *= 0.35;
    }

    this.pathDist += this.baseSpeed * speedMult * dt;
    if (this.pathDist >= activeLen) {
      this.active = false;
      return 'leaked';
    }

    const pos = getPositionAlongPath(activePath, this.pathDist);
    const bob =
      this.type === 'scout'
        ? Math.sin(this.bobPhase) * 2
        : this.flying
          ? Math.sin(this.bobPhase) * 4
          : 0;
    this.x = pos.x + this.hitOffX;
    this.y =
      (this.flying ? pos.y - 8 + bob : pos.y + bob * 0.15) + this.hitOffY;
    this.angle = pos.angle;
    this.speed = this.baseSpeed * speedMult;
    return 'alive';
  }

  private scoutAnimRate(): number {
    if (this.flying) return 1.2;
    if (this.type === 'scout') return 1.8;
    if (this.berserkActive) return 1.6;
    if (this.siege) return 0.55;
    if (this.bruteLike()) return 0.7;
    return 1;
  }

  private bruteLike(): boolean {
    return this.type === 'brute' || this.type === 'siege';
  }
}

function dealtIsBossMass(e: Enemy): boolean {
  return e.isBoss || e.bossControlled;
}
