import type { AreaId, GameState, NodeId, Requirement } from './types.ts';

export type LinkKind = 'walk' | 'door' | 'stairs' | 'look' | 'back';

export interface LinkDef {
  to: NodeId;
  kind: LinkKind;
  label: string;
  requires?: Requirement;
  blocked?: string;
}

export interface NodeDef {
  id: NodeId;
  area: AreaId;
  title: string;
  closeUp: boolean;
  links: LinkDef[];
}

function node(id: NodeId, area: AreaId, title: string, links: LinkDef[], closeUp = false): NodeDef {
  return { id, area, title, closeUp, links };
}

function walk(to: NodeId, label: string): LinkDef {
  return { to, kind: 'walk', label };
}

function back(to: NodeId): LinkDef {
  return { to, kind: 'back', label: 'Step Back' };
}

const NODE_LIST: NodeDef[] = [
  node('dock', 'island', 'The Dock', [walk('beach', 'To The Beach')]),
  node('beach', 'island', 'The Beach', [walk('dock', 'To The Dock'), walk('crossroads', 'To The Crossroads')]),
  node('crossroads', 'island', 'The Crossroads', [
    walk('beach', 'To The Beach'),
    walk('engineYard', 'To The Engine House'),
    walk('lighthouseBase', 'To The Tower'),
    walk('garden', 'To The Garden'),
    walk('observatoryYard', 'To The Hill')
  ]),
  node('engineYard', 'island', 'The Engine House', [
    walk('crossroads', 'To The Crossroads'),
    { to: 'engineRoom', kind: 'door', label: 'Enter The Engine House' }
  ]),
  node('engineRoom', 'engineRoom', 'The Engine Room', [
    { to: 'engineYard', kind: 'door', label: 'Leave' },
    { to: 'enginePanel', kind: 'look', label: 'Control Panel' }
  ]),
  node('enginePanel', 'engineRoom', 'The Control Panel', [back('engineRoom')], true),
  node('lighthouseBase', 'island', 'The Tower', [
    walk('crossroads', 'To The Crossroads'),
    walk('cove', 'To The Cove'),
    {
      to: 'lighthouseHall',
      kind: 'door',
      label: 'Enter The Tower',
      requires: 'power',
      blocked: 'The door is held shut by a dead electric latch.'
    }
  ]),
  node('lighthouseHall', 'lighthouseHall', 'The Tower Hall', [
    { to: 'lighthouseBase', kind: 'door', label: 'Leave' },
    { to: 'musicBox', kind: 'look', label: 'Music Box' },
    { to: 'lampRoom', kind: 'stairs', label: 'Climb To The Lamp' }
  ]),
  node('musicBox', 'lighthouseHall', 'The Music Box', [back('lighthouseHall')], true),
  node('lampRoom', 'island', 'The Lamp Room', [{ to: 'lighthouseHall', kind: 'stairs', label: 'Descend' }]),
  node('garden', 'island', 'The Garden Of Stones', [
    walk('crossroads', 'To The Crossroads'),
    walk('observatoryYard', 'To The Hill'),
    walk('gardenShore', 'To The Stack Shore'),
    { to: 'chimes', kind: 'look', label: 'The Chimes' }
  ]),
  node('chimes', 'island', 'The Chimes', [back('garden')], true),
  node('gardenShore', 'island', 'The Stack Shore', [
    walk('garden', 'To The Garden'),
    {
      to: 'stackLanding',
      kind: 'walk',
      label: 'Cross To The Stack',
      requires: 'lowTide',
      blocked: 'Dark water rolls between the shore and the stack.'
    }
  ]),
  node('stackLanding', 'island', 'The Stack', [
    walk('gardenShore', 'Back To Shore'),
    {
      to: 'grotto',
      kind: 'door',
      label: 'Enter The Stack',
      requires: 'grottoRevealed',
      blocked: 'A stone eye is carved in the rock. It is shut.'
    }
  ]),
  node('grotto', 'grotto', 'The Grotto', [{ to: 'stackLanding', kind: 'door', label: 'Leave' }]),
  node('observatoryYard', 'island', 'The Hill', [
    walk('crossroads', 'To The Crossroads'),
    walk('garden', 'To The Garden'),
    walk('cove', 'To The Cove'),
    { to: 'observatory', kind: 'door', label: 'Enter The Dome' }
  ]),
  node('observatory', 'observatory', 'The Dome', [
    { to: 'observatoryYard', kind: 'door', label: 'Leave' },
    { to: 'starDial', kind: 'look', label: 'Star Dial' }
  ]),
  node('starDial', 'observatory', 'The Star Dial', [back('observatory')], true),
  node('cove', 'island', 'The North Cove', [
    walk('lighthouseBase', 'To The Tower'),
    walk('observatoryYard', 'To The Hill'),
    {
      to: 'vaultDoor',
      kind: 'walk',
      label: 'Cross The Causeway',
      requires: 'lowTide',
      blocked: 'The causeway lies under dark water.'
    }
  ]),
  node(
    'vaultDoor',
    'island',
    'The Vault Door',
    [
      back('cove'),
      {
        to: 'vault',
        kind: 'door',
        label: 'Enter The Vault',
        requires: 'vaultOpen',
        blocked: 'The vault is sealed.'
      }
    ],
    true
  ),
  node('vault', 'vault', 'The Vault', [{ to: 'vaultDoor', kind: 'door', label: 'Leave' }])
];

export const NODES: Readonly<Record<NodeId, NodeDef>> = Object.fromEntries(
  NODE_LIST.map((def) => [def.id, def])
) as Record<NodeId, NodeDef>;

export const NODE_IDS: readonly NodeId[] = NODE_LIST.map((def) => def.id);
export const START_NODE: NodeId = 'dock';

/** True when the state satisfies a link requirement. */
export function meets(state: GameState, requirement: Requirement | undefined): boolean {
  switch (requirement) {
    case undefined:
      return true;
    case 'power':
      return state.powered;
    case 'lowTide':
      return state.tide === 'low';
    case 'vaultOpen':
      return state.vaultOpen;
    case 'grottoRevealed':
      return state.grottoRevealed;
  }
}

/** Find the link from one node to another, if the graph has one. */
export function findLink(from: NodeId, to: NodeId): LinkDef | undefined {
  return NODES[from].links.find((link) => link.to === to);
}

/** The link a step back should follow: an explicit back link, else a lone exit. */
export function backLink(from: NodeId): LinkDef | undefined {
  const links = NODES[from].links;
  return links.find((link) => link.kind === 'back') ?? (links.length === 1 ? links[0] : undefined);
}
