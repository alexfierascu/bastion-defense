/** Achievement catalog — 30+ unlocks with meta rewards. */

import { TOWER_DEFS, TowerType } from './towers';
import { cosmeticDisplayName } from './cosmetics';

export type AchievementId =
  | 'first_blood'
  | 'builder'
  | 'architect'
  | 'millionaire'
  | 'untouchable'
  | 'boss_slayer'
  | 'wave_10'
  | 'wave_25'
  | 'wave_50'
  | 'wave_100'
  | 'speed_demon'
  | 'pacifist_fail'
  | 'arsenal'
  | 'upgrade_max'
  | 'perfect_wave'
  | 'perfect_10'
  | 'spender'
  | 'thrifty'
  | 'chain_reaction'
  | 'frostbite'
  | 'toxic'
  | 'sniper_elite'
  | 'laser_focus'
  | 'rocket_man'
  | 'survivor'
  | 'iron_wall'
  | 'ability_user'
  | 'nuke_master'
  | 'endless_starter'
  | 'collector'
  | 'centurion'
  | 'overkill';

export interface AchievementReward {
  rp?: number;
  unlockTower?: TowerType;
  unlockCosmetic?: string;
  /** Banked starting gold for the next new run. */
  bankGold?: number;
}

export interface AchievementDef {
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
  reward?: AchievementReward;
}

export function formatAchievementReward(r?: AchievementReward): string {
  if (!r) return '';
  const parts: string[] = [];
  if (r.rp) parts.push(`+${r.rp} RP`);
  if (r.unlockTower) parts.push(`Unlock ${TOWER_DEFS[r.unlockTower]?.name ?? r.unlockTower}`);
  if (r.unlockCosmetic) parts.push(`Cosmetic: ${cosmeticDisplayName(r.unlockCosmetic)}`);
  if (r.bankGold) parts.push(`+${r.bankGold}g bank`);
  return parts.join(' · ');
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_blood', name: 'First Blood', description: 'Kill your first enemy.', icon: '🩸', reward: { rp: 1 } },
  { id: 'builder', name: 'Builder', description: 'Build 10 towers in a single game.', icon: '🔨', reward: { rp: 1 } },
  { id: 'architect', name: 'Architect', description: 'Build 50 towers across all games.', icon: '🏛', reward: { rp: 2 } },
  { id: 'millionaire', name: 'Millionaire', description: 'Earn 10,000 gold in one game.', icon: '💎', reward: { rp: 2, bankGold: 50 } },
  { id: 'untouchable', name: 'Untouchable', description: 'Clear 5 consecutive waves without losing life.', icon: '🛡', reward: { rp: 2, unlockCosmetic: 'ghost' } },
  { id: 'boss_slayer', name: 'Boss Slayer', description: 'Defeat a wave boss.', icon: '⚔', reward: { rp: 1 } },
  { id: 'wave_10', name: 'Warming Up', description: 'Reach wave 10.', icon: '🔟', reward: { rp: 1 } },
  { id: 'wave_25', name: 'Halfway There', description: 'Reach wave 25.', icon: '📈', reward: { rp: 2 } },
  { id: 'wave_50', name: 'Campaign Clear', description: 'Survive all 50 campaign waves.', icon: '🏆', reward: { rp: 5, bankGold: 100 } },
  { id: 'wave_100', name: 'Century', description: 'Reach wave 100 in endless mode.', icon: '💯', reward: { rp: 5 } },
  { id: 'speed_demon', name: 'Speed Demon', description: 'Play at 4x speed for 60 seconds.', icon: '⚡', reward: { rp: 1 } },
  { id: 'pacifist_fail', name: 'Close Call', description: 'Win a wave with 1 life remaining.', icon: '😬', reward: { rp: 1 } },
  { id: 'arsenal', name: 'Full Arsenal', description: 'Build every combat tower type in one game.', icon: '🧰', reward: { rp: 3 } },
  { id: 'upgrade_max', name: 'Maxed Out', description: 'Upgrade a tower to level 5.', icon: '⬆', reward: { rp: 1 } },
  { id: 'perfect_wave', name: 'Flawless', description: 'Clear a wave without losing life.', icon: '✨', reward: { rp: 1 } },
  { id: 'perfect_10', name: 'Perfect Ten', description: 'Clear 10 flawless waves in one game.', icon: '🌟', reward: { rp: 2 } },
  { id: 'spender', name: 'Big Spender', description: 'Spend 5,000 gold in one game.', icon: '💸', reward: { rp: 1 } },
  { id: 'thrifty', name: 'Thrifty', description: 'Reach wave 15 with under 5 towers.', icon: '🪙', reward: { rp: 2 } },
  { id: 'chain_reaction', name: 'Chain Reaction', description: 'Hit 5 enemies with one Tesla chain.', icon: '🔗', reward: { rp: 1 } },
  { id: 'frostbite', name: 'Frostbite', description: 'Slow 100 enemies with Freeze towers.', icon: '❄', reward: { rp: 2, unlockCosmetic: 'frost' } },
  { id: 'toxic', name: 'Toxic', description: 'Apply poison to 200 enemies.', icon: '☠', reward: { rp: 1 } },
  { id: 'sniper_elite', name: 'Sniper Elite', description: 'Land 25 critical hits with Sniper.', icon: '🎯', reward: { rp: 1 } },
  { id: 'laser_focus', name: 'Laser Focus', description: 'Deal 5,000 damage with Laser towers.', icon: '🔴', reward: { rp: 1 } },
  { id: 'rocket_man', name: 'Rocket Man', description: 'Destroy 50 enemies with Rocket splash.', icon: '🚀', reward: { rp: 1 } },
  { id: 'survivor', name: 'Survivor', description: 'Win a game with 10 or fewer lives left.', icon: '❤', reward: { rp: 2 } },
  { id: 'iron_wall', name: 'Iron Wall', description: 'Win without dropping below 20 lives.', icon: '🧱', reward: { rp: 2 } },
  { id: 'ability_user', name: 'Tactician', description: 'Use every ability at least once.', icon: '🎖', reward: { rp: 2 } },
  { id: 'nuke_master', name: 'Nuke Master', description: 'Use the Tactical Nuke.', icon: '☢', reward: { rp: 1 } },
  { id: 'endless_starter', name: 'Into the Abyss', description: 'Enter endless mode.', icon: '∞', reward: { rp: 1 } },
  { id: 'collector', name: 'Collector', description: 'Unlock 20 achievements.', icon: '📦', reward: { rp: 3, bankGold: 75 } },
  { id: 'centurion', name: 'Centurion', description: 'Kill 100 enemies in one game.', icon: '💀', reward: { rp: 1 } },
  { id: 'overkill', name: 'Overkill', description: 'Deal 500+ damage in a single hit.', icon: '💥', reward: { rp: 1 } },
];
