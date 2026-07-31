import { MAP_COLS, MAP_HEIGHT, MAP_ROWS, MAP_WIDTH, TILE_SIZE } from '../config/constants';
import { createRng, hashString } from '../utils/math';
import {
  BASTION_APPROACH_WAYPOINTS,
  buildBastionApproach,
} from './maps/bastionApproach';

export type TileType =
  | 'grass'
  | 'road'
  | 'water'
  | 'rock'
  | 'buildable'
  | 'spawn'
  | 'base'
  | 'decor'
  | 'gap';

export interface PathPoint {
  x: number;
  y: number;
}

export interface DestructibleRock {
  c: number;
  r: number;
  hp: number;
  maxHp: number;
}

export interface BridgeSlot {
  c: number;
  r: number;
  built: boolean;
  hp: number;
  maxHp: number;
}

export interface MapData {
  id: string;
  name: string;
  cols: number;
  rows: number;
  tiles: TileType[][];
  /** Primary path (paths[0]) for backwards compat */
  path: PathPoint[];
  pathLength: number;
  /** All lanes (may be rebuilt when walls change) */
  paths: PathPoint[][];
  pathLengths: number[];
  /** Original lanes before wall reroutes — used by flying enemies */
  basePaths: PathPoint[][];
  basePathLengths: number[];
  spawn: PathPoint;
  base: PathPoint;
  spawns: PathPoint[];
  bases: PathPoint[];
  decor: { x: number; y: number; kind: number; scale: number }[];
  buildMask: boolean[][];
  bridgeSlots: BridgeSlot[];
  destructibles: DestructibleRock[];
  isRandom: boolean;
}

export type BuildRejectReason =
  | 'out-of-bounds'
  | 'occupied'
  | 'not-buildable'
  | 'water'
  | 'rock'
  | 'gap'
  | 'road'
  | 'spawn'
  | 'base'
  | 'need-gold'
  | 'not-road'
  | 'blocks-path'
  | 'wall-only-road';

export const BUILD_REJECT_LABELS: Record<BuildRejectReason, string> = {
  'out-of-bounds': 'Outside the map',
  occupied: 'Tile occupied',
  'not-buildable': 'Cannot build here',
  water: 'Water — need a bridge nearby',
  rock: 'Rock in the way',
  gap: 'Gap — click to build a bridge',
  road: 'Road — use Barricade to block',
  spawn: 'Spawn tile',
  base: 'Base tile',
  'need-gold': 'Not enough gold',
  'not-road': 'Barricades go on the road',
  'blocks-path': 'Would seal every path',
  'wall-only-road': 'Barricades go on the road',
};

export interface MapPreset {
  id: string;
  name: string;
  /** Array of paths; each path is a list of [col, row] waypoints */
  waypoints: [number, number][][];
  multi?: boolean;
}

const PATH_WAYPOINTS_A: [number, number][] = [
  [0, 6],
  [8, 6],
  [8, 14],
  [16, 14],
  [16, 4],
  [24, 4],
  [24, 18],
  [32, 18],
  [32, 10],
  [39, 10],
];

const PATH_WAYPOINTS_B: [number, number][] = [
  [0, 20],
  [6, 20],
  [6, 8],
  [14, 8],
  [14, 22],
  [22, 22],
  [22, 6],
  [30, 6],
  [30, 16],
  [39, 16],
];

const PATH_WAYPOINTS_C: [number, number][] = [
  [0, 12],
  [10, 12],
  [10, 3],
  [20, 3],
  [20, 22],
  [28, 22],
  [28, 8],
  [35, 8],
  [35, 18],
  [39, 18],
];

/** Twin forks: shared approach, split mid-map, rejoin near base */
const TWIN_FORKS_A: [number, number][] = [
  [0, 12],
  [6, 12],
  [10, 12],
  [14, 6],
  [22, 6],
  [28, 10],
  [34, 12],
  [39, 12],
];

const TWIN_FORKS_B: [number, number][] = [
  [0, 12],
  [6, 12],
  [10, 12],
  [14, 18],
  [22, 18],
  [28, 14],
  [34, 12],
  [39, 12],
];

/** Iron causeway — mostly horizontal with bridge gaps at marked cols */
const IRON_CAUSEWAY: [number, number][] = [
  [0, 14],
  [8, 14],
  [14, 14],
  [20, 14],
  [26, 14],
  [32, 14],
  [39, 14],
];

const IRON_CAUSEWAY_GAPS: [number, number][] = [
  [14, 14],
  [20, 14],
  [26, 14],
];

/** Hollow grove — deep zig through the map */
const HOLLOW_GROVE: [number, number][] = [
  [0, 4],
  [7, 4],
  [7, 14],
  [14, 14],
  [14, 22],
  [22, 22],
  [22, 8],
  [30, 8],
  [30, 18],
  [39, 18],
];

export const MAP_PRESETS: MapPreset[] = [
  {
    id: 'bastion-approach',
    name: 'Bastion Approach',
    waypoints: [BASTION_APPROACH_WAYPOINTS],
  },
  { id: 'emerald-pass', name: 'Emerald Pass', waypoints: [PATH_WAYPOINTS_A] },
  { id: 'serpent-marsh', name: 'Serpent Marsh', waypoints: [PATH_WAYPOINTS_B] },
  { id: 'crimson-ridge', name: 'Crimson Ridge', waypoints: [PATH_WAYPOINTS_C] },
  {
    id: 'twin-forks',
    name: 'Twin Forks',
    waypoints: [TWIN_FORKS_A, TWIN_FORKS_B],
    multi: true,
  },
  { id: 'iron-causeway', name: 'Iron Causeway', waypoints: [IRON_CAUSEWAY] },
  { id: 'hollow-grove', name: 'Hollow Grove', waypoints: [HOLLOW_GROVE] },
];

function tileCenter(c: number, r: number): PathPoint {
  return { x: c * TILE_SIZE + TILE_SIZE / 2, y: r * TILE_SIZE + TILE_SIZE / 2 };
}

function expandPath(waypoints: [number, number][]): PathPoint[] {
  const points: PathPoint[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [c0, r0] = waypoints[i]!;
    const [c1, r1] = waypoints[i + 1]!;
    const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const c = Math.round(c0 + (c1 - c0) * t);
      const r = Math.round(r0 + (r1 - r0) * t);
      points.push(tileCenter(c, r));
    }
  }
  const last = waypoints[waypoints.length - 1]!;
  points.push(tileCenter(last[0], last[1]));
  return points;
}

function computePathLength(path: PathPoint[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

function markRoad(tiles: TileType[][], waypoints: [number, number][]): void {
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [c0, r0] = waypoints[i]!;
    const [c1, r1] = waypoints[i + 1]!;
    const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      const c = Math.round(c0 + (c1 - c0) * t);
      const r = Math.round(r0 + (r1 - r0) * t);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (Math.abs(dr) + Math.abs(dc) > 1) continue;
          const cc = c + dc;
          const rr = r + dr;
          if (cc >= 0 && cc < MAP_COLS && rr >= 0 && rr < MAP_ROWS) {
            if (dc === 0 && dr === 0) tiles[rr]![cc] = 'road';
            else if (tiles[rr]![cc] === 'grass' || tiles[rr]![cc] === 'rock') {
              tiles[rr]![cc] = 'buildable';
            }
          }
        }
      }
    }
  }
}

function emptyTiles(): TileType[][] {
  const tiles: TileType[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < MAP_COLS; c++) row.push('grass');
    tiles.push(row);
  }
  return tiles;
}

function paintLakes(tiles: TileType[][], rng: () => number, count: number): void {
  for (let i = 0; i < count; i++) {
    const cx = Math.floor(rng() * MAP_COLS);
    const cy = Math.floor(rng() * MAP_ROWS);
    const rad = 2 + Math.floor(rng() * 3);
    for (let r = cy - rad; r <= cy + rad; r++) {
      for (let c = cx - rad; c <= cx + rad; c++) {
        if (c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) continue;
        if ((c - cx) * (c - cx) + (r - cy) * (r - cy) <= rad * rad) {
          if (tiles[r]![c] === 'grass') tiles[r]![c] = 'water';
        }
      }
    }
  }
}

function paintRocks(tiles: TileType[][], rng: () => number, count: number): void {
  for (let i = 0; i < count; i++) {
    const c = Math.floor(rng() * MAP_COLS);
    const r = Math.floor(rng() * MAP_ROWS);
    if (tiles[r]![c] === 'grass') tiles[r]![c] = 'rock';
  }
}

function isPathTile(t: TileType): boolean {
  return t === 'road' || t === 'spawn' || t === 'base' || t === 'gap';
}

function applyBridgeGaps(
  tiles: TileType[][],
  gaps: [number, number][],
  hp = 120,
): BridgeSlot[] {
  const slots: BridgeSlot[] = [];
  for (const [c, r] of gaps) {
    if (c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) continue;
    tiles[r]![c] = 'gap';
    slots.push({ c, r, built: false, hp, maxHp: hp });
  }
  return slots;
}

/** Collect grid cells visited by waypoint polylines (centers only). */
function pathCells(waypointsList: [number, number][][]): Set<string> {
  const cells = new Set<string>();
  for (const waypoints of waypointsList) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const [c0, r0] = waypoints[i]!;
      const [c1, r1] = waypoints[i + 1]!;
      const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0), 1);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const c = Math.round(c0 + (c1 - c0) * t);
        const r = Math.round(r0 + (r1 - r0) * t);
        cells.add(`${c},${r}`);
      }
    }
  }
  return cells;
}

function placeDestructibles(
  tiles: TileType[][],
  rng: () => number,
  count: number,
): DestructibleRock[] {
  const candidates: [number, number][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    for (let c = 0; c < MAP_COLS; c++) {
      const t = tiles[r]![c]!;
      if (t === 'grass' || t === 'rock') candidates.push([c, r]);
    }
  }
  const out: DestructibleRock[] = [];
  const n = Math.min(count, candidates.length);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(rng() * candidates.length);
    const [c, r] = candidates.splice(idx, 1)[0]!;
    const hp = 80 + Math.floor(rng() * 81);
    tiles[r]![c] = 'rock';
    out.push({ c, r, hp, maxHp: hp });
  }
  return out;
}

function buildMaskFromTiles(tiles: TileType[][]): boolean[][] {
  const nearRoad: boolean[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      let near = false;
      for (let dr = -2; dr <= 2 && !near; dr++) {
        for (let dc = -2; dc <= 2 && !near; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr >= MAP_ROWS || cc < 0 || cc >= MAP_COLS) continue;
          if (isPathTile(tiles[rr]![cc]!) || tiles[rr]![cc] === 'buildable') near = true;
        }
      }
      row.push(near);
    }
    nearRoad.push(row);
  }

  const mask: boolean[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      const t = tiles[r]![c]!;
      if (t === 'buildable') row.push(true);
      else if (t === 'grass' && nearRoad[r]![c]) row.push(true);
      else row.push(false);
    }
    mask.push(row);
  }
  return mask;
}

function placeDecor(tiles: TileType[][], rng: () => number, count: number): MapData['decor'] {
  const decor: MapData['decor'] = [];
  for (let i = 0; i < count; i++) {
    const c = Math.floor(rng() * MAP_COLS);
    const r = Math.floor(rng() * MAP_ROWS);
    const t = tiles[r]![c]!;
    if (t === 'grass' || t === 'buildable') {
      decor.push({
        x: c * TILE_SIZE + TILE_SIZE * (0.2 + rng() * 0.6),
        y: r * TILE_SIZE + TILE_SIZE * (0.2 + rng() * 0.6),
        kind: Math.floor(rng() * 5),
        scale: 0.6 + rng() * 0.8,
      });
    }
  }
  return decor;
}

function finalizeMap(
  id: string,
  name: string,
  tiles: TileType[][],
  waypointsList: [number, number][][],
  bridgeSlots: BridgeSlot[],
  destructibles: DestructibleRock[],
  decor: MapData['decor'],
  isRandom: boolean,
): MapData {
  const primary = waypointsList[0]!;
  const spawnWp = primary[0]!;
  const baseWp = primary[primary.length - 1]!;
  tiles[spawnWp[1]]![spawnWp[0]] = 'spawn';
  tiles[baseWp[1]]![baseWp[0]] = 'base';

  // Mark other lane spawns/bases if distinct
  for (let i = 1; i < waypointsList.length; i++) {
    const wps = waypointsList[i]!;
    const s = wps[0]!;
    const b = wps[wps.length - 1]!;
    if (tiles[s[1]]![s[0]] !== 'base') tiles[s[1]]![s[0]] = 'spawn';
    if (tiles[b[1]]![b[0]] !== 'spawn') tiles[b[1]]![b[0]] = 'base';
  }

  const paths = waypointsList.map((wps) => expandPath(wps));
  const pathLengths = paths.map((p) => computePathLength(p));
  const buildMask = buildMaskFromTiles(tiles);

  // Gaps and roads are never buildable
  for (const slot of bridgeSlots) {
    if (!slot.built) {
      buildMask[slot.r]![slot.c] = false;
      tiles[slot.r]![slot.c] = 'gap';
    }
  }
  for (const d of destructibles) {
    buildMask[d.r]![d.c] = false;
    tiles[d.r]![d.c] = 'rock';
  }

  const spawns = waypointsList.map((wps) => tileCenter(wps[0]![0], wps[0]![1]));
  const bases = waypointsList.map((wps) => {
    const last = wps[wps.length - 1]!;
    return tileCenter(last[0], last[1]);
  });

  const basePaths = paths.map((p) => p.map((pt) => ({ ...pt })));
  const basePathLengths = [...pathLengths];

  return {
    id,
    name,
    cols: MAP_COLS,
    rows: MAP_ROWS,
    tiles,
    path: paths[0]!,
    pathLength: pathLengths[0]!,
    paths,
    pathLengths,
    basePaths,
    basePathLengths,
    spawn: spawns[0]!,
    base: bases[0]!,
    spawns,
    bases,
    decor,
    buildMask,
    bridgeSlots,
    destructibles,
    isRandom,
  };
}

function generateFromPreset(preset: MapPreset, seed: string): MapData {
  // First playable level — fully authored, never procedural
  if (preset.id === 'bastion-approach') {
    return buildBastionApproach();
  }

  const rng = createRng(hashString(seed + preset.id));
  const tiles = emptyTiles();

  paintLakes(tiles, rng, 4 + Math.floor(rng() * 3));
  paintRocks(tiles, rng, 55);

  // Iron causeway: water belt around the crossing for atmosphere
  if (preset.id === 'iron-causeway') {
    for (let c = 10; c <= 30; c++) {
      for (const dr of [-3, -2, 2, 3]) {
        const r = 14 + dr;
        if (r >= 0 && r < MAP_ROWS && tiles[r]![c] === 'grass') tiles[r]![c] = 'water';
      }
    }
  }

  for (const wps of preset.waypoints) {
    markRoad(tiles, wps);
  }

  let bridgeSlots: BridgeSlot[] = [];
  if (preset.id === 'iron-causeway') {
    bridgeSlots = applyBridgeGaps(tiles, IRON_CAUSEWAY_GAPS, 140);
  }

  const destructibles = placeDestructibles(tiles, rng, 8 + Math.floor(rng() * 5));
  const decor = placeDecor(tiles, rng, 80);

  return finalizeMap(
    preset.id,
    preset.name,
    tiles,
    preset.waypoints,
    bridgeSlots,
    destructibles,
    decor,
    false,
  );
}

function clampRow(r: number): number {
  return Math.max(2, Math.min(MAP_ROWS - 3, r));
}

/** Fair winding left→right path with 6–10 orthogonal waypoints. */
function generateWindingWaypoints(rng: () => number): [number, number][] {
  const count = 6 + Math.floor(rng() * 5); // 6–10
  const pts: [number, number][] = [];
  let c = 0;
  let r = 4 + Math.floor(rng() * (MAP_ROWS - 8));
  pts.push([c, r]);

  for (let i = 1; i < count - 1; i++) {
    if (i % 2 === 1) {
      const advance = 3 + Math.floor(rng() * 6);
      c = Math.min(MAP_COLS - 3, c + advance);
      pts.push([c, r]);
    } else {
      const amp = 4 + Math.floor(rng() * 7);
      const dir = rng() < 0.5 ? -1 : 1;
      let nr = clampRow(r + dir * amp);
      if (nr === r) nr = clampRow(r - dir * amp);
      r = nr;
      pts.push([c, r]);
    }
  }

  pts.push([MAP_COLS - 1, r]);
  return pts;
}

function offsetParallelPath(
  primary: [number, number][],
  rng: () => number,
): [number, number][] {
  const offset = (rng() < 0.5 ? -1 : 1) * (3 + Math.floor(rng() * 3));
  return primary.map((wp, i) => {
    if (i === 0 || i === primary.length - 1) return [wp[0], wp[1]] as [number, number];
    return [wp[0], clampRow(wp[1] + offset)] as [number, number];
  });
}

/** Pick 1–2 interior path cells for bridge gaps. */
function pickBridgeGapsOnPath(
  waypointsList: [number, number][][],
  rng: () => number,
  count: number,
): [number, number][] {
  const cells = [...pathCells(waypointsList)]
    .map((k) => {
      const [cs, rs] = k.split(',');
      return [Number(cs), Number(rs)] as [number, number];
    })
    .filter(([c, r]) => c > 2 && c < MAP_COLS - 3 && r > 1 && r < MAP_ROWS - 2);

  const gaps: [number, number][] = [];
  const pool = cells.slice();
  while (gaps.length < count && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    const cell = pool.splice(idx, 1)[0]!;
    if (gaps.some(([gc, gr]) => Math.abs(gc - cell[0]) + Math.abs(gr - cell[1]) < 4)) continue;
    gaps.push(cell);
  }
  return gaps;
}

export function generateRandomMap(seed: string): MapData {
  const rng = createRng(hashString(seed));
  const tiles = emptyTiles();

  const primary = generateWindingWaypoints(rng);
  const waypointsList: [number, number][][] = [primary];
  if (rng() < 0.25) {
    waypointsList.push(offsetParallelPath(primary, rng));
  }

  paintLakes(tiles, rng, 3 + Math.floor(rng() * 3));
  paintRocks(tiles, rng, 40 + Math.floor(rng() * 25));

  for (const wps of waypointsList) {
    markRoad(tiles, wps);
  }

  const gapCount = 1 + Math.floor(rng() * 2); // 1–2
  const gapCells = pickBridgeGapsOnPath(waypointsList, rng, gapCount);
  // Water near gaps
  for (const [gc, gr] of gapCells) {
    for (const [dc, dr] of [
      [0, -2],
      [0, 2],
      [-1, -2],
      [1, 2],
    ] as [number, number][]) {
      const c = gc + dc;
      const r = gr + dr;
      if (c >= 0 && c < MAP_COLS && r >= 0 && r < MAP_ROWS && tiles[r]![c] === 'grass') {
        tiles[r]![c] = 'water';
      }
    }
  }
  const bridgeSlots = applyBridgeGaps(tiles, gapCells, 100 + Math.floor(rng() * 40));

  const destructibles = placeDestructibles(tiles, rng, 8 + Math.floor(rng() * 8)); // 8–15
  const decor = placeDecor(tiles, rng, 70 + Math.floor(rng() * 30));

  const id = `random-${seed.slice(0, 12)}`;
  return finalizeMap(id, 'Random Frontier', tiles, waypointsList, bridgeSlots, destructibles, decor, true);
}

/** Generate a polished handcrafted-feeling map from waypoints + seed. */
export function generateMap(presetIndex = 0, seed = 'bastion'): MapData {
  if (presetIndex === -1) return generateRandomMap(seed);

  const preset = MAP_PRESETS[((presetIndex % MAP_PRESETS.length) + MAP_PRESETS.length) % MAP_PRESETS.length]!;
  if (preset.id === 'random') return generateRandomMap(seed);

  return generateFromPreset(preset, seed);
}

export function worldToTile(x: number, y: number): { c: number; r: number } {
  return {
    c: Math.floor(x / TILE_SIZE),
    r: Math.floor(y / TILE_SIZE),
  };
}

export function canBuildAt(map: MapData, x: number, y: number): boolean {
  const { c, r } = worldToTile(x, y);
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return false;
  return map.buildMask[r]![c]!;
}

export function tileKey(c: number, r: number): string {
  return `${c},${r}`;
}

function isRoadLike(tile: TileType): boolean {
  return tile === 'road' || tile === 'spawn' || tile === 'base';
}

export function isWalkableRoad(
  map: MapData,
  c: number,
  r: number,
  walls: Set<string>,
): boolean {
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return false;
  const tile = map.tiles[r]![c]!;
  if (!isRoadLike(tile)) return false;
  // Spawn/base stay walkable even if somehow flagged
  if (tile === 'spawn' || tile === 'base') return true;
  return !walls.has(tileKey(c, r));
}

/** BFS path as world-space tile centers from spawn tile to a base tile. */
export function findRoadPath(
  map: MapData,
  startC: number,
  startR: number,
  walls: Set<string>,
): PathPoint[] | null {
  const goals = new Set<string>();
  for (const b of map.bases) {
    const { c, r } = worldToTile(b.x, b.y);
    goals.add(tileKey(c, r));
  }
  if (goals.size === 0) return null;

  const startKey = tileKey(startC, startR);
  if (!isWalkableRoad(map, startC, startR, walls) && !goals.has(startKey)) return null;

  const q: [number, number][] = [[startC, startR]];
  const came = new Map<string, string | null>();
  came.set(startKey, null);
  const dirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let endKey: string | null = null;
  while (q.length) {
    const [c, r] = q.shift()!;
    const key = tileKey(c, r);
    if (goals.has(key)) {
      endKey = key;
      break;
    }
    for (const [dc, dr] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      const nk = tileKey(nc, nr);
      if (came.has(nk)) continue;
      if (!isWalkableRoad(map, nc, nr, walls) && !goals.has(nk)) continue;
      came.set(nk, key);
      q.push([nc, nr]);
    }
  }
  if (!endKey) return null;

  const cells: [number, number][] = [];
  let cur: string | null = endKey;
  while (cur) {
    const [cs, rs] = cur.split(',').map(Number) as [number, number];
    cells.push([cs, rs]);
    cur = came.get(cur) ?? null;
  }
  cells.reverse();
  return cells.map(([c, r]) => tileCenter(c, r));
}

/** Rebuild active ground paths from the road grid + walls. Returns false if any spawn is sealed. */
export function rebuildPathsWithWalls(map: MapData, walls: Set<string>): boolean {
  if (walls.size === 0) {
    map.paths = map.basePaths.map((p) => p.map((pt) => ({ ...pt })));
    map.pathLengths = [...map.basePathLengths];
    map.path = map.paths[0]!;
    map.pathLength = map.pathLengths[0]!;
    return true;
  }

  const nextPaths: PathPoint[][] = [];
  const nextLens: number[] = [];
  for (let i = 0; i < map.spawns.length; i++) {
    const spawn = map.spawns[i]!;
    const { c, r } = worldToTile(spawn.x, spawn.y);
    const path = findRoadPath(map, c, r, walls);
    if (!path || path.length < 2) return false;
    nextPaths.push(path);
    nextLens.push(computePathLength(path));
  }
  map.paths = nextPaths;
  map.pathLengths = nextLens;
  map.path = nextPaths[0]!;
  map.pathLength = nextLens[0]!;
  return true;
}

export function canPlaceWallAt(
  map: MapData,
  x: number,
  y: number,
  walls: Set<string>,
  occupied: Set<string>,
): BuildRejectReason | null {
  if (!isInBounds(x, y)) return 'out-of-bounds';
  const snap = snapToTileCenter(x, y);
  const key = `${snap.x},${snap.y}`;
  if (occupied.has(key)) return 'occupied';
  const { c, r } = worldToTile(snap.x, snap.y);
  const tile = map.tiles[r]![c]!;
  if (tile === 'spawn') return 'spawn';
  if (tile === 'base') return 'base';
  if (tile === 'gap') return 'gap';
  if (tile === 'water') return 'water';
  if (tile === 'rock') return 'rock';
  if (tile !== 'road') return 'not-road';
  const wallKey = tileKey(c, r);
  if (walls.has(wallKey)) return 'occupied';
  const next = new Set(walls);
  next.add(wallKey);
  for (let i = 0; i < map.spawns.length; i++) {
    const spawn = map.spawns[i]!;
    const sc = worldToTile(spawn.x, spawn.y);
    if (!findRoadPath(map, sc.c, sc.r, next)) return 'blocks-path';
  }
  return null;
}

export function getTowerBuildRejectReason(
  map: MapData,
  x: number,
  y: number,
  occupied: Set<string>,
  gold: number,
  cost: number,
): BuildRejectReason | null {
  if (!isInBounds(x, y)) return 'out-of-bounds';
  const snap = snapToTileCenter(x, y);
  const key = `${snap.x},${snap.y}`;
  if (occupied.has(key)) return 'occupied';
  const { c, r } = worldToTile(snap.x, snap.y);
  const tile = map.tiles[r]![c]!;
  if (tile === 'gap') return 'gap';
  if (tile === 'water') return 'water';
  if (tile === 'rock') return 'rock';
  if (tile === 'road' || tile === 'spawn' || tile === 'base') return 'road';
  if (!canBuildAt(map, snap.x, snap.y)) return 'not-buildable';
  if (gold < cost) return 'need-gold';
  return null;
}

export function snapToTileCenter(x: number, y: number): PathPoint {
  const { c, r } = worldToTile(x, y);
  return {
    x: c * TILE_SIZE + TILE_SIZE / 2,
    y: r * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function getPositionAlongPath(path: PathPoint[], distance: number): PathPoint & { angle: number } {
  if (path.length === 0) return { x: 0, y: 0, angle: 0 };
  if (distance <= 0) {
    const a = path[0]!;
    const b = path[1] ?? a;
    return { x: a.x, y: a.y, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  let remaining = distance;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      };
    }
    remaining -= seg;
  }
  const last = path[path.length - 1]!;
  const prev = path[path.length - 2] ?? last;
  return {
    x: last.x,
    y: last.y,
    angle: Math.atan2(last.y - prev.y, last.x - prev.x),
  };
}

export function isInBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT;
}

export function isGapTile(map: MapData, x: number, y: number): boolean {
  const { c, r } = worldToTile(x, y);
  if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return false;
  return map.tiles[r]![c] === 'gap';
}

export function hasBridgeAt(map: MapData, c: number, r: number): boolean {
  return map.bridgeSlots.some((s) => s.c === c && s.r === r && s.built);
}

export function tryBuildBridge(map: MapData, c: number, r: number): boolean {
  const slot = map.bridgeSlots.find((s) => s.c === c && s.r === r);
  if (!slot || slot.built) return false;
  slot.built = true;
  map.tiles[r]![c] = 'road';
  // Adjacent grass becomes buildable overlay
  for (const [dc, dr] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as [number, number][]) {
    const cc = c + dc;
    const rr = r + dr;
    if (cc < 0 || rr < 0 || cc >= map.cols || rr >= map.rows) continue;
    if (map.tiles[rr]![cc] === 'grass') {
      map.tiles[rr]![cc] = 'buildable';
      map.buildMask[rr]![cc] = true;
    }
  }
  map.buildMask[r]![c] = false;
  return true;
}

export function damageDestructible(map: MapData, x: number, y: number, damage: number): boolean {
  const { c, r } = worldToTile(x, y);
  const idx = map.destructibles.findIndex((d) => d.c === c && d.r === r);
  if (idx < 0) return false;
  const rock = map.destructibles[idx]!;
  rock.hp -= damage;
  if (rock.hp > 0) return false;
  map.destructibles.splice(idx, 1);
  map.tiles[r]![c] = 'grass';
  map.buildMask[r]![c] = true;
  return true;
}

export function getPathCount(map: MapData): number {
  return map.paths.length;
}
