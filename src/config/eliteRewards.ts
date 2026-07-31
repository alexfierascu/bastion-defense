/** Thin re-export — Relics supersede Elite Rewards (same ids). */
export {
  RELIC_DEFS as ELITE_REWARD_DEFS,
  RELIC_ORDER as ELITE_REWARD_ORDER,
  MAX_RELICS,
  eliteRewardEffects,
  relicEffects,
  relicLabels,
} from './relics';

export type {
  RelicId as EliteRewardId,
  RelicId,
  RelicDef as EliteRewardDef,
  RelicDef,
  RelicEffects as EliteRewardEffects,
  RelicEffects,
  RelicInstant as EliteInstant,
  RelicInstant,
} from './relics';
