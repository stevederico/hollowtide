export type NodeId =
  | 'dock'
  | 'beach'
  | 'crossroads'
  | 'engineYard'
  | 'engineRoom'
  | 'enginePanel'
  | 'lighthouseBase'
  | 'lighthouseHall'
  | 'musicBox'
  | 'lampRoom'
  | 'garden'
  | 'chimes'
  | 'gardenShore'
  | 'stackLanding'
  | 'grotto'
  | 'observatoryYard'
  | 'observatory'
  | 'starDial'
  | 'cove'
  | 'vaultDoor'
  | 'vault';

export type AreaId =
  | 'island'
  | 'engineRoom'
  | 'lighthouseHall'
  | 'observatory'
  | 'vault'
  | 'grotto';

export type ItemId = 'lens' | 'fork';
export type JournalId = 'arrival' | 'lamp' | 'stars' | 'bell' | 'heart';
export type Tide = 'high' | 'low';
export type EndingId = 'ferry' | 'keeper';
export type Requirement = 'power' | 'lowTide' | 'vaultOpen' | 'grottoRevealed';

export interface GameState {
  version: number;
  node: NodeId;
  gates: boolean[];
  breakerTripped: boolean;
  powered: boolean;
  tide: Tide;
  lampDir: number;
  lensFitted: boolean;
  chimeNotes: number[];
  chimesSolved: boolean;
  rings: number[];
  vaultDials: number[];
  vaultOpen: boolean;
  forkPlaced: boolean;
  grottoRevealed: boolean;
  inventory: ItemId[];
  itemsTaken: ItemId[];
  journals: JournalId[];
  steps: number;
  elapsedMs: number;
  ending: EndingId | null;
  endingsFound: EndingId[];
}

export type Action =
  | { type: 'move'; to: NodeId }
  | { type: 'toggleGate'; index: number }
  | { type: 'engage' }
  | { type: 'resetBreaker' }
  | { type: 'toggleTide' }
  | { type: 'turnLamp'; delta: 1 | -1 }
  | { type: 'fitLens' }
  | { type: 'playMusicBox' }
  | { type: 'strikeChime'; index: number }
  | { type: 'takeLens' }
  | { type: 'rotateRing'; ring: number; delta: 1 | -1 }
  | { type: 'turnVaultDial'; index: number; delta: 1 | -1 }
  | { type: 'openVault' }
  | { type: 'takeFork' }
  | { type: 'placeFork' }
  | { type: 'ringBell' }
  | { type: 'readJournal'; id: JournalId }
  | { type: 'examine'; text: string }
  | { type: 'keepExploring' }
  | { type: 'tick'; ms: number };

export type SfxName =
  | 'step'
  | 'door'
  | 'stairs'
  | 'lever'
  | 'click'
  | 'deny'
  | 'stall'
  | 'breaker'
  | 'powerOn'
  | 'tide'
  | 'wheel'
  | 'lens'
  | 'page'
  | 'pickup'
  | 'ring'
  | 'dial'
  | 'solve'
  | 'vaultOpen'
  | 'reveal'
  | 'bell'
  | 'heart';

export type GameEvent =
  | { type: 'message'; text: string }
  | { type: 'sfx'; name: SfxName }
  | { type: 'moved'; from: NodeId; to: NodeId }
  | { type: 'chime'; index: number }
  | { type: 'melody' }
  | { type: 'journal'; id: JournalId; isNew: boolean }
  | { type: 'ending'; id: EndingId };

export interface Result {
  state: GameState;
  events: GameEvent[];
}
