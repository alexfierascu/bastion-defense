/**
 * Run-scoped meta: Field Research, Relics, Faction, Environmental modifiers.
 */

import { mergeEnvEffects, EnvModifierId } from '../config/envModifiers';
import { FactionId } from '../config/factions';
import {
  EliteRewardId,
  eliteRewardEffects,
  ELITE_REWARD_DEFS,
  EliteRewardDef,
  MAX_RELICS,
  RelicId,
  relicLabels,
} from '../config/eliteRewards';
import {
  RUN_RESEARCH_DEFS,
  RUN_RESEARCH_RP_INTERVAL,
  RUN_RESEARCH_RP_PER_INTERVAL,
  RunResearchId,
} from '../config/runResearch';
import { TowerType } from '../config/towers';
import { createRng, hashString } from '../utils/math';
import { ActiveWorldEvent } from './worldEvents';

export interface RunMetaSnapshot {
  researchPoints: number;
  activeResearch: RunResearchId | null;
  /** @deprecated Prefer relics — kept for continue migration. */
  eliteRewards: EliteRewardId[];
  relics?: RelicId[];
  factionId?: FactionId;
  envModifiers?: EnvModifierId[];
  eventCooldownWaves: number;
  activeEvent: ActiveWorldEvent | null;
  towersSold: number;
}

export interface RunCombatBonuses {
  rangeMult: number;
  fireRateMult: number;
  goldIncomeMult: number;
  gateHealthMult: number;
  towerCostMult: number;
  critBonus: number;
  typeDamage: Partial<Record<TowerType, number>>;
  pierceBonus: number;
  projectileSpeedMult: number;
  freezeSlowBonus: number;
  sniperCritBonus: number;
  teslaChainBonus: number;
  merchantDiscount: number;
  fogRangeMult: number;
  rainFireMult: number;
  rainTeslaMult: number;
  stealthBonus: boolean;
  gateRegenPerSec: number;
  enemySpeedMult: number;
  splashDamageMult: number;
  bossEliteDamageMult: number;
  envSpawnMult: number;
  nightBias: number;
  weatherBias: number;
}

export function createRunMeta(): RunMetaSnapshot {
  return {
    researchPoints: 0,
    activeResearch: null,
    eliteRewards: [],
    relics: [],
    factionId: undefined,
    envModifiers: [],
    eventCooldownWaves: 0,
    activeEvent: null,
    towersSold: 0,
  };
}

export function getRunRelics(meta: RunMetaSnapshot): RelicId[] {
  return meta.relics?.length ? meta.relics : meta.eliteRewards ?? [];
}

export function canAddRelic(meta: RunMetaSnapshot): boolean {
  return getRunRelics(meta).length < MAX_RELICS;
}

export function addRelic(meta: RunMetaSnapshot, id: RelicId): boolean {
  const list = getRunRelics(meta);
  if (list.includes(id) || list.length >= MAX_RELICS) return false;
  list.push(id);
  meta.relics = list;
  meta.eliteRewards = list;
  return true;
}

/** Grant RP for completed waves (every 5 waves). */
export function grantResearchPointsForWave(meta: RunMetaSnapshot, waveCleared: number): number {
  if (waveCleared <= 0 || waveCleared % RUN_RESEARCH_RP_INTERVAL !== 0) return 0;
  meta.researchPoints += RUN_RESEARCH_RP_PER_INTERVAL;
  return RUN_RESEARCH_RP_PER_INTERVAL;
}

export function tryActivateRunResearch(
  meta: RunMetaSnapshot,
  id: RunResearchId,
): { ok: boolean; reason?: string } {
  const def = RUN_RESEARCH_DEFS[id];
  if (!def) return { ok: false, reason: 'Unknown research' };
  if (meta.activeResearch === id) return { ok: false, reason: 'Already active' };
  if (meta.researchPoints < def.cost) return { ok: false, reason: 'Need more Research Points' };
  meta.researchPoints -= def.cost;
  meta.activeResearch = id;
  return { ok: true };
}

export function pickEliteRewardChoices(
  seed: string,
  wave: number,
  owned: EliteRewardId[],
  count = 3,
): EliteRewardDef[] {
  const rng = createRng(hashString(`${seed}:eliteReward:${wave}:${owned.length}`));
  const ownedSet = new Set(owned);
  const pool = Object.values(ELITE_REWARD_DEFS).filter((d) => !ownedSet.has(d.id));
  const source = pool.length >= count ? pool : Object.values(ELITE_REWARD_DEFS);
  const picks: EliteRewardDef[] = [];
  const working = [...source];

  for (let i = 0; i < count && working.length > 0; i++) {
    let total = 0;
    for (const d of working) total += d.weight;
    let r = rng() * total;
    let idx = 0;
    for (let j = 0; j < working.length; j++) {
      r -= working[j]!.weight;
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    picks.push(working.splice(idx, 1)[0]!);
  }
  return picks;
}

export function computeRunCombatBonuses(meta: RunMetaSnapshot): RunCombatBonuses {
  const b: RunCombatBonuses = {
    rangeMult: 1,
    fireRateMult: 1,
    goldIncomeMult: 1,
    gateHealthMult: 1,
    towerCostMult: 1,
    critBonus: 0,
    typeDamage: {},
    pierceBonus: 0,
    projectileSpeedMult: 1,
    freezeSlowBonus: 0,
    sniperCritBonus: 0,
    teslaChainBonus: 0,
    merchantDiscount: 0,
    fogRangeMult: 1,
    rainFireMult: 1,
    rainTeslaMult: 1,
    stealthBonus: false,
    gateRegenPerSec: 0,
    enemySpeedMult: 1,
    splashDamageMult: 1,
    bossEliteDamageMult: 1,
    envSpawnMult: 1,
    nightBias: 0,
    weatherBias: 0,
  };

  switch (meta.activeResearch) {
    case 'tower_range':
      b.rangeMult *= 1.1;
      break;
    case 'attack_speed':
      b.fireRateMult *= 1.1;
      break;
    case 'gold_income':
      b.goldIncomeMult *= 1.15;
      break;
    case 'gate_health':
      b.gateHealthMult *= 1.1;
      break;
    case 'tower_cost':
      b.towerCostMult *= 0.9;
      break;
    case 'crit_chance':
      b.critBonus += 0.05;
      break;
    default:
      break;
  }

  for (const id of getRunRelics(meta)) {
    const fx = eliteRewardEffects(id);
    if (fx.fireRateMult) b.fireRateMult *= fx.fireRateMult;
    if (fx.pierceBonus) b.pierceBonus += fx.pierceBonus;
    if (fx.projectileSpeedMult) b.projectileSpeedMult *= fx.projectileSpeedMult;
    if (fx.freezeSlowBonus) b.freezeSlowBonus += fx.freezeSlowBonus;
    if (fx.sniperCritBonus) b.sniperCritBonus += fx.sniperCritBonus;
    if (fx.teslaChainBonus) b.teslaChainBonus += fx.teslaChainBonus;
    if (fx.goldIncomeMult) b.goldIncomeMult *= fx.goldIncomeMult;
    if (fx.rangeMult) b.rangeMult *= fx.rangeMult;
    if (fx.gateHealthMult) b.gateHealthMult *= fx.gateHealthMult;
    if (fx.bossEliteDamageMult) b.bossEliteDamageMult *= fx.bossEliteDamageMult;
    if (fx.towerCostMult) b.towerCostMult *= fx.towerCostMult;
    if (fx.typeDamage) {
      for (const [t, m] of Object.entries(fx.typeDamage) as [TowerType, number][]) {
        b.typeDamage[t] = (b.typeDamage[t] ?? 1) * m;
      }
    }
  }

  const env = mergeEnvEffects(meta.envModifiers ?? []);
  if (env.rangeMult) b.rangeMult *= env.rangeMult;
  if (env.fireRateMult) b.fireRateMult *= env.fireRateMult;
  if (env.projectileSpeedMult) b.projectileSpeedMult *= env.projectileSpeedMult;
  if (env.goldMult) b.goldIncomeMult *= env.goldMult;
  if (env.gateHealthMult) b.gateHealthMult *= env.gateHealthMult;
  if (env.enemySpeedMult) b.enemySpeedMult *= env.enemySpeedMult;
  if (env.splashDamageMult) b.splashDamageMult *= env.splashDamageMult;
  if (env.slowBonus) b.freezeSlowBonus += env.slowBonus;
  if (env.critBonus) b.critBonus += env.critBonus;
  if (env.spawnMult) b.envSpawnMult *= env.spawnMult;
  if (env.nightBias != null) b.nightBias = env.nightBias;
  if (env.weatherBias != null) b.weatherBias = env.weatherBias;
  if (env.stealthPressure) {
    b.stealthBonus = true;
    b.fogRangeMult *= 0.92;
  }

  const evt = meta.activeEvent;
  if (evt) {
    switch (evt.id) {
      case 'fog':
        b.fogRangeMult *= 0.75;
        b.stealthBonus = true;
        break;
      case 'heavyRain':
        b.rainFireMult = 0.8;
        b.rainTeslaMult = 1.25;
        b.projectileSpeedMult *= 0.92;
        break;
      case 'merchant':
        b.merchantDiscount = 0.3;
        break;
      case 'blessing':
        b.gateRegenPerSec = 0.35;
        break;
      default:
        break;
    }
  }

  return b;
}

export function researchLabel(id: RunResearchId | null): string {
  if (!id) return 'None';
  return RUN_RESEARCH_DEFS[id]?.name ?? id;
}

export function eliteRewardLabels(ids: EliteRewardId[]): string[] {
  return relicLabels(ids);
}
