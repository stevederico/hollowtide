import { GATE_FLOWS, ENGINE_RATING, GLYPH_COUNT, LAMP_TO_DOME, LAMP_TO_STACK, MELODY, RING_TARGETS, VAULT_CODE } from './constants.ts';
import { ringGlyph } from './state.ts';
import type { Action, GameState, NodeId } from './types.ts';

function go(...path: NodeId[]): Action[] {
  return path.map((to) => ({ type: 'move', to }));
}

/** Smallest set of gates that lands exactly on the engine rating. */
export function solveGates(): number[] {
  const count = GATE_FLOWS.length;
  let best: number[] | null = null;
  for (let mask = 1; mask < 1 << count; mask++) {
    const picked = GATE_FLOWS.map((_, i) => i).filter((i) => (mask & (1 << i)) !== 0);
    const total = picked.reduce((sum, i) => sum + (GATE_FLOWS[i] ?? 0), 0);
    if (total === ENGINE_RATING && (best === null || picked.length < best.length)) best = picked;
  }
  return best ?? [];
}

function turns(type: 'turnLamp', from: number, to: number): Action[] {
  const steps = (((to - from) % GLYPH_COUNT) + GLYPH_COUNT) % GLYPH_COUNT;
  return Array.from({ length: steps }, () => ({ type, delta: 1 as const }));
}

function ringTurns(state: GameState): Action[] {
  return RING_TARGETS.flatMap((target, ring) => {
    const actions: Action[] = [];
    let rotation = state.rings[ring] ?? 0;
    while (ringGlyph(ring, rotation) !== target && actions.length < GLYPH_COUNT) {
      rotation += 1;
      actions.push({ type: 'rotateRing', ring, delta: 1 });
    }
    return actions;
  });
}

function dialTurns(state: GameState): Action[] {
  return VAULT_CODE.flatMap((glyph, index) => {
    const from = state.vaultDials[index] ?? 0;
    const steps = (((glyph - from) % GLYPH_COUNT) + GLYPH_COUNT) % GLYPH_COUNT;
    return Array.from({ length: steps }, (): Action => ({ type: 'turnVaultDial', index, delta: 1 }));
  });
}

/** Every action from a fresh game to the open vault, standing inside it. */
export function pathToVault(start: GameState): Action[] {
  return [
    { type: 'readJournal', id: 'arrival' },
    ...go('beach', 'crossroads', 'engineYard', 'engineRoom', 'enginePanel'),
    ...solveGates().map((index): Action => ({ type: 'toggleGate', index })),
    { type: 'engage' },
    { type: 'toggleTide' },
    ...go('engineRoom', 'engineYard', 'crossroads', 'lighthouseBase', 'lighthouseHall'),
    { type: 'readJournal', id: 'lamp' },
    ...go('musicBox'),
    { type: 'playMusicBox' },
    ...go('lighthouseHall', 'lighthouseBase', 'crossroads', 'garden', 'chimes'),
    ...MELODY.map((index): Action => ({ type: 'strikeChime', index })),
    { type: 'takeLens' },
    ...go('garden', 'crossroads', 'lighthouseBase', 'lighthouseHall', 'lampRoom'),
    { type: 'fitLens' },
    ...turns('turnLamp', start.lampDir, LAMP_TO_DOME),
    ...go('lighthouseHall', 'lighthouseBase', 'cove', 'observatoryYard', 'observatory'),
    { type: 'readJournal', id: 'stars' },
    ...go('starDial'),
    ...ringTurns(start),
    ...go('observatory', 'observatoryYard', 'cove', 'vaultDoor'),
    ...dialTurns(start),
    { type: 'openVault' },
    ...go('vault'),
    { type: 'readJournal', id: 'bell' }
  ];
}

/** From inside the vault to the hidden ending in the grotto. */
export function pathToGrotto(): Action[] {
  return [
    { type: 'takeFork' },
    ...go('vaultDoor', 'cove', 'lighthouseBase', 'lighthouseHall', 'lampRoom'),
    ...turns('turnLamp', LAMP_TO_DOME, LAMP_TO_STACK + GLYPH_COUNT),
    ...go('lighthouseHall', 'lighthouseBase', 'crossroads', 'garden', 'gardenShore', 'stackLanding', 'grotto'),
    { type: 'readJournal', id: 'heart' },
    { type: 'placeFork' }
  ];
}
