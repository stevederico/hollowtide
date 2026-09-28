import { CHIME_COUNT, COMPASS, ENGINE_RATING, GLYPH_COUNT, MELODY } from './constants.ts';
import { findLink, meets } from './nodes.ts';
import {
  gateFlow,
  hasItem,
  isCodeProjected,
  isDomeLit,
  isStackLit,
  vaultCodeSet
} from './state.ts';
import type { Action, GameEvent, GameState, JournalId, NodeId, Result, SfxName } from './types.ts';

const JOURNAL_NODES: Readonly<Record<JournalId, NodeId>> = {
  arrival: 'dock',
  lamp: 'lighthouseHall',
  stars: 'observatory',
  bell: 'vault',
  heart: 'grotto'
};

const MOVE_SFX: Readonly<Record<string, SfxName>> = {
  walk: 'step',
  door: 'door',
  stairs: 'stairs',
  look: 'click',
  back: 'click'
};

function say(text: string): GameEvent {
  return { type: 'message', text };
}

function sfx(name: SfxName): GameEvent {
  return { type: 'sfx', name };
}

function unchanged(state: GameState, ...events: GameEvent[]): Result {
  return { state, events };
}

function wrap(value: number, delta: number, size: number): number {
  return (((value + delta) % size) + size) % size;
}

function move(state: GameState, to: NodeId): Result {
  const link = findLink(state.node, to);
  if (!link) return unchanged(state);
  if (!meets(state, link.requires)) {
    return unchanged(state, sfx('deny'), say(link.blocked ?? 'The way is shut.'));
  }
  const next = { ...state, node: to, steps: state.steps + 1 };
  return { state: next, events: [sfx(MOVE_SFX[link.kind] ?? 'step'), { type: 'moved', from: state.node, to }] };
}

function toggleGate(state: GameState, index: number): Result {
  if (index < 0 || index >= state.gates.length) return unchanged(state);
  if (state.powered) return unchanged(state, sfx('deny'), say('The gates are locked while the engine runs.'));
  if (state.breakerTripped) return unchanged(state, sfx('deny'), say('The breaker has thrown. Reset it first.'));
  const gates = state.gates.map((open, i) => (i === index ? !open : open));
  return { state: { ...state, gates }, events: [sfx('lever')] };
}

function engage(state: GameState): Result {
  if (state.powered) return unchanged(state, say('The engine is already running.'));
  if (state.breakerTripped) return unchanged(state, sfx('deny'), say('The breaker has thrown. Reset it first.'));
  const flow = gateFlow(state);
  if (flow === 0) return unchanged(state, sfx('deny'), say('Nothing happens. No water is reaching the engine.'));
  if (flow < ENGINE_RATING) {
    return unchanged(state, sfx('stall'), say('The engine turns over, coughs, and stalls. It wants more flow.'));
  }
  if (flow > ENGINE_RATING) {
    const tripped = { ...state, breakerTripped: true, gates: state.gates.map(() => false) };
    return { state: tripped, events: [sfx('breaker'), say('Too much flow. The breaker throws and the gates slam shut.')] };
  }
  return {
    state: { ...state, powered: true },
    events: [sfx('powerOn'), say('The engine catches. Across the island, lamps flicker to life.')]
  };
}

function resetBreaker(state: GameState): Result {
  if (!state.breakerTripped) return unchanged(state, sfx('click'), say('The breaker is already set.'));
  return { state: { ...state, breakerTripped: false }, events: [sfx('click'), say('The breaker resets with a snap.')] };
}

function toggleTide(state: GameState): Result {
  if (!state.powered) return unchanged(state, sfx('deny'), say('The tide lever is dead without power.'));
  const tide = state.tide === 'high' ? 'low' : 'high';
  const text = tide === 'low' ? 'Somewhere below, sluices open. The water draws back.' : 'The sluices close. The water climbs again.';
  return { state: { ...state, tide }, events: [sfx('lever'), sfx('tide'), say(text)] };
}

function turnLamp(state: GameState, delta: 1 | -1): Result {
  if (!state.powered) return unchanged(state, sfx('deny'), say('The wheel is dead without power.'));
  const lampDir = wrap(state.lampDir, delta, COMPASS.length);
  return { state: { ...state, lampDir }, events: [sfx('wheel')] };
}

function fitLens(state: GameState): Result {
  if (state.lensFitted) return unchanged(state, say('The lens is seated in the lamp.'));
  if (!hasItem(state, 'lens')) return unchanged(state, sfx('deny'), say('An empty cradle. The lamp is missing its lens.'));
  const inventory = state.inventory.filter((item) => item !== 'lens');
  return {
    state: { ...state, lensFitted: true, inventory },
    events: [sfx('lens'), say('The lens settles into its cradle. The beam draws tight.')]
  };
}

function strikeChime(state: GameState, index: number): Result {
  if (index < 0 || index >= CHIME_COUNT) return unchanged(state);
  const events: GameEvent[] = [{ type: 'chime', index }];
  if (state.chimesSolved) return unchanged(state, ...events);
  const chimeNotes = [...state.chimeNotes, index].slice(-MELODY.length);
  const solved = chimeNotes.length === MELODY.length && MELODY.every((note, i) => chimeNotes[i] === note);
  if (solved) {
    events.push(sfx('solve'), say('The chimes answer. The plinth grinds open.'));
  }
  return { state: { ...state, chimeNotes, chimesSolved: solved }, events };
}

function takeLens(state: GameState): Result {
  if (!state.chimesSolved) return unchanged(state, say('A stone plinth, carved with a spiral. It is sealed.'));
  if (state.itemsTaken.includes('lens')) return unchanged(state, say('The plinth is empty.'));
  return {
    state: { ...state, inventory: [...state.inventory, 'lens'], itemsTaken: [...state.itemsTaken, 'lens'] },
    events: [sfx('pickup'), say('You take the lens. It is heavy, and cold as seawater.')]
  };
}

function rotateRing(state: GameState, ring: number, delta: 1 | -1): Result {
  if (ring < 0 || ring >= state.rings.length) return unchanged(state);
  const rings = state.rings.map((rotation, i) => (i === ring ? wrap(rotation, delta, GLYPH_COUNT) : rotation));
  return { state: { ...state, rings }, events: [sfx('ring')] };
}

function turnVaultDial(state: GameState, index: number, delta: 1 | -1): Result {
  if (index < 0 || index >= state.vaultDials.length) return unchanged(state);
  if (state.vaultOpen) return unchanged(state);
  const vaultDials = state.vaultDials.map((glyph, i) => (i === index ? wrap(glyph, delta, GLYPH_COUNT) : glyph));
  return { state: { ...state, vaultDials }, events: [sfx('dial')] };
}

function openVault(state: GameState): Result {
  if (state.vaultOpen) return unchanged(state, say('The vault stands open.'));
  if (!vaultCodeSet(state)) return unchanged(state, sfx('deny'), say('The wheel will not turn. The signs are wrong.'));
  return {
    state: { ...state, vaultOpen: true },
    events: [sfx('vaultOpen'), say('The wheel spins free. The great door rolls aside.')]
  };
}

function takeFork(state: GameState): Result {
  if (state.itemsTaken.includes('fork')) return unchanged(state, say('An empty stand.'));
  return {
    state: { ...state, inventory: [...state.inventory, 'fork'], itemsTaken: [...state.itemsTaken, 'fork'] },
    events: [sfx('pickup'), say('You take the fork. It hums faintly against your palm.')]
  };
}

function finish(state: GameState, id: 'ferry' | 'keeper', extra: Partial<GameState>, sound: SfxName): Result {
  const endingsFound = state.endingsFound.includes(id) ? state.endingsFound : [...state.endingsFound, id];
  return {
    state: { ...state, ...extra, ending: id, endingsFound },
    events: [sfx(sound), { type: 'ending', id }]
  };
}

function ringBell(state: GameState): Result {
  if (state.forkPlaced) {
    return unchanged(state, say('You reach for the rope and let it fall. Hollowtide has its keeper, and the keeper stays.'));
  }
  return finish(state, 'ferry', {}, 'bell');
}

function placeFork(state: GameState): Result {
  if (state.forkPlaced) return unchanged(state, say('The fork sings in its cradle.'));
  if (!hasItem(state, 'fork')) {
    return unchanged(state, sfx('deny'), say('A cradle of two brass fingers. Something slender belongs here.'));
  }
  const inventory = state.inventory.filter((item) => item !== 'fork');
  return finish(state, 'keeper', { forkPlaced: true, inventory }, 'heart');
}

function readJournal(state: GameState, id: JournalId): Result {
  const known = state.journals.includes(id);
  if (!known && state.node !== JOURNAL_NODES[id]) return unchanged(state);
  const journals = known ? state.journals : [...state.journals, id];
  return { state: { ...state, journals }, events: [sfx('page'), { type: 'journal', id, isNew: !known }] };
}

/** Nodes where each located action is allowed. Anything else is ignored. */
function allowedAt(action: Action): readonly NodeId[] | null {
  switch (action.type) {
    case 'toggleGate':
    case 'engage':
    case 'resetBreaker':
    case 'toggleTide':
      return ['enginePanel'];
    case 'turnLamp':
    case 'fitLens':
      return ['lampRoom'];
    case 'playMusicBox':
      return ['musicBox'];
    case 'strikeChime':
      return ['chimes'];
    case 'takeLens':
      return ['chimes', 'garden'];
    case 'rotateRing':
      return ['starDial'];
    case 'turnVaultDial':
    case 'openVault':
      return ['vaultDoor'];
    case 'takeFork':
    case 'ringBell':
      return ['vault'];
    case 'placeFork':
      return ['grotto'];
    default:
      return null;
  }
}

function apply(state: GameState, action: Action): Result {
  switch (action.type) {
    case 'move':
      return move(state, action.to);
    case 'toggleGate':
      return toggleGate(state, action.index);
    case 'engage':
      return engage(state);
    case 'resetBreaker':
      return resetBreaker(state);
    case 'toggleTide':
      return toggleTide(state);
    case 'turnLamp':
      return turnLamp(state, action.delta);
    case 'fitLens':
      return fitLens(state);
    case 'playMusicBox':
      return unchanged(state, { type: 'melody' });
    case 'strikeChime':
      return strikeChime(state, action.index);
    case 'takeLens':
      return takeLens(state);
    case 'rotateRing':
      return rotateRing(state, action.ring, action.delta);
    case 'turnVaultDial':
      return turnVaultDial(state, action.index, action.delta);
    case 'openVault':
      return openVault(state);
    case 'takeFork':
      return takeFork(state);
    case 'placeFork':
      return placeFork(state);
    case 'ringBell':
      return ringBell(state);
    case 'readJournal':
      return readJournal(state, action.id);
    case 'examine':
      return unchanged(state, say(action.text));
    case 'keepExploring':
      return { state: { ...state, ending: null }, events: [] };
    case 'tick':
      return { state: { ...state, elapsedMs: state.elapsedMs + Math.max(0, action.ms) }, events: [] };
  }
}

/** Events for things that light up far away as a side effect of an action. */
function remoteEvents(before: GameState, after: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  if (!isCodeProjected(before) && isCodeProjected(after)) {
    const text =
      after.node === 'starDial' || after.node === 'observatory'
        ? 'The rings lock. Four signs of light bloom on the wall of the dome.'
        : 'On the hill, the dome drinks the beam. Something inside has woken.';
    events.push(sfx('solve'), say(text));
  } else if (!isDomeLit(before) && isDomeLit(after)) {
    events.push(say('The beam strikes the dome on the hill, and the dome begins to glow.'));
  }
  return events;
}

/**
 * The whole game in one pure function: state and action in, state and events out.
 * While an ending is showing, only keepExploring is accepted.
 */
export function dispatch(state: GameState, action: Action): Result {
  if (state.ending !== null && action.type !== 'keepExploring') return unchanged(state);
  const nodes = allowedAt(action);
  if (nodes && !nodes.includes(state.node)) return unchanged(state);

  const result = apply(state, action);
  if (result.state === state) return result;

  const events = [...result.events, ...remoteEvents(state, result.state)];
  let next = result.state;
  if (!next.grottoRevealed && isStackLit(next)) {
    next = { ...next, grottoRevealed: true };
    events.push(sfx('reveal'), say('Far to the west, something in the sea answers the light.'));
  }
  return { state: next, events };
}
