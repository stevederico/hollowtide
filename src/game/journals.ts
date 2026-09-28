import type { JournalId } from './types.ts';

export interface JournalPage {
  text: string[];
  glyphs?: number[];
  caption?: string;
}

export interface Journal {
  id: JournalId;
  title: string;
  found: string;
  pages: JournalPage[];
}

export const JOURNAL_ORDER: readonly JournalId[] = ['arrival', 'lamp', 'stars', 'bell', 'heart'];

export const JOURNALS: Readonly<Record<JournalId, Journal>> = {
  arrival: {
    id: 'arrival',
    title: 'A Note On The Dock',
    found: 'Found on the dock',
    pages: [
      {
        text: [
          'To whoever the fog delivers,',
          'The ferry does not come to Hollowtide unless it is called, and nothing here calls without power.',
          'Start the tide engine. Her house stands west of the crossroads, where the signpost says ENGINE. She is rated for thirty marks of flow. Give her less and she stalls. Give her more and the breaker throws.'
        ]
      },
      {
        text: [
          'Six gates feed her, and no two are alike. Watch the gauge, then throw the main switch.',
          'Once the lamps are lit, the tower door will open to you.',
          'O. Vale, Keeper'
        ]
      }
    ]
  },
  lamp: {
    id: 'lamp',
    title: 'The Lamp',
    found: 'Found in the tower hall',
    pages: [
      {
        text: [
          'The lamp is the eye of the island, and it has gone blind.',
          'I hid its lens where only a song can fetch it: in the stone plinth beside the chimes, in the garden. My mother\'s music box remembers the tune, even when I do not.',
          'The longest chime has the lowest voice.'
        ]
      },
      {
        text: [
          'With the lens seated, turn the lamp upon the dome on the hill. The star engine drinks light, and will do nothing in the dark.',
          'The engine house and the tower each wear a mark above the door. The chimes keep theirs on the plinth that hides the lens. I never told anyone why.'
        ]
      }
    ]
  },
  stars: {
    id: 'stars',
    title: 'The Star Engine',
    found: 'Found in the dome',
    pages: [
      {
        text: [
          'Three rings, three marks. Bring each mark beneath the pointer.',
          'Outer ring: the mark of the engine house.',
          'Middle ring: the mark of the tower.',
          'Inner ring: the mark of the chimes.'
        ]
      },
      {
        text: [
          'When the rings agree and the lamp feeds the dome, the wall shows the four signs that open the vault. Read them left to right.',
          'The vault lies across the north cove. The causeway only shows itself at low water. The tide lever is on the engine panel.'
        ]
      }
    ]
  },
  bell: {
    id: 'bell',
    title: 'The Fog Bell',
    found: 'Found in the vault',
    pages: [
      {
        text: [
          'Here is the fog bell. Ring it and the mist will lift, and the ferry will answer. That is the way home, and there is no shame in it.',
          'But the fork on the stand is not for the bell.'
        ]
      },
      {
        text: [
          'The fork belongs to the stack that stands in the sea to the west. The stack sleeps until the lamp looks due west at low water, with the lens in place. Then it opens its eye.',
          'I am going there now. I do not think I will come back this way.'
        ]
      }
    ]
  },
  heart: {
    id: 'heart',
    title: 'The Heart',
    found: 'Found in the grotto',
    pages: [
      {
        text: [
          'The tide does not move the island. The island moves the tide. Under this stack is the heart that does it, and it has been winding down for a hundred years.',
          'Set the fork in the cradle and the heart will take a new keeper.'
        ]
      },
      {
        text: [
          'It took me once. I am tired, and I have let it go.',
          'If you place the fork, you will not need the ferry.',
          'O. Vale'
        ]
      }
    ]
  }
};

