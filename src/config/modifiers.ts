export type ModifierId =
  | 'noSell'
  | 'ironman'
  | 'fog'
  | 'poverty'
  | 'glassCannon'
  | 'suddenDeath'
  | 'heavyRain';

export interface ModifierDef {
  id: ModifierId;
  name: string;
  description: string;
}

export const MODIFIER_DEFS: Record<ModifierId, ModifierDef> = {
  noSell: {
    id: 'noSell',
    name: 'No Refunds',
    description: 'Selling towers is disabled.',
  },
  ironman: {
    id: 'ironman',
    name: 'Ironman',
    description: 'No mid-run continue saves.',
  },
  fog: {
    id: 'fog',
    name: 'Fog of War',
    description: 'Shades stay harder to see; night pressure rises.',
  },
  poverty: {
    id: 'poverty',
    name: 'Poverty',
    description: 'Kill rewards and interest cut by 35%.',
  },
  glassCannon: {
    id: 'glassCannon',
    name: 'Glass Cannon',
    description: 'Start with 10 lives, but towers deal +25% damage.',
  },
  suddenDeath: {
    id: 'suddenDeath',
    name: 'Sudden Death',
    description: 'Leaking an enemy costs 3 lives.',
  },
  heavyRain: {
    id: 'heavyRain',
    name: 'Storm Front',
    description: 'Permanent heavy rain (freeze up, rockets up, arrows down).',
  },
};

export const MODIFIER_ORDER: ModifierId[] = [
  'noSell',
  'ironman',
  'fog',
  'poverty',
  'glassCannon',
  'suddenDeath',
  'heavyRain',
];

/** Deterministic daily modifier pick from a day string. */
export function dailyModifiers(dayKey: string): ModifierId[] {
  let h = 2166136261;
  for (let i = 0; i < dayKey.length; i++) {
    h ^= dayKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = MODIFIER_ORDER[h % MODIFIER_ORDER.length]!;
  const b = MODIFIER_ORDER[(h >>> 8) % MODIFIER_ORDER.length]!;
  if (a === b) return [a];
  return [a, b];
}
