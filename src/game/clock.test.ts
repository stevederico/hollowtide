import { describe, expect, it } from 'vitest';
import { MAX_GAP_MS, PlayClock } from './clock.ts';

function total(clock: PlayClock, samples: [number, boolean][]): number {
  return samples.reduce((sum, [now, isCounting]) => sum + clock.sample(now, isCounting), 0);
}

describe('PlayClock', () => {
  it('counts nothing on the first sample', () => {
    expect(new PlayClock().sample(5000, true)).toBe(0);
  });

  it('counts full wall time at a low frame rate', () => {
    const samples: [number, boolean][] = Array.from({ length: 601 }, (_, i) => [i * 1000, true]);
    expect(total(new PlayClock(), samples)).toBe(600_000);
  });

  it('matches wall time at sixty frames a second', () => {
    const samples: [number, boolean][] = Array.from({ length: 3601 }, (_, i) => [(i * 1000) / 60, true]);
    expect(total(new PlayClock(), samples)).toBeCloseTo(60_000, 3);
  });

  it('skips time while paused', () => {
    const samples: [number, boolean][] = [
      [0, true],
      [1000, true],
      [2000, false],
      [90_000, false],
      [91_000, true],
      [92_000, true]
    ];
    expect(total(new PlayClock(), samples)).toBe(2000);
  });

  it('skips the gap after pause is called', () => {
    const clock = new PlayClock();
    clock.sample(0, true);
    clock.sample(1000, true);
    clock.pause();
    clock.sample(500_000, true);
    expect(clock.sample(501_000, true)).toBe(1000);
  });

  it('caps one long gap', () => {
    const clock = new PlayClock();
    clock.sample(0, true);
    expect(clock.sample(10 * 60 * 60 * 1000, true)).toBe(MAX_GAP_MS);
  });

  it('ignores time running backwards', () => {
    const clock = new PlayClock();
    clock.sample(1000, true);
    expect(clock.sample(500, true)).toBe(0);
  });
});
