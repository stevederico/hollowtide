import {
  CHIME_COUNT,
  ENGINE_RATING,
  GATE_FLOWS,
  GLYPH_COUNT,
  LAMP_START,
  LAMP_TO_DOME,
  LAMP_TO_STACK,
  RING_ORDERS,
  RING_TARGETS,
  STATE_VERSION,
  VAULT_CODE,
  VAULT_DIALS_START
} from './constants.ts';
import { JOURNAL_ORDER } from './journals.ts';
import { NODE_IDS, START_NODE } from './nodes.ts';
import type { EndingId, GameState, ItemId, JournalId, NodeId } from './types.ts';

/** A fresh game: fog, high water, no power. */
export function createInitialState(): GameState {
  return {
    version: STATE_VERSION,
    node: START_NODE,
    gates: GATE_FLOWS.map(() => false),
    breakerTripped: false,
    powered: false,
    tide: 'high',
    lampDir: LAMP_START,
    lensFitted: false,
    chimeNotes: [],
    chimesSolved: false,
    rings: [0, 0, 0],
    vaultDials: [...VAULT_DIALS_START],
    vaultOpen: false,
    forkPlaced: false,
    grottoRevealed: false,
    inventory: [],
    itemsTaken: [],
    journals: [],
    steps: 0,
    elapsedMs: 0,
    ending: null,
    endingsFound: []
  };
}

/** Total flow through the open gates, in marks. */
export function gateFlow(state: GameState): number {
  return state.gates.reduce((sum, open, index) => sum + (open ? (GATE_FLOWS[index] ?? 0) : 0), 0);
}

/** Glyph under the pointer for a ring at a given rotation. */
export function ringGlyph(ring: number, rotation: number): number {
  const order = RING_ORDERS[ring];
  if (!order) return -1;
  return order[((rotation % GLYPH_COUNT) + GLYPH_COUNT) % GLYPH_COUNT] ?? -1;
}

export function ringsAligned(state: GameState): boolean {
  return RING_TARGETS.every((target, ring) => ringGlyph(ring, state.rings[ring] ?? 0) === target);
}

/** The lamp only throws a focused beam with power and the lens seated. */
export function isBeamFocused(state: GameState): boolean {
  return state.powered && state.lensFitted;
}

export function isDomeLit(state: GameState): boolean {
  return isBeamFocused(state) && state.lampDir === LAMP_TO_DOME;
}

export function isCodeProjected(state: GameState): boolean {
  return isDomeLit(state) && ringsAligned(state);
}

export function isStackLit(state: GameState): boolean {
  return isBeamFocused(state) && state.lampDir === LAMP_TO_STACK && state.tide === 'low';
}

export function vaultCodeSet(state: GameState): boolean {
  return VAULT_CODE.every((glyph, index) => state.vaultDials[index] === glyph);
}

export function hasItem(state: GameState, item: ItemId): boolean {
  return state.inventory.includes(item);
}

const ITEMS: readonly ItemId[] = ['lens', 'fork'];
const ENDINGS: readonly EndingId[] = ['ferry', 'keeper'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIntIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isListOf<T>(value: unknown, length: number | null, check: (item: unknown) => item is T): value is T[] {
  if (!Array.isArray(value)) return false;
  if (length !== null && value.length !== length) return false;
  return value.every(check);
}

function isMember<T extends string>(list: readonly T[]): (value: unknown) => value is T {
  return (value: unknown): value is T => typeof value === 'string' && list.some((entry) => entry === value);
}

const isBool = (value: unknown): value is boolean => typeof value === 'boolean';
const isGlyph = (value: unknown): value is number => isIntIn(value, 0, GLYPH_COUNT - 1);
const isChime = (value: unknown): value is number => isIntIn(value, 0, CHIME_COUNT - 1);
const isNode = isMember<NodeId>(NODE_IDS);
const isItem = isMember<ItemId>(ITEMS);
const isJournal = isMember<JournalId>(JOURNAL_ORDER);
const isEnding = isMember<EndingId>(ENDINGS);

/** Serialize a state for localStorage. */
export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** Parse and validate a saved state. Returns null for anything malformed or stale. */
export function deserialize(raw: string | null): GameState | null {
  if (!raw) return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || data.version !== STATE_VERSION) return null;
  const tide = data.tide;
  const ending = data.ending;
  if (tide !== 'high' && tide !== 'low') return null;
  if (ending !== null && !isEnding(ending)) return null;
  if (
    !isNode(data.node) ||
    !isListOf(data.gates, GATE_FLOWS.length, isBool) ||
    !isBool(data.breakerTripped) ||
    !isBool(data.powered) ||
    !isGlyph(data.lampDir) ||
    !isBool(data.lensFitted) ||
    !isListOf(data.chimeNotes, null, isChime) ||
    !isBool(data.chimesSolved) ||
    !isListOf(data.rings, 3, isGlyph) ||
    !isListOf(data.vaultDials, VAULT_CODE.length, isGlyph) ||
    !isBool(data.vaultOpen) ||
    !isBool(data.forkPlaced) ||
    !isBool(data.grottoRevealed) ||
    !isListOf(data.inventory, null, isItem) ||
    !isListOf(data.itemsTaken, null, isItem) ||
    !isListOf(data.journals, null, isJournal) ||
    !isIntIn(data.steps, 0, Number.MAX_SAFE_INTEGER) ||
    typeof data.elapsedMs !== 'number' ||
    !Number.isFinite(data.elapsedMs) ||
    !isListOf(data.endingsFound, null, isEnding)
  ) {
    return null;
  }
  return {
    version: STATE_VERSION,
    node: data.node,
    gates: data.gates,
    breakerTripped: data.breakerTripped,
    powered: data.powered,
    tide,
    lampDir: data.lampDir,
    lensFitted: data.lensFitted,
    chimeNotes: data.chimeNotes,
    chimesSolved: data.chimesSolved,
    rings: data.rings,
    vaultDials: data.vaultDials,
    vaultOpen: data.vaultOpen,
    forkPlaced: data.forkPlaced,
    grottoRevealed: data.grottoRevealed,
    inventory: data.inventory,
    itemsTaken: data.itemsTaken,
    journals: data.journals,
    steps: data.steps,
    elapsedMs: Math.max(0, data.elapsedMs),
    ending,
    endingsFound: data.endingsFound
  };
}

/** Flow still needed to reach the engine rating. Negative means over. */
export function flowShortfall(state: GameState): number {
  return ENGINE_RATING - gateFlow(state);
}
