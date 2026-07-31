import {
  getBranchName,
  getTowerStats,
  getUpgradeChoices,
  getUpgradeCost,
  TargetingMode,
  TowerLevelStats,
  TowerType,
  TOWER_DEFS,
  UpgradePath,
} from '../config/towers';
import { SELL_REFUND_RATIO } from '../config/constants';
import { applySynergyToStats, computeSynergy } from '../systems/synergies';
import { Enemy } from './enemy';
import { dist2 } from '../utils/math';

let nextTowerId = 1;

export class Tower {
  id = 0;
  active = false;
  type: TowerType = 'arrow';
  x = 0;
  y = 0;
  level = 1;
  /** Branch chosen at Tier 2 (`null` at Tier 1). */
  path: UpgradePath | null = null;
  angle = 0;
  cooldown = 0;
  targeting: TargetingMode = 'first';
  totalInvested = 0;
  kills = 0;
  damageDealt = 0;
  synergyLabels: string[] = [];

  // Laser ramp
  beamTargetId = 0;
  beamRamp = 0;
  beamActive = false;

  // Animation
  recoil = 0;
  muzzleFlash = 0;
  pulse = 0;
  animTime = 0;
  attacking = false;
  buildAnim = 0;
  sellAnim = 0;

  stats: TowerLevelStats = getTowerStats('arrow', 1);

  reset(): void {
    this.active = false;
    this.cooldown = 0;
    this.beamTargetId = 0;
    this.beamRamp = 0;
    this.beamActive = false;
    this.recoil = 0;
    this.muzzleFlash = 0;
    this.animTime = 0;
    this.attacking = false;
    this.buildAnim = 0;
    this.sellAnim = 0;
    this.path = null;
    this.synergyLabels = [];
  }

  get isWall(): boolean {
    return !!TOWER_DEFS[this.type].isWall;
  }

  get branchLabel(): string {
    return getBranchName(this.type, this.path, this.level);
  }

  getEffectiveStats(allTowers: Tower[]): TowerLevelStats {
    if (this.isWall) return this.stats;
    const buff = computeSynergy(this, allTowers);
    this.synergyLabels = buff.labels;
    return applySynergyToStats(this.stats, buff);
  }

  place(type: TowerType, x: number, y: number, targeting?: TargetingMode): void {
    const def = TOWER_DEFS[type];
    this.id = nextTowerId++;
    this.active = true;
    this.type = type;
    this.x = x;
    this.y = y;
    this.level = 1;
    this.path = null;
    this.targeting = targeting ?? def.defaultTargeting ?? 'first';
    this.totalInvested = def.cost;
    this.kills = 0;
    this.damageDealt = 0;
    this.cooldown = 0;
    this.angle = -Math.PI / 2;
    this.animTime = Math.random() * 3;
    this.buildAnim = 1;
    this.sellAnim = 0;
    this.refreshStats();
  }

  refreshStats(): void {
    this.stats = getTowerStats(this.type, this.level, this.path);
  }

  canUpgrade(): boolean {
    return this.level < TOWER_DEFS[this.type].maxLevel;
  }

  upgradeChoices() {
    return getUpgradeChoices(this.type, this.level, this.path);
  }

  upgradeCost(): number | null {
    return getUpgradeCost(this.type, this.level, this.path);
  }

  /** Apply a branch upgrade. Path required at Tier 1→2. */
  upgrade(path?: UpgradePath): boolean {
    const choices = this.upgradeChoices();
    if (choices.length === 0) return false;

    let choice = choices[0]!;
    if (this.level === 1) {
      if (!path) return false;
      const found = choices.find((c) => c.path === path);
      if (!found) return false;
      choice = found;
      this.path = path;
    } else if (path && path !== this.path) {
      return false;
    }

    this.level++;
    this.totalInvested += choice.cost;
    this.refreshStats();
    this.buildAnim = 0.7;
    return true;
  }

  sellValue(): number {
    return Math.floor(this.totalInvested * SELL_REFUND_RATIO);
  }

  updateAnim(dt: number): void {
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 4);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - dt * 8);
    if (this.buildAnim > 0) this.buildAnim = Math.max(0, this.buildAnim - dt * 3.2);
    if (this.sellAnim > 0) this.sellAnim = Math.max(0, this.sellAnim - dt * 4);
    this.attacking = this.muzzleFlash > 0.15 || this.recoil > 0.2;
    this.pulse += dt;
    this.animTime += dt;
    if (this.cooldown > 0) this.cooldown -= dt;
  }

  private scoreTarget(e: Enemy, d2: number): number {
    switch (this.targeting) {
      case 'first':
        return e.progress + e.threatPriority * 0.02;
      case 'last':
        return -e.progress;
      case 'strongest':
        return e.hp + e.shield + e.threatPriority;
      case 'weakest':
        return -(e.hp + e.shield) + e.threatPriority * 0.5;
      case 'closest':
        return -d2 + e.threatPriority * 8;
      case 'furthest':
        return d2;
      default:
        return e.progress;
    }
  }

  selectTarget(enemies: Enemy[]): Enemy | null {
    const list = this.selectTargets(enemies, 1);
    return list[0] ?? null;
  }

  /** Multi-target selection for Rapid Fire / similar specs. */
  selectTargets(enemies: Enemy[], count: number): Enemy[] {
    if (this.isWall || this.stats.range <= 0 || count <= 0) return [];
    const range2 = this.stats.range * this.stats.range;
    const def = TOWER_DEFS[this.type];
    const detectsInvisible =
      def.id === 'magic' ||
      def.id === 'sniper' ||
      def.id === 'tesla' ||
      def.id === 'laser' ||
      def.id === 'ballista';

    const scored: { e: Enemy; score: number }[] = [];
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]!;
      if (!e.active) continue;
      if (e.flying && !def.canTargetFlying) continue;
      // Stealth: only detector towers can lock on until revealed
      if (e.invisible && !e.isRevealed && !detectsInvisible) continue;
      const d2 = dist2(this.x, this.y, e.x, e.y);
      if (d2 > range2) continue;

      if (e.invisible && detectsInvisible) {
        e.status.revealTimer = Math.max(e.status.revealTimer, 1.2);
      }
      scored.push({ e, score: this.scoreTarget(e, d2) });
    }
    scored.sort((a, b) => b.score - a.score);
    const out: Enemy[] = [];
    for (let i = 0; i < scored.length && out.length < count; i++) {
      out.push(scored[i]!.e);
    }
    return out;
  }
}
