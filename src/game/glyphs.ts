/**
 * Original island glyphs as SVG path data in a 100 x 100 box.
 * Stroke only, so the same data feeds canvas textures and DOM journals.
 */
export const GLYPH_PATHS: readonly string[] = [
  // sun
  'M50 32 a18 18 0 1 0 0.01 0 Z M50 8 V22 M50 78 V92 M8 50 H22 M78 50 H92 M20 20 L30 30 M70 70 L80 80 M80 20 L70 30 M30 70 L20 80',
  // wave
  'M10 40 q10 -18 20 0 t20 0 t20 0 t20 0 M10 64 q10 -18 20 0 t20 0 t20 0 t20 0',
  // eye
  'M10 50 Q50 12 90 50 Q50 88 10 50 Z M50 38 a12 12 0 1 0 0.01 0 Z',
  // key
  'M50 12 a14 14 0 1 0 0.01 0 Z M50 40 V90 M50 72 H68 M50 86 H64',
  // anchor
  'M50 14 a7 7 0 1 0 0.01 0 Z M50 28 V88 M32 42 H68 M18 62 Q22 88 50 88 Q78 88 82 62',
  // spiral
  'M50 44 a6 6 0 0 1 6 6 a12 12 0 0 1 -12 12 a18 18 0 0 1 -18 -18 a24 24 0 0 1 24 -24 a30 30 0 0 1 30 30 a36 36 0 0 1 -36 36',
  // moon
  'M62 14 A38 38 0 1 0 62 86 A30 30 0 1 1 62 14 Z',
  // tower
  'M38 88 L44 30 H56 L62 88 Z M40 30 H60 V18 H40 Z M50 18 V8 M28 22 L16 16 M72 22 L84 16'
];

/** Inline SVG markup for a glyph, sized in CSS pixels. */
export function glyphSvg(id: number, size = 40): string {
  const path = GLYPH_PATHS[id] ?? '';
  return (
    `<svg class="glyph" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">` +
    `<path d="${path}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  );
}
