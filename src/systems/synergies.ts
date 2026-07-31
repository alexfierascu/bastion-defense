import { isDpsTower, SynergyRuleDef, SYNERGY_RULES } from '../config/synergies';
import { TowerType, TowerLevelStats } from '../config/towers';
import { Tower } from '../entities/tower';
import { TILE_SIZE } from '../config/constants';
import { dist2 } from '../utils/math';

export interface SynergyBuff {
  damage: number;
  fireRate: number;
  range: number;
  critChance: number;
  splashRadius: number;
  chainCount: number;
  labels: string[];
  toxicDot: boolean;
  shatter: boolean;
}

const EMPTY: SynergyBuff = {
  damage: 1,
  fireRate: 1,
  range: 1,
  critChance: 0,
  splashRadius: 1,
  chainCount: 0,
  labels: [],
  toxicDot: false,
  shatter: false,
};

const AURA = TILE_SIZE * 3.2;

function matchesSelf(rule: SynergyRuleDef, type: TowerType): boolean {
  if (rule.self === '*') return true;
  if (rule.self === '*dps') return isDpsTower(type);
  if (Array.isArray(rule.self)) return rule.self.includes(type);
  return rule.self === type;
}

function nearCount(tower: Tower, all: Tower[], near: TowerType | TowerType[]): number {
  const want = Array.isArray(near) ? near : [near];
  let n = 0;
  for (const other of all) {
    if (!other.active || other.id === tower.id) continue;
    if (dist2(tower.x, tower.y, other.x, other.y) > AURA * AURA) continue;
    if (want.includes(other.type)) n++;
  }
  return n;
}

/**
 * Adjacency synergies — mixed compositions rewarded; mono lightly punished.
 * Obscure rules are discovered by placement, not menus.
 */
export function computeSynergy(tower: Tower, all: Tower[]): SynergyBuff {
  if (!tower.active) return { ...EMPTY, labels: [] };
  const buff: SynergyBuff = {
    damage: 1,
    fireRate: 1,
    range: 1,
    critChance: 0,
    splashRadius: 1,
    chainCount: 0,
    labels: [],
    toxicDot: false,
    shatter: false,
  };

  for (const rule of SYNERGY_RULES) {
    if (!matchesSelf(rule, tower.type)) continue;
    const n = nearCount(tower, all, rule.near);
    // Combined Arms needs two support-ish neighbors
    if (rule.id === 'combined_arms') {
      if (n < 2) continue;
    } else if (n < 1) {
      continue;
    }
    if (rule.damage) buff.damage *= rule.damage;
    if (rule.fireRate) buff.fireRate *= rule.fireRate;
    if (rule.range) buff.range *= rule.range;
    if (rule.critChance) buff.critChance += rule.critChance;
    if (rule.splashRadius) buff.splashRadius *= rule.splashRadius;
    if (rule.chainCount) buff.chainCount += rule.chainCount;
    if (rule.toxicDot) buff.toxicDot = true;
    if (rule.shatter) buff.shatter = true;
    if (!buff.labels.includes(rule.label)) buff.labels.push(rule.label);
  }

  // Anti-stack soft penalty
  let same = 0;
  for (const other of all) {
    if (!other.active || other.id === tower.id) continue;
    if (other.type !== tower.type) continue;
    if (dist2(tower.x, tower.y, other.x, other.y) <= (TILE_SIZE * 4) ** 2) same++;
  }
  if (same >= 4) {
    buff.damage *= 0.92;
    buff.labels.push('Overcrowded');
  }

  return buff;
}

export function applySynergyToStats(stats: TowerLevelStats, buff: SynergyBuff): TowerLevelStats {
  return {
    ...stats,
    damage: stats.damage * buff.damage * (buff.shatter ? 1.0 : 1),
    fireRate: stats.fireRate * buff.fireRate,
    range: stats.range * buff.range,
    critChance: Math.min(0.65, stats.critChance + buff.critChance),
    splashRadius: stats.splashRadius * buff.splashRadius,
    chainCount: stats.chainCount + buff.chainCount,
    beamDps: stats.beamDps * buff.damage,
    dotDamage: stats.dotDamage * (buff.toxicDot ? 1.15 : 1),
    armorPen: Math.min(0.85, stats.armorPen + (buff.shatter ? 0.08 : 0)),
  };
}
