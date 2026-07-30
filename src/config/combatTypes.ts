/** Shared combat taxonomy for towers, enemies, and environment. */

export type DamageType = 'physical' | 'explosive' | 'magic' | 'energy' | 'poison' | 'frost';

export const DAMAGE_TYPES: DamageType[] = [
  'physical',
  'explosive',
  'magic',
  'energy',
  'poison',
  'frost',
];

/** Multiplier applied as: final = damage * (1 - resist). Resist can be negative (weakness). */
export function resistMultiplier(resist: number): number {
  return Math.max(0.15, 1 - resist);
}
