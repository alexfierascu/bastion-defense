/**
 * Data-driven adjacency synergies.
 * Some remain obscure (no encyclopedia dump) until players discover them in-run.
 */

import { TowerType } from './towers';

export interface SynergyRuleDef {
  id: string;
  /** Shown on tower panel when active. */
  label: string;
  /** If true, never listed in encyclopedia. */
  obscure?: boolean;
  /** Tower receiving the buff. */
  self: TowerType | TowerType[] | '*dps' | '*';
  /** Neighbor that must be present. */
  near: TowerType | TowerType[];
  damage?: number;
  fireRate?: number;
  range?: number;
  critChance?: number;
  splashRadius?: number;
  chainCount?: number;
  /** Extra DoT multiplier flag consumed by applySynergyToStats. */
  toxicDot?: boolean;
  /** Slow strength additive via tower slowAmount — applied as damage proxy if needed. */
  shatter?: boolean;
}

export const SYNERGY_RULES: SynergyRuleDef[] = [
  {
    id: 'frost_focus',
    label: 'Frost Focus',
    self: ['sniper', 'arrow', 'laser', 'ballista'],
    near: 'freeze',
    damage: 1.12,
    critChance: 0.06,
  },
  {
    id: 'toxic_arc',
    label: 'Toxic Arc',
    self: 'tesla',
    near: 'poison',
    chainCount: 1,
    damage: 1.08,
    toxicDot: true,
  },
  {
    id: 'arcane_shells',
    label: 'Arcane Shells',
    self: ['cannon', 'rocket'],
    near: 'magic',
    splashRadius: 1.15,
    damage: 1.1,
  },
  {
    id: 'banner_discipline',
    label: 'Banner Discipline',
    obscure: true,
    self: 'arrow',
    near: 'support',
    fireRate: 1.14,
  },
  {
    id: 'ignition',
    label: 'Ignition',
    obscure: true,
    self: 'cannon',
    near: 'poison',
    damage: 1.16,
    splashRadius: 1.1,
  },
  {
    id: 'shatter',
    label: 'Shatter',
    obscure: true,
    self: 'ballista',
    near: 'freeze',
    damage: 1.18,
    critChance: 0.05,
    shatter: true,
  },
  {
    id: 'morale',
    label: 'Morale',
    obscure: true,
    self: 'support',
    near: 'wall',
    range: 1.12,
    fireRate: 1.08,
  },
  {
    id: 'combined_arms',
    label: 'Combined Arms',
    self: '*dps',
    near: ['freeze', 'poison', 'support'],
    fireRate: 1.08,
  },
];

export function isDpsTower(t: TowerType): boolean {
  return (
    t === 'arrow' ||
    t === 'cannon' ||
    t === 'sniper' ||
    t === 'tesla' ||
    t === 'laser' ||
    t === 'rocket' ||
    t === 'magic' ||
    t === 'ballista'
  );
}

export function knownSynergyLabels(): string[] {
  return SYNERGY_RULES.filter((r) => !r.obscure).map((r) => r.label);
}
