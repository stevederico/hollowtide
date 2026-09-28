import { fbm, lerp, smoothstep } from './noise.ts';

export const SEA_HIGH = 0;
export const SEA_LOW = -2.2;
export const EYE = 1.7;
export const WALKWAY_TOP = -0.8;
export const PIER_TOP = 1.3;

export interface Spot {
  x: number;
  z: number;
}

/** Where the landmarks stand. North is -z, east is +x. */
export const SITES = {
  pier: { x: 0, z: 59 },
  crossroads: { x: 0, z: 18 },
  engineHouse: { x: -45, z: 20 },
  lighthouse: { x: 48, z: 0 },
  chimeFrame: { x: -25, z: -23 },
  observatory: { x: 12, z: -36 },
  vaultDoor: { x: 46.5, z: -45 },
  vaultRock: { x: 55, z: -53.5 },
  stack: { x: -76, z: 0 }
} as const;

/** Where the player stands for each outdoor node. */
export const STANDS = {
  dock: { x: 0, z: 64 },
  beach: { x: 0, z: 47 },
  crossroads: { x: 0, z: 19 },
  engineYard: { x: -35.5, z: 20 },
  lighthouseBase: { x: 38.5, z: 0 },
  garden: { x: -19.5, z: -17.5 },
  gardenShore: { x: -50, z: -4 },
  stackLanding: { x: -65, z: 0 },
  observatoryYard: { x: 12, z: -27.5 },
  cove: { x: 34, z: -30 },
  vaultDoor: { x: 44.1, z: -42.6 }
} as const;

interface Pad extends Spot {
  radius: number;
  height?: number;
}

const PADS: readonly Pad[] = [
  { ...SITES.crossroads, radius: 5 },
  { ...SITES.engineHouse, radius: 9, height: 1.9 },
  { ...SITES.lighthouse, radius: 8, height: 3.5 },
  { x: -23, z: -21, radius: 10 },
  { ...SITES.observatory, radius: 10, height: 10.5 },
  { ...STANDS.cove, radius: 4 },
  { ...STANDS.gardenShore, radius: 4 },
  { ...STANDS.beach, radius: 3 }
];

/** Footpaths as polylines, used for ground colour and to keep trees off them. */
export const PATHS: readonly (readonly Spot[])[] = [
  [STANDS.beach, { x: 1.5, z: 33 }, STANDS.crossroads],
  [STANDS.crossroads, { x: -18, z: 21 }, STANDS.engineYard, { x: -41, z: 20 }],
  [STANDS.crossroads, { x: 20, z: 8 }, STANDS.lighthouseBase, { x: 44, z: 0 }],
  [STANDS.crossroads, { x: -10, z: 0 }, STANDS.garden],
  [STANDS.crossroads, { x: 6, z: -4 }, { x: 11, z: -18 }, STANDS.observatoryYard],
  [STANDS.garden, { x: -4, z: -24 }, STANDS.observatoryYard],
  [STANDS.garden, { x: -36, z: -11 }, STANDS.gardenShore, { x: -58, z: -2 }],
  [STANDS.observatoryYard, { x: 24, z: -28 }, STANDS.cove, { x: 37.5, z: -34.5 }],
  [STANDS.cove, { x: 38, z: -14 }, STANDS.lighthouseBase],
  [{ x: 37.5, z: -34.5 }, SITES.vaultDoor],
  [{ x: -58, z: -2 }, { x: -68, z: 0 }]
];

function rawHeight(x: number, z: number): number {
  const d = Math.hypot(x / 60, z / 54);
  let h = 5.5 * (1 - d * d);
  const hill = Math.exp(-((x - 12) ** 2 + (z + 36) ** 2) / (2 * 13 ** 2));
  h += 8 * hill;
  const land = smoothstep(-0.5, 2, h);
  h += fbm(x * 0.045 + 7.3, z * 0.045 - 2.1, 4) * 2.2 * land;
  h += fbm(x * 0.2, z * 0.2, 2) * 0.35 * land;
  if (h < 0) h = Math.max(h * 1.6, -9);
  return h;
}

const PAD_HEIGHTS = PADS.map((pad) => pad.height ?? Math.max(1.2, rawHeight(pad.x, pad.z)));

/** Ground height at a point, with building pads flattened. */
export function heightAt(x: number, z: number): number {
  let h = rawHeight(x, z);
  PADS.forEach((pad, index) => {
    const dist = Math.hypot(x - pad.x, z - pad.z);
    const t = 1 - smoothstep(pad.radius, pad.radius * 1.7, dist);
    if (t > 0) h = lerp(h, PAD_HEIGHTS[index] ?? h, t);
  });
  return h;
}

function segmentDistance(p: Spot, a: Spot, b: Spot): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2));
  return Math.hypot(p.x - (a.x + dx * t), p.z - (a.z + dz * t));
}

/** Distance from a point to the nearest footpath. */
export function pathDistance(x: number, z: number): number {
  let best = Infinity;
  PATHS.forEach((path) => {
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      if (a && b) best = Math.min(best, segmentDistance({ x, z }, a, b));
    }
  });
  return best;
}

/** True when a point is clear of every pad, with a margin. */
export function isClearOfPads(x: number, z: number, margin: number): boolean {
  return PADS.every((pad) => Math.hypot(x - pad.x, z - pad.z) > pad.radius + margin);
}

/** Compass yaw in radians for travel from one spot to another. 0 is north, clockwise. */
export function yawBetween(from: Spot, to: Spot): number {
  return Math.atan2(to.x - from.x, -(to.z - from.z));
}
