import { describe, expect, it } from 'vitest';
import { dispatch } from './actions.ts';
import { LAMP_TO_DOME, LAMP_TO_STACK, MELODY, VAULT_CODE } from './constants.ts';
import { createInitialState, gateFlow, isCodeProjected, isDomeLit } from './state.ts';
import type { Action, GameEvent, GameState } from './types.ts';

function at(node: GameState['node'], patch: Partial<GameState> = {}): GameState {
  return { ...createInitialState(), node, ...patch };
}

function run(state: GameState, ...actions: Action[]): GameState {
  return actions.reduce((current, action) => dispatch(current, action).state, state);
}

function messages(events: GameEvent[]): string[] {
  return events.flatMap((event) => (event.type === 'message' ? [event.text] : []));
}

const SOLVED_GATES = [false, false, true, false, false, true];

describe('move', () => {
  it('follows a link', () => {
    expect(run(at('dock'), { type: 'move', to: 'beach' }).node).toBe('beach');
  });

  it('counts steps', () => {
    expect(run(at('dock'), { type: 'move', to: 'beach' }).steps).toBe(1);
  });

  it('ignores a node that is not linked', () => {
    expect(run(at('dock'), { type: 'move', to: 'vault' }).node).toBe('dock');
  });

  it('blocks the tower door without power', () => {
    const result = dispatch(at('lighthouseBase'), { type: 'move', to: 'lighthouseHall' });
    expect(result.state.node).toBe('lighthouseBase');
    expect(messages(result.events)[0]).toContain('latch');
  });

  it('opens the tower door with power', () => {
    const state = run(at('lighthouseBase', { powered: true }), { type: 'move', to: 'lighthouseHall' });
    expect(state.node).toBe('lighthouseHall');
  });

  it('blocks the causeway at high water', () => {
    expect(run(at('cove'), { type: 'move', to: 'vaultDoor' }).node).toBe('cove');
  });

  it('opens the causeway at low water', () => {
    expect(run(at('cove', { tide: 'low' }), { type: 'move', to: 'vaultDoor' }).node).toBe('vaultDoor');
  });
});

describe('tide engine', () => {
  it('toggles a gate', () => {
    expect(gateFlow(run(at('enginePanel'), { type: 'toggleGate', index: 2 }))).toBe(8);
  });

  it('ignores gates away from the panel', () => {
    expect(gateFlow(run(at('engineRoom'), { type: 'toggleGate', index: 2 }))).toBe(0);
  });

  it('stalls under the rating', () => {
    const state = run(at('enginePanel'), { type: 'toggleGate', index: 0 }, { type: 'engage' });
    expect(state.powered).toBe(false);
    expect(state.breakerTripped).toBe(false);
  });

  it('throws the breaker over the rating', () => {
    const state = run(at('enginePanel', { gates: [true, true, true, true, true, true] }), { type: 'engage' });
    expect(state.breakerTripped).toBe(true);
    expect(gateFlow(state)).toBe(0);
  });

  it('locks gates until the breaker is reset', () => {
    const tripped = at('enginePanel', { breakerTripped: true });
    expect(gateFlow(run(tripped, { type: 'toggleGate', index: 0 }))).toBe(0);
    expect(gateFlow(run(tripped, { type: 'resetBreaker' }, { type: 'toggleGate', index: 0 }))).toBe(3);
  });

  it('starts at exactly the rating', () => {
    expect(run(at('enginePanel', { gates: SOLVED_GATES }), { type: 'engage' }).powered).toBe(true);
  });

  it('locks gates while running', () => {
    const running = at('enginePanel', { gates: SOLVED_GATES, powered: true });
    expect(gateFlow(run(running, { type: 'toggleGate', index: 0 }))).toBe(30);
  });

  it('keeps the tide lever dead without power', () => {
    expect(run(at('enginePanel'), { type: 'toggleTide' }).tide).toBe('high');
  });

  it('moves the tide with power', () => {
    const powered = at('enginePanel', { powered: true });
    expect(run(powered, { type: 'toggleTide' }).tide).toBe('low');
    expect(run(powered, { type: 'toggleTide' }, { type: 'toggleTide' }).tide).toBe('high');
  });
});

describe('singing stones', () => {
  const strikes = MELODY.map((index): Action => ({ type: 'strikeChime', index }));

  it('solves on the melody', () => {
    expect(run(at('chimes'), ...strikes).chimesSolved).toBe(true);
  });

  it('solves after wrong notes, using the last six', () => {
    const state = run(at('chimes'), { type: 'strikeChime', index: 0 }, { type: 'strikeChime', index: 4 }, ...strikes);
    expect(state.chimesSolved).toBe(true);
  });

  it('stays sealed on a wrong tune', () => {
    const wrong = [...strikes].reverse();
    expect(run(at('chimes'), ...wrong).chimesSolved).toBe(false);
  });

  it('always sounds the chime', () => {
    const result = dispatch(at('chimes'), { type: 'strikeChime', index: 3 });
    expect(result.events).toContainEqual({ type: 'chime', index: 3 });
  });

  it('keeps the lens sealed until solved', () => {
    expect(run(at('chimes'), { type: 'takeLens' }).inventory).toEqual([]);
  });

  it('gives the lens once', () => {
    const state = run(at('chimes', { chimesSolved: true }), { type: 'takeLens' }, { type: 'takeLens' });
    expect(state.inventory).toEqual(['lens']);
  });
});

describe('lamp', () => {
  it('will not turn without power', () => {
    expect(run(at('lampRoom'), { type: 'turnLamp', delta: 1 }).lampDir).toBe(createInitialState().lampDir);
  });

  it('wraps around the compass', () => {
    const state = run(at('lampRoom', { powered: true, lampDir: 0 }), { type: 'turnLamp', delta: -1 });
    expect(state.lampDir).toBe(7);
  });

  it('needs the lens in hand to fit it', () => {
    expect(run(at('lampRoom'), { type: 'fitLens' }).lensFitted).toBe(false);
  });

  it('moves the lens from inventory to the lamp', () => {
    const state = run(at('lampRoom', { inventory: ['lens'] }), { type: 'fitLens' });
    expect(state.lensFitted).toBe(true);
    expect(state.inventory).toEqual([]);
  });

  it('lights the dome only with power, lens and heading', () => {
    expect(isDomeLit(at('lampRoom', { powered: true, lensFitted: true, lampDir: LAMP_TO_DOME }))).toBe(true);
    expect(isDomeLit(at('lampRoom', { powered: true, lensFitted: false, lampDir: LAMP_TO_DOME }))).toBe(false);
    expect(isDomeLit(at('lampRoom', { powered: true, lensFitted: true, lampDir: 0 }))).toBe(false);
  });
});

describe('star dial', () => {
  it('rotates one ring', () => {
    expect(run(at('starDial'), { type: 'rotateRing', ring: 1, delta: 1 }).rings).toEqual([0, 1, 0]);
  });

  it('wraps backward', () => {
    expect(run(at('starDial'), { type: 'rotateRing', ring: 0, delta: -1 }).rings).toEqual([7, 0, 0]);
  });

  it('projects the code when aligned and lit', () => {
    const lit = at('starDial', { powered: true, lensFitted: true, lampDir: LAMP_TO_DOME, rings: [3, 5, 5] });
    expect(isCodeProjected(lit)).toBe(false);
    expect(isCodeProjected(run(lit, { type: 'rotateRing', ring: 2, delta: 1 }))).toBe(true);
  });

  it('stays dark when aligned without the beam', () => {
    expect(isCodeProjected(at('starDial', { rings: [3, 5, 6] }))).toBe(false);
  });
});

describe('vault', () => {
  it('refuses the wrong signs', () => {
    expect(run(at('vaultDoor', { tide: 'low' }), { type: 'openVault' }).vaultOpen).toBe(false);
  });

  it('opens on the code', () => {
    const state = run(at('vaultDoor', { tide: 'low', vaultDials: [...VAULT_CODE] }), { type: 'openVault' });
    expect(state.vaultOpen).toBe(true);
  });

  it('turns a dial', () => {
    const state = run(at('vaultDoor'), { type: 'turnVaultDial', index: 0, delta: 1 });
    expect(state.vaultDials[0]).toBe(3);
  });

  it('freezes the dials once open', () => {
    const open = at('vaultDoor', { vaultOpen: true, vaultDials: [...VAULT_CODE] });
    expect(run(open, { type: 'turnVaultDial', index: 0, delta: 1 }).vaultDials).toEqual([...VAULT_CODE]);
  });
});

describe('grotto', () => {
  const ready: Partial<GameState> = { powered: true, lensFitted: true, tide: 'low' };

  it('reveals when the lamp looks west at low water', () => {
    const state = run(at('lampRoom', { ...ready, lampDir: LAMP_TO_STACK + 1 }), { type: 'turnLamp', delta: -1 });
    expect(state.grottoRevealed).toBe(true);
  });

  it('reveals when the tide drops under a west beam', () => {
    const state = run(at('enginePanel', { ...ready, tide: 'high', lampDir: LAMP_TO_STACK }), { type: 'toggleTide' });
    expect(state.grottoRevealed).toBe(true);
  });

  it('stays hidden without the lens', () => {
    const noLens = at('lampRoom', { ...ready, lensFitted: false, lampDir: LAMP_TO_STACK + 1 });
    expect(run(noLens, { type: 'turnLamp', delta: -1 }).grottoRevealed).toBe(false);
  });

  it('stays revealed after the lamp turns away', () => {
    const state = run(at('lampRoom', { ...ready, grottoRevealed: true, lampDir: LAMP_TO_STACK }), {
      type: 'turnLamp',
      delta: 1
    });
    expect(state.grottoRevealed).toBe(true);
  });

  it('needs the fork for the cradle', () => {
    expect(run(at('grotto'), { type: 'placeFork' }).ending).toBeNull();
  });

  it('ends as keeper when the fork is placed', () => {
    expect(run(at('grotto', { inventory: ['fork'] }), { type: 'placeFork' }).ending).toBe('keeper');
  });
});

describe('journals and endings', () => {
  it('collects a journal where it lies', () => {
    expect(run(at('dock'), { type: 'readJournal', id: 'arrival' }).journals).toEqual(['arrival']);
  });

  it('will not collect a journal from elsewhere', () => {
    expect(run(at('dock'), { type: 'readJournal', id: 'bell' }).journals).toEqual([]);
  });

  it('rereads a known journal anywhere', () => {
    const result = dispatch(at('garden', { journals: ['arrival'] }), { type: 'readJournal', id: 'arrival' });
    expect(result.events).toContainEqual({ type: 'journal', id: 'arrival', isNew: false });
  });

  it('rings the bell for the ferry ending', () => {
    const state = run(at('vault'), { type: 'ringBell' });
    expect(state.ending).toBe('ferry');
    expect(state.endingsFound).toEqual(['ferry']);
  });

  it('keeps the bell silent once the fork is placed', () => {
    const result = dispatch(at('vault', { forkPlaced: true, endingsFound: ['keeper'] }), { type: 'ringBell' });
    expect(result.state.ending).toBeNull();
    expect(result.state.endingsFound).toEqual(['keeper']);
    expect(messages(result.events)[0]).toContain('keeper');
  });

  it('still allows the keeper ending after the ferry', () => {
    const state = run(
      at('vault'),
      { type: 'ringBell' },
      { type: 'keepExploring' },
      { type: 'takeFork' },
      { type: 'move', to: 'vaultDoor' }
    );
    expect(state.endingsFound).toEqual(['ferry']);
    expect(run({ ...state, node: 'grotto' }, { type: 'placeFork' }).ending).toBe('keeper');
  });

  it('freezes the game while an ending shows', () => {
    const state = run(at('vault'), { type: 'ringBell' }, { type: 'move', to: 'vaultDoor' });
    expect(state.node).toBe('vault');
  });

  it('resumes with keepExploring', () => {
    const state = run(at('vault'), { type: 'ringBell' }, { type: 'keepExploring' }, { type: 'takeFork' });
    expect(state.ending).toBeNull();
    expect(state.inventory).toEqual(['fork']);
  });

  it('adds time on tick', () => {
    expect(run(at('dock'), { type: 'tick', ms: 250 }).elapsedMs).toBe(250);
  });
});
