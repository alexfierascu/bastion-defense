import { ACHIEVEMENTS, AchievementId, AchievementReward } from '../config/achievements';
import { PathThemeId, TowerSkinId } from '../config/cosmetics';
import { TowerType } from '../config/towers';
import { SaveManager } from '../save/saveManager';
import { EventBus, GameEvents } from '../utils/events';

export interface SessionCounters {
  kills: number;
  towersBuilt: number;
  goldEarned: number;
  goldSpent: number;
  bossesKilled: number;
  flawlessWaves: number;
  consecutiveFlawless: number;
  towerTypesBuilt: Set<string>;
  abilitiesUsed: Set<string>;
  maxedTower: boolean;
  sniperCrits: number;
  laserDamage: number;
  rocketKills: number;
  freezeSlows: number;
  poisonApps: number;
  chain5: boolean;
  timeAt4x: number;
  overkillHit: boolean;
  highestWave: number;
}

export function createSessionCounters(): SessionCounters {
  return {
    kills: 0,
    towersBuilt: 0,
    goldEarned: 0,
    goldSpent: 0,
    bossesKilled: 0,
    flawlessWaves: 0,
    consecutiveFlawless: 0,
    towerTypesBuilt: new Set(),
    abilitiesUsed: new Set(),
    maxedTower: false,
    sniperCrits: 0,
    laserDamage: 0,
    rocketKills: 0,
    freezeSlows: 0,
    poisonApps: 0,
    chain5: false,
    timeAt4x: 0,
    overkillHit: false,
    highestWave: 0,
  };
}

export class AchievementTracker {
  constructor(
    private save: SaveManager,
    private bus: EventBus,
  ) {}

  private grantReward(reward?: AchievementReward): string {
    if (!reward) return '';
    const bits: string[] = [];
    if (reward.rp) {
      this.save.data.researchPoints += reward.rp;
      bits.push(`+${reward.rp} RP`);
    }
    if (reward.bankGold) {
      this.save.data.bankedGold += reward.bankGold;
      bits.push(`+${reward.bankGold}g bank`);
    }
    if (reward.unlockTower) {
      if (this.save.unlockTower(reward.unlockTower as TowerType)) {
        bits.push(`Unlocked ${reward.unlockTower}`);
      }
    }
    if (reward.unlockCosmetic) {
      if (this.save.unlockCosmetic(reward.unlockCosmetic)) {
        bits.push(`Cosmetic: ${reward.unlockCosmetic}`);
      }
      // Auto-enable cosmetic ids that match theme/skin catalogs
      const cos = reward.unlockCosmetic as PathThemeId | TowerSkinId;
      if (cos === 'frost' || cos === 'crimson' || cos === 'ash') {
        /* theme unlocked only */
      }
      if (cos === 'ghost' || cos === 'bronze') {
        /* skin unlocked only */
      }
    }
    this.save.save();
    return bits.join(' · ');
  }

  check(session: SessionCounters, lives: number, startingLives: number, won: boolean): void {
    const tryUnlock = (id: AchievementId) => {
      if (this.save.unlockAchievement(id)) {
        const def = ACHIEVEMENTS.find((a) => a.id === id);
        const rewardText = this.grantReward(def?.reward);
        this.bus.emit(GameEvents.ACHIEVEMENT_UNLOCKED, { ...def, rewardText });
      }
    };

    if (session.kills >= 1) tryUnlock('first_blood');
    if (session.towersBuilt >= 10) tryUnlock('builder');
    if (this.save.data.statistics.towersBuilt >= 50) tryUnlock('architect');
    if (session.goldEarned >= 10000) tryUnlock('millionaire');
    if (session.consecutiveFlawless >= 5) tryUnlock('untouchable');
    if (session.bossesKilled >= 1) tryUnlock('boss_slayer');
    if (session.highestWave >= 10) tryUnlock('wave_10');
    if (session.highestWave >= 25) tryUnlock('wave_25');
    if (session.highestWave >= 50) tryUnlock('wave_50');
    if (session.highestWave >= 100) tryUnlock('wave_100');
    if (session.timeAt4x >= 60) tryUnlock('speed_demon');
    if (won && lives === 1) tryUnlock('pacifist_fail');
    // Combat towers only (exclude wall)
    const combatBuilt = [...session.towerTypesBuilt].filter((t) => t !== 'wall').length;
    if (combatBuilt >= 9) tryUnlock('arsenal');
    if (session.maxedTower) tryUnlock('upgrade_max');
    if (session.flawlessWaves >= 1) tryUnlock('perfect_wave');
    if (session.flawlessWaves >= 10) tryUnlock('perfect_10');
    if (session.goldSpent >= 5000) tryUnlock('spender');
    if (session.highestWave >= 15 && session.towersBuilt < 5) tryUnlock('thrifty');
    if (session.chain5) tryUnlock('chain_reaction');
    if (session.freezeSlows >= 100) tryUnlock('frostbite');
    if (session.poisonApps >= 200) tryUnlock('toxic');
    if (session.sniperCrits >= 25) tryUnlock('sniper_elite');
    if (session.laserDamage >= 5000) tryUnlock('laser_focus');
    if (session.rocketKills >= 50) tryUnlock('rocket_man');
    if (won && lives <= 10) tryUnlock('survivor');
    if (won && lives >= startingLives - 5 && lives >= 20) tryUnlock('iron_wall');
    if (session.abilitiesUsed.size >= 6) tryUnlock('ability_user');
    if (session.abilitiesUsed.has('nuke')) tryUnlock('nuke_master');
    if (session.highestWave > 50) tryUnlock('endless_starter');
    if (this.save.data.achievements.length >= 20) tryUnlock('collector');
    if (session.kills >= 100) tryUnlock('centurion');
    if (session.overkillHit) tryUnlock('overkill');
  }
}
