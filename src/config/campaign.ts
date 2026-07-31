/**
 * Campaign structure: World → Region → Mission → Rewards → Unlock next.
 */

import { BiomeId } from './biomes';
import { DifficultyId } from './difficulty';
import { HeroId } from './heroes';
import { TowerType } from './towers';

export type MissionType =
  | 'standard'
  | 'surviveWaves'
  | 'bossHunt'
  | 'escort'
  | 'protectVillagers'
  | 'multiGate'
  | 'nightDefense'
  | 'randomEvents';

export type WorldFeature =
  | 'bastion'
  | 'village'
  | 'road'
  | 'forest'
  | 'mountain'
  | 'river'
  | 'enemy';

export interface MissionRewards {
  gold: number;
  researchPoints: number;
  unlockMaps?: string[];
  unlockTowers?: TowerType[];
  unlockHeroes?: HeroId[];
  unlockMissions?: string[];
  unlockCosmetics?: string[];
}

export interface MissionDef {
  id: string;
  regionId: string;
  name: string;
  description: string;
  lore: string;
  mapId: string;
  biomeId: BiomeId;
  type: MissionType;
  /** Recommended power / threat rating shown in UI. */
  recommendedPower: number;
  /** Default difficulty hint (player may still pick). */
  difficulty: DifficultyId;
  /** Wave goal for survive / standard campaign clear. */
  waveGoal: number;
  /** Boss hunt: must kill a framed boss (still uses waveGoal as soft cap). */
  requireBossKill?: boolean;
  /** Night defense starts darker. */
  forceNight?: boolean;
  /** Random world events more often. */
  eventBias?: number;
  rewards: MissionRewards;
  /** World map node position (0–1000 space). */
  mapX: number;
  mapY: number;
  feature: WorldFeature;
  /** Missions that must be cleared first (any one if array of alternatives — use all required). */
  requires: string[];
}

export interface RegionDef {
  id: string;
  name: string;
  description: string;
  biomeId: BiomeId;
  /** Map space bounds for region label. */
  labelX: number;
  labelY: number;
}

export interface CampaignDef {
  id: string;
  name: string;
  description: string;
  regions: RegionDef[];
  missions: MissionDef[];
  startingMissionId: string;
}

export const CAMPAIGN: CampaignDef = {
  id: 'bastion-war',
  name: 'The Bastion War',
  description: 'Hold the frontier. Drive the horde from the green marches to the high ridges.',
  startingMissionId: 'm01-bastion-gate',
  regions: [
    {
      id: 'green-marches',
      name: 'Green Marches',
      description: 'Wooded approaches to the Bastion.',
      biomeId: 'forest',
      labelX: 220,
      labelY: 380,
    },
    {
      id: 'mire-reach',
      name: 'Mire Reach',
      description: 'Fog-choked wetlands.',
      biomeId: 'swamp',
      labelX: 480,
      labelY: 520,
    },
    {
      id: 'high-ridges',
      name: 'High Ridges',
      description: 'Stone passes and iron roads.',
      biomeId: 'mountain',
      labelX: 720,
      labelY: 280,
    },
    {
      id: 'frost-hollow',
      name: 'Frost Hollow',
      description: 'Snowbound groves beyond the ridge.',
      biomeId: 'snow',
      labelX: 820,
      labelY: 480,
    },
  ],
  missions: [
    {
      id: 'm01-bastion-gate',
      regionId: 'green-marches',
      name: 'Bastion Gate',
      description: 'Standard Defense — hold the first approach.',
      lore: 'The road from the forest ends at iron and oak. Hold the gate until the horns fall silent.',
      mapId: 'bastion-approach',
      biomeId: 'forest',
      type: 'standard',
      recommendedPower: 1,
      difficulty: 'recruit',
      waveGoal: 12,
      rewards: {
        gold: 80,
        researchPoints: 1,
        unlockMissions: ['m02-emerald-road'],
        unlockTowers: ['ballista'],
      },
      mapX: 180,
      mapY: 420,
      feature: 'bastion',
      requires: [],
    },
    {
      id: 'm02-emerald-road',
      regionId: 'green-marches',
      name: 'Emerald Road',
      description: 'Survive 15 waves along the timber road.',
      lore: 'Caravans fled this path last night. Something still walks beneath the leaves.',
      mapId: 'emerald-pass',
      biomeId: 'forest',
      type: 'surviveWaves',
      recommendedPower: 2,
      difficulty: 'recruit',
      waveGoal: 15,
      rewards: {
        gold: 100,
        researchPoints: 1,
        unlockMissions: ['m03-mire-crossing', 'm04-night-watch'],
        unlockTowers: ['support'],
      },
      mapX: 300,
      mapY: 340,
      feature: 'road',
      requires: ['m01-bastion-gate'],
    },
    {
      id: 'm03-mire-crossing',
      regionId: 'mire-reach',
      name: 'Mire Crossing',
      description: 'Swamp defense — enemies slog, damp slows your shot.',
      lore: 'The marsh drinks boots and bolts alike. Dig in on the dry rise.',
      mapId: 'serpent-marsh',
      biomeId: 'swamp',
      type: 'standard',
      recommendedPower: 3,
      difficulty: 'veteran',
      waveGoal: 18,
      rewards: {
        gold: 140,
        researchPoints: 1,
        unlockMissions: ['m05-iron-bridge'],
        unlockMaps: ['serpent-marsh'],
      },
      mapX: 460,
      mapY: 560,
      feature: 'river',
      requires: ['m02-emerald-road'],
    },
    {
      id: 'm04-night-watch',
      regionId: 'green-marches',
      name: 'Night Watch',
      description: 'Night Defense — darkness from the first horn.',
      lore: 'No dawn for this vigil. Keep the brands lit.',
      mapId: 'hollow-grove',
      biomeId: 'forest',
      type: 'nightDefense',
      recommendedPower: 3,
      difficulty: 'veteran',
      waveGoal: 16,
      forceNight: true,
      rewards: {
        gold: 130,
        researchPoints: 1,
        unlockMissions: ['m05-iron-bridge'],
        unlockMaps: ['hollow-grove'],
        unlockCosmetics: ['frost'],
      },
      mapX: 340,
      mapY: 480,
      feature: 'forest',
      requires: ['m02-emerald-road'],
    },
    {
      id: 'm05-iron-bridge',
      regionId: 'high-ridges',
      name: 'Iron Bridge',
      description: 'Hold the causeway. Random frontier events.',
      lore: 'The span is the only dry road into the ridges. Expect ambushes.',
      mapId: 'iron-causeway',
      biomeId: 'mountain',
      type: 'randomEvents',
      recommendedPower: 4,
      difficulty: 'veteran',
      waveGoal: 20,
      eventBias: 1.6,
      rewards: {
        gold: 180,
        researchPoints: 2,
        unlockMissions: ['m06-crimson-pass', 'm07-siege-golem'],
        unlockMaps: ['iron-causeway'],
        unlockTowers: ['magic'],
      },
      mapX: 620,
      mapY: 320,
      feature: 'road',
      requires: ['m02-emerald-road'],
    },
    {
      id: 'm06-crimson-pass',
      regionId: 'high-ridges',
      name: 'Crimson Pass',
      description: 'Protect the ridge village — standard defense.',
      lore: 'Smoke rises from the pass. The village still stands — for now.',
      mapId: 'crimson-ridge',
      biomeId: 'mountain',
      type: 'protectVillagers',
      recommendedPower: 5,
      difficulty: 'commander',
      waveGoal: 22,
      rewards: {
        gold: 200,
        researchPoints: 2,
        unlockMissions: ['m08-twin-gates'],
        unlockMaps: ['crimson-ridge'],
      },
      mapX: 760,
      mapY: 220,
      feature: 'village',
      requires: ['m05-iron-bridge'],
    },
    {
      id: 'm07-siege-golem',
      regionId: 'high-ridges',
      name: 'Siege Engine',
      description: 'Boss Hunt — break the Siege Golem.',
      lore: 'Stone that walks. Bring it down before it reaches the Bastion road.',
      mapId: 'bastion-approach',
      biomeId: 'mountain',
      type: 'bossHunt',
      recommendedPower: 5,
      difficulty: 'commander',
      waveGoal: 25,
      requireBossKill: true,
      rewards: {
        gold: 260,
        researchPoints: 2,
        unlockMissions: ['m08-twin-gates'],
        unlockHeroes: ['warden'],
      },
      mapX: 700,
      mapY: 400,
      feature: 'enemy',
      requires: ['m05-iron-bridge'],
    },
    {
      id: 'm08-twin-gates',
      regionId: 'frost-hollow',
      name: 'Twin Gates',
      description: 'Hold Multiple Gates — forked paths in the frost.',
      lore: 'Two roads, one crest. Split your lines or lose both.',
      mapId: 'twin-forks',
      biomeId: 'snow',
      type: 'multiGate',
      recommendedPower: 6,
      difficulty: 'commander',
      waveGoal: 28,
      rewards: {
        gold: 300,
        researchPoints: 3,
        unlockMissions: ['m09-legend-march'],
        unlockMaps: ['twin-forks', 'crimson-ridge'],
        unlockTowers: ['freeze'],
      },
      mapX: 860,
      mapY: 420,
      feature: 'bastion',
      requires: ['m05-iron-bridge'],
    },
    {
      id: 'm09-legend-march',
      regionId: 'frost-hollow',
      name: 'Legend March',
      description: 'Escort the last caravan through the snow.',
      lore: 'The final push. Guide the caravan — and yourself — to the frost hollow.',
      mapId: 'hollow-grove',
      biomeId: 'snow',
      type: 'escort',
      recommendedPower: 7,
      difficulty: 'legend',
      waveGoal: 30,
      rewards: {
        gold: 400,
        researchPoints: 4,
        unlockCosmetics: ['art:grimDark'],
      },
      mapX: 920,
      mapY: 520,
      feature: 'village',
      requires: ['m08-twin-gates'],
    },
  ],
};

export function getMission(id: string): MissionDef | undefined {
  return CAMPAIGN.missions.find((m) => m.id === id);
}

export function getRegion(id: string): RegionDef | undefined {
  return CAMPAIGN.regions.find((r) => r.id === id);
}

export function missionTypeLabel(type: MissionType): string {
  switch (type) {
    case 'standard':
      return 'Standard Defense';
    case 'surviveWaves':
      return 'Survive Waves';
    case 'bossHunt':
      return 'Boss Hunt';
    case 'escort':
      return 'Escort Caravan';
    case 'protectVillagers':
      return 'Protect Villagers';
    case 'multiGate':
      return 'Hold Multiple Gates';
    case 'nightDefense':
      return 'Night Defense';
    case 'randomEvents':
      return 'Random Events';
    default:
      return 'Mission';
  }
}

/** Road segments between missions for world-map drawing. */
export const WORLD_ROADS: [string, string][] = [
  ['m01-bastion-gate', 'm02-emerald-road'],
  ['m02-emerald-road', 'm03-mire-crossing'],
  ['m02-emerald-road', 'm04-night-watch'],
  ['m03-mire-crossing', 'm05-iron-bridge'],
  ['m04-night-watch', 'm05-iron-bridge'],
  ['m05-iron-bridge', 'm06-crimson-pass'],
  ['m05-iron-bridge', 'm07-siege-golem'],
  ['m06-crimson-pass', 'm08-twin-gates'],
  ['m07-siege-golem', 'm08-twin-gates'],
  ['m08-twin-gates', 'm09-legend-march'],
];
