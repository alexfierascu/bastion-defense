/** Player special abilities with cooldowns and costs. */

export type AbilityType =
  | 'meteor'
  | 'freeze'
  | 'airstrike'
  | 'emp'
  | 'nuke'
  | 'goldboost';

export interface AbilityDef {
  id: AbilityType;
  name: string;
  description: string;
  cooldown: number;
  cost: number;
  radius: number;
  duration: number;
  damage: number;
  color: string;
  icon: string;
}

export const ABILITY_DEFS: Record<AbilityType, AbilityDef> = {
  meteor: {
    id: 'meteor',
    name: 'Meteor Strike',
    description: 'Call a meteor that smashes a large area.',
    cooldown: 45,
    cost: 80,
    radius: 100,
    duration: 0,
    damage: 180,
    color: '#ff6b35',
    icon: 'MTR',
  },
  freeze: {
    id: 'freeze',
    name: 'Flash Freeze',
    description: 'Freeze all enemies briefly.',
    cooldown: 50,
    cost: 60,
    radius: 9999,
    duration: 3.5,
    damage: 0,
    color: '#7ec8e3',
    icon: 'FRZ',
  },
  airstrike: {
    id: 'airstrike',
    name: 'Air Strike',
    description: 'Carpet-bomb a path segment.',
    cooldown: 40,
    cost: 70,
    radius: 80,
    duration: 0,
    damage: 120,
    color: '#e8c547',
    icon: 'AIR',
  },
  emp: {
    id: 'emp',
    name: 'EMP Pulse',
    description: 'Strip shields and briefly stun.',
    cooldown: 55,
    cost: 50,
    radius: 9999,
    duration: 2,
    damage: 0,
    color: '#66ccff',
    icon: 'EMP',
  },
  nuke: {
    id: 'nuke',
    name: 'Tactical Nuke',
    description: 'Massive map-wide damage. Long cooldown.',
    cooldown: 120,
    cost: 200,
    radius: 9999,
    duration: 0,
    damage: 400,
    color: '#ff3344',
    icon: 'NKE',
  },
  goldboost: {
    id: 'goldboost',
    name: 'Gold Rush',
    description: 'Double kill rewards for a short time.',
    cooldown: 70,
    cost: 40,
    radius: 0,
    duration: 12,
    damage: 0,
    color: '#f0c040',
    icon: 'GLD',
  },
};

export const ABILITY_ORDER: AbilityType[] = [
  'meteor',
  'freeze',
  'airstrike',
  'emp',
  'nuke',
  'goldboost',
];
