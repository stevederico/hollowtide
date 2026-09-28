import { describe, expect, it } from 'vitest';
import { SITES, STANDS, yawBetween } from './layout.ts';

const DEG = Math.PI / 180;

function compass(radians: number): number {
  return ((Math.round(radians / DEG) % 360) + 360) % 360;
}

describe('yawBetween', () => {
  it('reads north as zero', () => {
    expect(compass(yawBetween({ x: 0, z: 0 }, { x: 0, z: -10 }))).toBe(0);
  });

  it('reads east as ninety', () => {
    expect(compass(yawBetween({ x: 0, z: 0 }, { x: 10, z: 0 }))).toBe(90);
  });

  it('reads west as two seventy', () => {
    expect(compass(yawBetween({ x: 0, z: 0 }, { x: -10, z: 0 }))).toBe(270);
  });
});

describe('landmark bearings', () => {
  it('puts the engine house west of its yard', () => {
    expect(compass(yawBetween(STANDS.engineYard, SITES.engineHouse))).toBe(270);
  });

  it('puts the tower east of its base', () => {
    expect(compass(yawBetween(STANDS.lighthouseBase, SITES.lighthouse))).toBe(90);
  });

  it('puts the dome north of the hill stand', () => {
    expect(compass(yawBetween(STANDS.observatoryYard, SITES.observatory))).toBe(0);
  });

  it('puts the dome northwest of the tower, where the lamp must point', () => {
    const bearing = compass(yawBetween(SITES.lighthouse, SITES.observatory));
    expect(bearing).toBeGreaterThan(292);
    expect(bearing).toBeLessThan(338);
  });

  it('puts the stack due west of the tower', () => {
    expect(compass(yawBetween(SITES.lighthouse, SITES.stack))).toBe(270);
  });
});
