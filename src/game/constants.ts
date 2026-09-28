export const GAME_TITLE = 'Hollowtide';
export const SAVE_KEY = 'hollowtide-save-v1';
export const STATE_VERSION = 1;

/** Flow each tide gate adds to the engine, in marks. */
export const GATE_FLOWS = [3, 5, 8, 13, 17, 22] as const;
export const ENGINE_RATING = 30;
export const GAUGE_MAX = 70;

/** Compass headings the lamp can face, clockwise from north. */
export const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export const LAMP_START = 2;
export const LAMP_TO_DOME = 7;
export const LAMP_TO_STACK = 6;

/** Chime index 0 is the longest chime and the lowest voice. */
export const CHIME_COUNT = 5;
export const CHIME_FREQS = [293.66, 349.23, 392.0, 440.0, 523.25] as const;
export const MELODY = [2, 4, 1, 3, 0, 2] as const;
/** Seconds between notes when the music box plays. */
export const MELODY_BEAT = 0.55;

export const GLYPH = {
  sun: 0,
  wave: 1,
  eye: 2,
  key: 3,
  anchor: 4,
  spiral: 5,
  moon: 6,
  tower: 7
} as const;
export const GLYPH_COUNT = 8;
export const GLYPH_NAMES = ['Sun', 'Wave', 'Eye', 'Key', 'Anchor', 'Spiral', 'Moon', 'Tower'] as const;

/** Marks of the three works: over the engine house door, over the tower door, and on the chimes' plinth. */
export const SIGN_ENGINE = GLYPH.wave;
export const SIGN_TOWER = GLYPH.eye;
export const SIGN_CHIMES = GLYPH.spiral;

/** Glyph order around each star dial ring: outer, middle, inner. */
export const RING_ORDERS = [
  [0, 3, 6, 1, 4, 7, 2, 5],
  [4, 5, 0, 7, 3, 2, 1, 6],
  [6, 2, 7, 3, 1, 0, 5, 4]
] as const;
export const RING_TARGETS = [SIGN_ENGINE, SIGN_TOWER, SIGN_CHIMES] as const;

export const VAULT_CODE = [GLYPH.moon, GLYPH.key, GLYPH.anchor, GLYPH.sun] as const;
export const VAULT_DIALS_START = [2, 5, 1, 7] as const;

export const JOURNAL_TOTAL = 5;
export const ENDING_TOTAL = 2;
