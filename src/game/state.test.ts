import { describe, expect, it } from 'vitest';
import {
  CHIME_COUNT,
  ENGINE_RATING,
  GATE_FLOWS,
  GLYPH_COUNT,
  MELODY,
  RING_ORDERS,
  RING_TARGETS,
  VAULT_CODE
} from './constants.ts';
import { GLYPH_PATHS } from './glyphs.ts';
import {
  createInitialState,
  deserialize,
  flowShortfall,
  gateFlow,
  ringGlyph,
  ringsAligned,
  serialize,
  vaultCodeSet
} from './state.ts';

describe('createInitialState', () => {
  it('starts on the dock at high water without power', () => {
    const state = createInitialState();
    expect(state.node).toBe('dock');
    expect(state.tide).toBe('high');
    expect(state.powered).toBe(false);
  });

  it('starts with every puzzle unsolved', () => {
    const state = createInitialState();
    expect(ringsAligned(state)).toBe(false);
    expect(vaultCodeSet(state)).toBe(false);
    expect(gateFlow(state)).toBe(0);
  });

  it('returns independent copies', () => {
    const a = createInitialState();
    a.gates[0] = true;
    expect(createInitialState().gates[0]).toBe(false);
  });
});

describe('puzzle constants', () => {
  it('has a gate combination that lands on the rating', () => {
    const count = GATE_FLOWS.length;
    const sums = Array.from({ length: 1 << count }, (_, mask) =>
      GATE_FLOWS.reduce((sum: number, flow, i) => sum + ((mask & (1 << i)) !== 0 ? flow : 0), 0)
    );
    expect(sums).toContain(ENGINE_RATING);
  });

  it('has no single gate that solves the engine', () => {
    const flows: readonly number[] = GATE_FLOWS;
    expect(flows.includes(ENGINE_RATING)).toBe(false);
  });

  it('keeps the melody inside the chime range', () => {
    expect(MELODY.every((note) => note >= 0 && note < CHIME_COUNT)).toBe(true);
  });

  it('puts every glyph on every ring exactly once', () => {
    RING_ORDERS.forEach((order) => {
      expect([...order].sort()).toEqual(Array.from({ length: GLYPH_COUNT }, (_, i) => i));
    });
  });

  it('draws one path per glyph', () => {
    expect(GLYPH_PATHS).toHaveLength(GLYPH_COUNT);
  });

  it('uses valid glyphs for the vault code', () => {
    expect(VAULT_CODE.every((glyph) => glyph >= 0 && glyph < GLYPH_COUNT)).toBe(true);
  });
});

describe('gateFlow', () => {
  it('sums open gates', () => {
    const state = { ...createInitialState(), gates: [true, false, true, false, false, false] };
    expect(gateFlow(state)).toBe(11);
  });

  it('reports the shortfall against the rating', () => {
    const state = { ...createInitialState(), gates: [false, false, false, false, false, true] };
    expect(flowShortfall(state)).toBe(8);
  });
});

describe('ringGlyph', () => {
  it('reads the glyph under the pointer', () => {
    expect(ringGlyph(0, 3)).toBe(RING_TARGETS[0]);
  });

  it('wraps negative rotations', () => {
    expect(ringGlyph(0, -1)).toBe(RING_ORDERS[0][GLYPH_COUNT - 1]);
  });

  it('returns -1 for a ring that does not exist', () => {
    expect(ringGlyph(9, 0)).toBe(-1);
  });
});

describe('serialize', () => {
  it('round trips a state', () => {
    const state = { ...createInitialState(), powered: true, steps: 12, journals: ['arrival' as const] };
    expect(deserialize(serialize(state))).toEqual(state);
  });

  it('rejects empty input', () => {
    expect(deserialize(null)).toBeNull();
  });

  it('rejects broken JSON', () => {
    expect(deserialize('{nope')).toBeNull();
  });

  it('rejects an old version', () => {
    expect(deserialize(JSON.stringify({ ...createInitialState(), version: 0 }))).toBeNull();
  });

  it('rejects an unknown node', () => {
    expect(deserialize(JSON.stringify({ ...createInitialState(), node: 'moon' }))).toBeNull();
  });

  it('rejects a short gate list', () => {
    expect(deserialize(JSON.stringify({ ...createInitialState(), gates: [true] }))).toBeNull();
  });

  it('rejects an out of range dial', () => {
    expect(deserialize(JSON.stringify({ ...createInitialState(), vaultDials: [0, 1, 2, 99] }))).toBeNull();
  });
});
