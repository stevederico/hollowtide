import { describe, expect, it } from 'vitest';
import { dispatch } from './actions.ts';
import { JOURNAL_TOTAL } from './constants.ts';
import { createInitialState, isCodeProjected } from './state.ts';
import type { Action, GameState } from './types.ts';
import { pathToGrotto, pathToVault, solveGates } from './walkthrough.ts';

/** Run actions in order and fail loudly if any of them is rejected. */
function play(start: GameState, actions: Action[]): GameState {
  return actions.reduce((state, action) => {
    const result = dispatch(state, action);
    const isNoop = result.state === state;
    const isAllowedNoop = action.type === 'playMusicBox';
    if (isNoop && !isAllowedNoop) {
      throw new Error(`Rejected ${JSON.stringify(action)} at ${state.node}`);
    }
    return result.state;
  }, start);
}

describe('walkthrough', () => {
  it('finds a gate combination', () => {
    expect(solveGates().length).toBeGreaterThan(0);
  });

  it('reaches the open vault from a fresh game', () => {
    const state = play(createInitialState(), pathToVault(createInitialState()));
    expect(state.node).toBe('vault');
    expect(state.vaultOpen).toBe(true);
  });

  it('projects the vault code along the way', () => {
    const state = play(createInitialState(), pathToVault(createInitialState()));
    expect(isCodeProjected(state)).toBe(true);
  });

  it('ends with the ferry when the bell is rung', () => {
    const inVault = play(createInitialState(), pathToVault(createInitialState()));
    const state = play(inVault, [{ type: 'ringBell' }]);
    expect(state.ending).toBe('ferry');
  });

  it('reaches the hidden ending after the vault', () => {
    const inVault = play(createInitialState(), pathToVault(createInitialState()));
    const state = play(inVault, pathToGrotto());
    expect(state.ending).toBe('keeper');
  });

  it('collects every journal on the full route', () => {
    const inVault = play(createInitialState(), pathToVault(createInitialState()));
    const state = play(inVault, pathToGrotto());
    expect(state.journals).toHaveLength(JOURNAL_TOTAL);
  });

  it('will not call the ferry after the keeper ending', () => {
    const inVault = play(createInitialState(), pathToVault(createInitialState()));
    const keeper = play(inVault, [...pathToGrotto(), { type: 'keepExploring' }]);
    const back: Action[] = [
      { type: 'move', to: 'stackLanding' },
      { type: 'move', to: 'gardenShore' },
      { type: 'move', to: 'garden' },
      { type: 'move', to: 'observatoryYard' },
      { type: 'move', to: 'cove' },
      { type: 'move', to: 'vaultDoor' },
      { type: 'move', to: 'vault' }
    ];
    const inVaultAgain = play(keeper, back);
    const result = dispatch(inVaultAgain, { type: 'ringBell' });
    expect(result.state.ending).toBeNull();
  });

  it('allows both endings in one game', () => {
    const inVault = play(createInitialState(), pathToVault(createInitialState()));
    const rung = play(inVault, [{ type: 'ringBell' }, { type: 'keepExploring' }]);
    const state = play(rung, pathToGrotto());
    expect(state.endingsFound).toEqual(['ferry', 'keeper']);
  });
});
