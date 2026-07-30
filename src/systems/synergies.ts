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
}

const EMPTY: SynergyBuff = {
  damage: 1,
  fireRate: 1,
  range: 1,
  critChance: 0,
  splashRadius: 1,
  chainCount: 0,
  labels: [],
};

const AURA = TILE_SIZE * 3.2;

/**
 * Data-driven adjacency synergies.
 * Encourages mixed compositions instead of stacking one tower type.
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
  };

  let nearFreeze = false;
  let nearPoison = false;
  let nearTesla = false;
  let nearMagic = false;
  let nearSupport = 0;

  for (const other of all) {
    if (!other.active || other.id === tower.id) continue;
    if (dist2(tower.x, tower.y, other.x, other.y) > AURA * AURA) continue;
    if (other.type === 'freeze') nearFreeze = true;
    if (other.type === 'poison') nearPoison = true;
    if (other.type === 'tesla') nearTesla = true;
    if (other.type === 'magic') nearMagic = true;
    if (other.type === 'freeze' || other.type === 'poison') nearSupport++;
  }

  // Freeze empowers precision DPS
  if (nearFreeze && (tower.type === 'sniper' || tower.type === 'arrow' || tower.type === 'laser')) {
    buff.damage *= 1.12;
    buff.critChance += 0.06;
    buff.labels.push('Frost Focus');
  }

  // Poison + Tesla: toxic arcs
  if (nearPoison && tower.type === 'tesla') {
    buff.chainCount += 1;
    buff.damage *= 1.08;
    buff.labels.push('Toxic Arc');
  }

  // Magic near splash: arcane shells
  if (nearMagic && (tower.type === 'cannon' || tower.type === 'rocket')) {
    buff.splashRadius *= 1.15;
    buff.damage *= 1.1;
    buff.labels.push('Arcane Shells');
  }

  // Diversified neighborhood bonus
  if (nearSupport >= 2 && isDps(tower.type)) {
    buff.fireRate *= 1.08;
    buff.labels.push('Combined Arms');
  }

  // Anti-stack: soft penalty if 4+ same type nearby (discourages mono)
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

function isDps(t: TowerType): boolean {
  return t === 'arrow' || t === 'cannon' || t === 'sniper' || t === 'tesla' || t === 'laser' || t === 'rocket' || t === 'magic';
}

export function applySynergyToStats(stats: TowerLevelStats, buff: SynergyBuff): TowerLevelStats {
  return {
    ...stats,
    damage: stats.damage * buff.damage,
    fireRate: stats.fireRate * buff.fireRate,
    range: stats.range * buff.range,
    critChance: Math.min(0.65, stats.critChance + buff.critChance),
    splashRadius: stats.splashRadius * buff.splashRadius,
    chainCount: stats.chainCount + buff.chainCount,
    beamDps: stats.beamDps * buff.damage,
    dotDamage: stats.dotDamage * (buff.labels.includes('Toxic Arc') ? 1.15 : 1),
  };
}
