/**
 * Bastion Approach — handcrafted first playable map.
 * Forest entrance → road → bridge → outer wall → main gate → Great Tree.
 * No procedural lakes/rocks/decor — authored for trailer-quality feel.
 */

import { MAP_COLS, MAP_ROWS, TILE_SIZE } from '../../config/constants';
import type {
  BridgeSlot,
  DestructibleRock,
  MapData,
  TileType,
} from '../map';

/** Single lane: entrance (left) → Great Tree bastion (right). */
export const BASTION_APPROACH_WAYPOINTS: [number, number][] = [
  [0, 11], // Forest entrance
  [8, 11], // Forest road
  [13, 11], // Clearing
  [13, 16], // Drop toward the stream
  [17, 16], // Bridge approach
  [19, 16], // Bridge
  [23, 16], // Far bank
  [27, 16], // Outer wall road
  [31, 13], // Rise to the gate
  [35, 12], // Main gate
  [39, 12], // Great Tree / Bastion heart
];

const BRIDGE_CELL: [number, number] = [19, 16];

function emptyGrass(): TileType[][] {
  const tiles: TileType[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: TileType[] = [];
    for (let c = 0; c < MAP_COLS; c++) row.push('grass');
    tiles.push(row);
  }
  return tiles;
}

function paintRect(
  tiles: TileType[][],
  c0: number,
  r0: number,
  c1: number,
  r1: number,
  type: TileType,
  only?: TileType[],
): void {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) continue;
      if (only && !only.includes(tiles[r]![c]!)) continue;
      tiles[r]![c] = type;
    }
  }
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
          if (cc < 0 || cc >= MAP_COLS || rr < 0 || rr >= MAP_ROWS) continue;
          if (dc === 0 && dr === 0) tiles[rr]![cc] = 'road';
          else if (tiles[rr]![cc] === 'grass' || tiles[rr]![cc] === 'rock') {
            tiles[rr]![cc] = 'buildable';
          }
        }
      }
    }
  }
}

function expandPath(waypoints: [number, number][]): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const [c0, r0] = waypoints[i]!;
    const [c1, r1] = waypoints[i + 1]!;
    const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const c = Math.round(c0 + (c1 - c0) * t);
      const r = Math.round(r0 + (r1 - r0) * t);
      points.push({
        x: c * TILE_SIZE + TILE_SIZE / 2,
        y: r * TILE_SIZE + TILE_SIZE / 2,
      });
    }
  }
  const last = waypoints[waypoints.length - 1]!;
  points.push({
    x: last[0] * TILE_SIZE + TILE_SIZE / 2,
    y: last[1] * TILE_SIZE + TILE_SIZE / 2,
  });
  return points;
}

function pathLength(path: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

function buildMask(tiles: TileType[][]): boolean[][] {
  const mask: boolean[][] = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < MAP_COLS; c++) {
      const t = tiles[r]![c]!;
      row.push(t === 'buildable');
    }
    mask.push(row);
  }
  return mask;
}

/** Extra tower pads near key choke points. */
function paintBuildPads(tiles: TileType[][]): void {
  const pads: [number, number][] = [
    // Forest road flanks
    [4, 9],
    [4, 13],
    [7, 9],
    [7, 13],
    [10, 9],
    [10, 13],
    // Pre-bridge
    [15, 14],
    [15, 18],
    [16, 14],
    [16, 18],
    // Post-bridge
    [22, 14],
    [22, 18],
    [24, 14],
    [24, 18],
    // Outer wall courtyard
    [28, 14],
    [28, 18],
    [29, 12],
    [29, 14],
    // Gate approach
    [32, 11],
    [32, 14],
    [33, 10],
    [33, 14],
    [36, 10],
    [36, 14],
  ];
  for (const [c, r] of pads) {
    if (tiles[r]![c] === 'grass') tiles[r]![c] = 'buildable';
  }
}

function paintStream(tiles: TileType[][]): void {
  // Meandering stream cutting the approach — bridge crosses at BRIDGE_CELL
  for (let r = 8; r <= 22; r++) {
    for (let c = 18; c <= 20; c++) {
      if (tiles[r]![c] === 'grass' || tiles[r]![c] === 'buildable') {
        tiles[r]![c] = 'water';
      }
    }
  }
  // Soft banks
  for (const [c, r] of [
    [17, 12],
    [17, 14],
    [17, 18],
    [17, 20],
    [21, 12],
    [21, 14],
    [21, 18],
    [21, 20],
  ] as [number, number][]) {
    if (tiles[r]![c] === 'grass') tiles[r]![c] = 'water';
  }
}

function paintOuterWall(tiles: TileType[][]): DestructibleRock[] {
  const rocks: DestructibleRock[] = [];
  const wall: [number, number][] = [
    // North wall segment
    [26, 11],
    [26, 12],
    [26, 13],
    [26, 14],
    [27, 11],
    [27, 12],
    // South wall segment
    [26, 18],
    [26, 19],
    [26, 20],
    [27, 19],
    [27, 20],
    // Flanking ruins
    [25, 11],
    [25, 20],
    [28, 11],
    [28, 20],
  ];
  for (const [c, r] of wall) {
    if (tiles[r]![c] === 'road' || tiles[r]![c] === 'gap') continue;
    tiles[r]![c] = 'rock';
    rocks.push({ c, r, hp: 140, maxHp: 140 });
  }
  return rocks;
}

function paintBastionGrounds(tiles: TileType[][]): DestructibleRock[] {
  const rocks: DestructibleRock[] = [];
  // Stone ring around the Great Tree (base)
  const ring: [number, number][] = [
    [37, 9],
    [38, 9],
    [39, 9],
    [37, 15],
    [38, 15],
    [39, 15],
    [36, 10],
    [36, 14],
  ];
  for (const [c, r] of ring) {
    if (tiles[r]![c] === 'road' || tiles[r]![c] === 'base') continue;
    tiles[r]![c] = 'rock';
    rocks.push({ c, r, hp: 160, maxHp: 160 });
  }
  // Courtyard pads
  paintRect(tiles, 36, 11, 38, 13, 'buildable', ['grass']);
  return rocks;
}

function placeDecor(tiles: TileType[][]): MapData['decor'] {
  const decor: MapData['decor'] = [];
  const add = (c: number, r: number, kind: number, scale: number, ox = 0.5, oy = 0.5) => {
    if (c < 0 || c >= MAP_COLS || r < 0 || r >= MAP_ROWS) return;
    const t = tiles[r]![c]!;
    if (t !== 'grass' && t !== 'buildable') return;
    decor.push({
      x: c * TILE_SIZE + TILE_SIZE * ox,
      y: r * TILE_SIZE + TILE_SIZE * oy,
      kind,
      scale,
    });
  };

  // Dense forest — western approach
  for (let r = 2; r < 24; r++) {
    for (let c = 0; c < 12; c++) {
      if ((c * 13 + r * 7) % 5 === 0) add(c, r, 0, 0.85 + ((c + r) % 3) * 0.15);
      else if ((c * 5 + r * 11) % 7 === 0) add(c, r, 1, 0.7);
    }
  }

  // Mid forest fringe
  for (let r = 3; r < 22; r++) {
    for (let c = 12; c < 17; c++) {
      if ((c + r * 3) % 4 === 0) add(c, r, 0, 0.75);
      if ((c * 2 + r) % 6 === 0) add(c, r, 1, 0.65);
    }
  }

  // Stream reeds
  for (let r = 9; r <= 21; r++) {
    add(17, r, 3, 0.8);
    add(21, r, 3, 0.75);
  }

  // Outer wall moss / shrubs
  for (const [c, r] of [
    [25, 13],
    [25, 17],
    [28, 13],
    [28, 17],
    [29, 15],
  ] as [number, number][]) {
    add(c, r, 1, 0.8);
  }

  // Pathside flowers / pebbles
  for (const [c, r, k] of [
    [5, 12, 2],
    [9, 10, 4],
    [14, 12, 2],
    [23, 15, 4],
    [30, 15, 2],
    [33, 13, 4],
  ] as [number, number, number][]) {
    add(c, r, k, 0.7);
  }

  // Bastion courtyard — smaller trees, lanterns as pebbles
  for (const [c, r] of [
    [35, 10],
    [37, 14],
    [38, 11],
  ] as [number, number][]) {
    add(c, r, 0, 0.95);
  }

  // Great Tree canopy suggestion (renderer draws the hero tree; decor fills roots)
  add(39, 11, 0, 1.4, 0.35, 0.4);
  add(38, 12, 0, 1.1, 0.6, 0.55);
  add(39, 13, 1, 0.9);

  return decor;
}

/**
 * Build the authored Bastion Approach map.
 * Deterministic — same layout every run.
 */
export function buildBastionApproach(): MapData {
  const tiles = emptyGrass();
  const waypoints = [BASTION_APPROACH_WAYPOINTS];

  // Terrain base atmosphere
  paintStream(tiles);
  // Small pond in the northern woods
  paintRect(tiles, 3, 3, 6, 5, 'water', ['grass']);
  // Southern marsh pocket
  paintRect(tiles, 10, 22, 14, 25, 'water', ['grass']);

  markRoad(tiles, BASTION_APPROACH_WAYPOINTS);
  paintBuildPads(tiles);

  // Bridge gap (path cell over the stream)
  const [bc, br] = BRIDGE_CELL;
  tiles[br]![bc] = 'gap';
  const bridgeSlots: BridgeSlot[] = [{ c: bc, r: br, built: false, hp: 160, maxHp: 160 }];

  // Restore stream under non-path cells near bridge (markRoad may have overwritten)
  for (let r = 14; r <= 18; r++) {
    for (let c = 18; c <= 20; c++) {
      if (c === bc && r === br) continue;
      if (tiles[r]![c] === 'buildable' && Math.abs(c - bc) + Math.abs(r - br) <= 2) {
        // keep buildable banks
      } else if (tiles[r]![c] === 'grass') {
        tiles[r]![c] = 'water';
      }
    }
  }

  const wallRocks = paintOuterWall(tiles);
  const bastionRocks = paintBastionGrounds(tiles);
  const destructibles: DestructibleRock[] = [...wallRocks, ...bastionRocks];

  // Spawn / base markers
  const spawnWp = BASTION_APPROACH_WAYPOINTS[0]!;
  const baseWp = BASTION_APPROACH_WAYPOINTS[BASTION_APPROACH_WAYPOINTS.length - 1]!;
  tiles[spawnWp[1]]![spawnWp[0]] = 'spawn';
  tiles[baseWp[1]]![baseWp[0]] = 'base';

  const path = expandPath(BASTION_APPROACH_WAYPOINTS);
  const len = pathLength(path);
  const spawn = {
    x: spawnWp[0] * TILE_SIZE + TILE_SIZE / 2,
    y: spawnWp[1] * TILE_SIZE + TILE_SIZE / 2,
  };
  const base = {
    x: baseWp[0] * TILE_SIZE + TILE_SIZE / 2,
    y: baseWp[1] * TILE_SIZE + TILE_SIZE / 2,
  };

  const mask = buildMask(tiles);
  for (const slot of bridgeSlots) {
    if (!slot.built) {
      mask[slot.r]![slot.c] = false;
      tiles[slot.r]![slot.c] = 'gap';
    }
  }
  for (const d of destructibles) {
    mask[d.r]![d.c] = false;
    tiles[d.r]![d.c] = 'rock';
  }

  const decor = placeDecor(tiles);

  return {
    id: 'bastion-approach',
    name: 'Bastion Approach',
    cols: MAP_COLS,
    rows: MAP_ROWS,
    tiles,
    path,
    pathLength: len,
    paths: [path],
    pathLengths: [len],
    basePaths: [path.map((p) => ({ ...p }))],
    basePathLengths: [len],
    spawn,
    base,
    spawns: [spawn],
    bases: [base],
    decor,
    buildMask: mask,
    bridgeSlots,
    destructibles,
    isRandom: false,
  };
}
