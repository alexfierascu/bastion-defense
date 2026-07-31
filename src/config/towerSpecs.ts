/**
 * Tower specialization gameplay flags — every branch changes combat, not cosmetics alone.
 */

import type { UpgradePath } from './upgradeBranches';
import type { TowerType } from './towers';

export interface TowerSpecFlags {
  /** Fire additional projectiles at distinct targets. */
  multiTarget: number;
  /** Extra flat armor penetration. */
  armorPenFlat: number;
  /** Use chain-lightning style attack. */
  chainBolts: number;
  /** Arcing non-homing shell with boosted splash. */
  mortar: boolean;
  /** Extra shrapnel splash on impact. */
  shrapnel: boolean;
  /** Gate regen aura. */
  healBanner: boolean;
  /** Nearby tower attack-speed aura. */
  warBanner: boolean;
  /** Projectile / SFX skin key suffix. */
  skin: string;
}

const EMPTY: TowerSpecFlags = {
  multiTarget: 0,
  armorPenFlat: 0,
  chainBolts: 0,
  mortar: false,
  shrapnel: false,
  healBanner: false,
  warBanner: false,
  skin: '',
};

export function getTowerSpecFlags(
  type: TowerType,
  path: UpgradePath | null,
  level: number,
): TowerSpecFlags {
  if (!path || level < 2) return { ...EMPTY, skin: type };

  if (type === 'arrow') {
    if (path === 'a') {
      return {
        ...EMPTY,
        armorPenFlat: level >= 3 ? 0.45 : 0.35,
        skin: 'arrow_longbow',
      };
    }
    return {
      ...EMPTY,
      multiTarget: level >= 3 ? 3 : 2,
      skin: 'arrow_rapid',
    };
  }

  if (type === 'cannon') {
    if (path === 'a') {
      return { ...EMPTY, mortar: true, skin: 'cannon_mortar' };
    }
    return { ...EMPTY, shrapnel: true, skin: 'cannon_shrapnel' };
  }

  if (type === 'ballista') {
    if (path === 'a') {
      return {
        ...EMPTY,
        armorPenFlat: level >= 3 ? 0.55 : 0.4,
        skin: 'ballista_piercer',
      };
    }
    return {
      ...EMPTY,
      chainBolts: level >= 3 ? 4 : 3,
      skin: 'ballista_chain',
    };
  }

  if (type === 'support') {
    if (path === 'a') {
      return { ...EMPTY, healBanner: true, skin: 'support_heal' };
    }
    return { ...EMPTY, warBanner: true, skin: 'support_war' };
  }

  return { ...EMPTY, skin: `${type}_${path}` };
}
