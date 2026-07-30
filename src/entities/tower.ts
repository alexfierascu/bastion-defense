import {
  getTowerStats,
  getUpgradeCost,
  TargetingMode,
  TowerLevelStats,
  TowerType,
  TOWER_DEFS,
} from '../config/towers';
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
    this.synergyLabels = [];
  }

  get isWall(): boolean {
    return !!TOWER_DEFS[this.type].isWall;
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
    this.targeting = targeting ?? def.defaultTargeting ?? 'first';
    this.totalInvested = def.cost;
    this.kills = 0;
    this.damageDealt = 0;
    this.cooldown = 0;
    this.angle = -Math.PI / 2;
    this.animTime = Math.random() * 3;
    this.refreshStats();
  }

  refreshStats(): void {
    this.stats = getTowerStats(this.type, this.level);
  }

  canUpgrade(): boolean {
    return this.level < TOWER_DEFS[this.type].maxLevel;
  }

  upgradeCost(): number | null {
    return getUpgradeCost(this.type, this.level);
  }

  upgrade(): boolean {
    const cost = this.upgradeCost();
    if (cost === null) return false;
    this.level++;
    this.totalInvested += cost;
    this.refreshStats();
    return true;
  }

  sellValue(): number {
    return Math.floor(this.totalInvested * 0.7);
  }

  updateAnim(dt: number): void {
    if (this.recoil > 0) this.recoil = Math.max(0, this.recoil - dt * 4);
    if (this.muzzleFlash > 0) this.muzzleFlash = Math.max(0, this.muzzleFlash - dt * 8);
    this.attacking = this.muzzleFlash > 0.15 || this.recoil > 0.2;
    this.pulse += dt;
    this.animTime += dt;
    if (this.cooldown > 0) this.cooldown -= dt;
  }

  selectTarget(enemies: Enemy[]): Enemy | null {
    if (this.isWall || this.stats.range <= 0) return null;
    const range2 = this.stats.range * this.stats.range;
    const def = TOWER_DEFS[this.type];
    let best: Enemy | null = null;
    let bestScore = -Infinity;

    // Shades are visually camouflaged but must remain targetable in range.
    // (Previously they were skipped until damaged — so an all-Shade wave never took fire.)
    const detectsInvisible =
      def.id === 'magic' || def.id === 'sniper' || def.id === 'tesla' || def.id === 'laser';

    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i]!;
      if (!e.active) continue;
      if (e.flying && !def.canTargetFlying) continue;
      const d2 = dist2(this.x, this.y, e.x, e.y);
      if (d2 > range2) continue;

      if (e.invisible) {
        e.status.revealTimer = Math.max(
          e.status.revealTimer,
          detectsInvisible ? 1.2 : 0.5,
        );
      }

      let score = 0;
      switch (this.targeting) {
        case 'first':
          score = e.progress;
          break;
        case 'last':
          score = -e.progress;
          break;
        case 'strongest':
          score = e.hp + e.shield;
          break;
        case 'weakest':
          score = -(e.hp + e.shield);
          break;
        case 'closest':
          score = -d2;
          break;
        case 'furthest':
          score = d2;
          break;
      }
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }
}
