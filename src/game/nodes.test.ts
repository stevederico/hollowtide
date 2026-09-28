import { describe, expect, it } from 'vitest';
import { backLink, findLink, meets, NODE_IDS, NODES, START_NODE } from './nodes.ts';
import { createInitialState } from './state.ts';
import type { NodeId } from './types.ts';

function reachable(from: NodeId): Set<NodeId> {
  const seen = new Set<NodeId>([from]);
  const queue: NodeId[] = [from];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    NODES[current].links.forEach((link) => {
      if (!seen.has(link.to)) {
        seen.add(link.to);
        queue.push(link.to);
      }
    });
  }
  return seen;
}

describe('node graph', () => {
  it('links only to nodes that exist', () => {
    const targets = NODE_IDS.flatMap((id) => NODES[id].links.map((link) => link.to));
    expect(targets.every((to) => NODE_IDS.includes(to))).toBe(true);
  });

  it('reaches every node from the dock', () => {
    expect(reachable(START_NODE).size).toBe(NODE_IDS.length);
  });

  it('can return to the dock from every node', () => {
    const stuck = NODE_IDS.filter((id) => !reachable(id).has(START_NODE));
    expect(stuck).toEqual([]);
  });

  it('pairs every link with a way back', () => {
    const oneWay = NODE_IDS.flatMap((id) =>
      NODES[id].links.filter((link) => !findLink(link.to, id)).map((link) => `${id}>${link.to}`)
    );
    expect(oneWay).toEqual([]);
  });

  it('explains every gated link', () => {
    const silent = NODE_IDS.flatMap((id) => NODES[id].links.filter((link) => link.requires && !link.blocked));
    expect(silent).toEqual([]);
  });

  it('gives every close up a step back', () => {
    const closeUps = NODE_IDS.filter((id) => NODES[id].closeUp);
    expect(closeUps.every((id) => backLink(id)?.kind === 'back')).toBe(true);
  });
});

describe('meets', () => {
  it('passes a link with no requirement', () => {
    expect(meets(createInitialState(), undefined)).toBe(true);
  });

  it('checks power', () => {
    expect(meets(createInitialState(), 'power')).toBe(false);
    expect(meets({ ...createInitialState(), powered: true }, 'power')).toBe(true);
  });

  it('checks the tide', () => {
    expect(meets({ ...createInitialState(), tide: 'low' }, 'lowTide')).toBe(true);
  });

  it('checks the vault and the grotto', () => {
    expect(meets({ ...createInitialState(), vaultOpen: true }, 'vaultOpen')).toBe(true);
    expect(meets({ ...createInitialState(), grottoRevealed: true }, 'grottoRevealed')).toBe(true);
  });
});

describe('backLink', () => {
  it('uses the lone exit of a dead end', () => {
    expect(backLink('dock')?.to).toBe('beach');
  });

  it('has no default at a junction', () => {
    expect(backLink('crossroads')).toBeUndefined();
  });
});
