import * as THREE from 'three';
import { CHIME_COUNT, COMPASS, ENGINE_RATING, GAUGE_MAX, MELODY } from '../game/constants.ts';
import { GLYPH_PATHS } from '../game/glyphs.ts';
import { mulberry32 } from './noise.ts';

type Draw = (ctx: CanvasRenderingContext2D, size: number) => void;

function makeCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  return [canvas, ctx];
}

function toTexture(canvas: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  return texture;
}

function square(size: number, draw: Draw, repeat = false): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size, size);
  draw(ctx, size);
  return toTexture(canvas, repeat);
}

function speckle(ctx: CanvasRenderingContext2D, size: number, seed: number, count: number, alpha: number): void {
  const rand = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    const shade = rand() < 0.5 ? 0 : 255;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${rand() * alpha})`;
    const r = 0.5 + rand() * 2.5;
    ctx.fillRect(rand() * size, rand() * size, r, r);
  }
}

/** Fine grain to break up flat vertex colours on the ground. */
export function groundDetail(): THREE.CanvasTexture {
  return square(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#c9c9c9';
      ctx.fillRect(0, 0, size, size);
      speckle(ctx, size, 11, 5000, 0.16);
    },
    true
  );
}

export function stoneBlocks(): THREE.CanvasTexture {
  return square(
    512,
    (ctx, size) => {
      const rand = mulberry32(21);
      ctx.fillStyle = '#3f4143';
      ctx.fillRect(0, 0, size, size);
      const rows = 8;
      const rowH = size / rows;
      for (let row = 0; row < rows; row++) {
        const cols = 4;
        const colW = size / cols;
        const shift = row % 2 === 0 ? 0 : colW / 2;
        for (let col = -1; col < cols; col++) {
          const tone = 92 + Math.floor(rand() * 46);
          ctx.fillStyle = `rgb(${tone},${tone + 2},${tone + 6})`;
          ctx.fillRect(col * colW + shift + 3, row * rowH + 3, colW - 6, rowH - 6);
        }
      }
      speckle(ctx, size, 22, 9000, 0.2);
    },
    true
  );
}

export function planks(): THREE.CanvasTexture {
  return square(
    512,
    (ctx, size) => {
      const rand = mulberry32(31);
      const count = 6;
      const w = size / count;
      for (let i = 0; i < count; i++) {
        const tone = 70 + Math.floor(rand() * 30);
        ctx.fillStyle = `rgb(${tone + 22},${tone + 6},${tone - 14})`;
        ctx.fillRect(i * w, 0, w, size);
        ctx.strokeStyle = 'rgba(0,0,0,0.22)';
        for (let g = 0; g < 9; g++) {
          const x = i * w + rand() * w;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.bezierCurveTo(x + 6, size * 0.3, x - 6, size * 0.6, x + 3, size);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(i * w, 0, 3, size);
      }
      speckle(ctx, size, 32, 4000, 0.14);
    },
    true
  );
}

export function roughRock(): THREE.CanvasTexture {
  return square(
    512,
    (ctx, size) => {
      const rand = mulberry32(41);
      ctx.fillStyle = '#56585c';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 260; i++) {
        const tone = 60 + Math.floor(rand() * 70);
        ctx.fillStyle = `rgba(${tone},${tone},${tone + 5},0.25)`;
        ctx.beginPath();
        ctx.ellipse(rand() * size, rand() * size, 8 + rand() * 50, 4 + rand() * 18, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      speckle(ctx, size, 42, 9000, 0.22);
    },
    true
  );
}

/** Tower paint: pale bands over a dark sea green. */
export function towerBands(): THREE.CanvasTexture {
  return square(512, (ctx, size) => {
    const bands = 5;
    const h = size / bands;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#d8d4c6' : '#2f5a5c';
      ctx.fillRect(0, i * h, size, h);
    }
    speckle(ctx, size, 51, 9000, 0.12);
    ctx.fillStyle = 'rgba(40,30,20,0.12)';
    const rand = mulberry32(52);
    for (let i = 0; i < 40; i++) ctx.fillRect(rand() * size, 0, 2 + rand() * 4, size * rand());
  });
}

export function plaster(): THREE.CanvasTexture {
  return square(
    256,
    (ctx, size) => {
      ctx.fillStyle = '#8f8a7c';
      ctx.fillRect(0, 0, size, size);
      speckle(ctx, size, 61, 5000, 0.12);
    },
    true
  );
}

function strokeGlyph(ctx: CanvasRenderingContext2D, id: number, x: number, y: number, size: number, width: number): void {
  const path = GLYPH_PATHS[id];
  if (!path) return;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 100, size / 100);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(path));
  ctx.restore();
}

export interface GlyphStyle {
  ink: string;
  ground: string | null;
  glow?: string;
  round?: boolean;
}

export const CARVED: GlyphStyle = { ink: '#15171a', ground: '#8d8f90' };
export const BRASS_PLATE: GlyphStyle = { ink: '#1d1608', ground: '#b9974f', round: true };
export const LIGHT: GlyphStyle = { ink: '#c9fff4', ground: null, glow: '#58f0d8' };

/** One glyph on a plate, or as light when the style has no ground. */
export function glyphTexture(id: number, style: GlyphStyle): THREE.CanvasTexture {
  return square(256, (ctx, size) => {
    if (style.ground) {
      ctx.fillStyle = style.ground;
      if (style.round) {
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(0, 0, size, size);
      }
      speckle(ctx, size, 70 + id, 1500, 0.14);
    }
    if (style.glow) {
      ctx.shadowColor = style.glow;
      ctx.shadowBlur = 26;
    }
    ctx.strokeStyle = style.ink;
    strokeGlyph(ctx, id, size / 2, size / 2, size * 0.66, 7);
  });
}

/** A row of glyphs drawn in light, for the dome projection. */
export function codeTexture(glyphs: readonly number[]): THREE.CanvasTexture {
  const cell = 256;
  const [canvas, ctx] = makeCanvas(cell * glyphs.length, cell);
  ctx.shadowColor = '#58f0d8';
  ctx.shadowBlur = 30;
  ctx.strokeStyle = '#d6fff7';
  glyphs.forEach((glyph, i) => strokeGlyph(ctx, glyph, cell * i + cell / 2, cell / 2, cell * 0.6, 7));
  return toTexture(canvas);
}

/** Engraved brass label. */
export function labelTexture(text: string, width = 512, height = 128): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(width, height);
  ctx.fillStyle = '#b9974f';
  ctx.fillRect(0, 0, width, height);
  speckle(ctx, Math.max(width, height), 80 + text.length, 1500, 0.12);
  ctx.strokeStyle = 'rgba(40,28,8,0.7)';
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, width - 16, height - 16);
  ctx.fillStyle = '#1d1608';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontSize = height * 0.5;
  ctx.font = `700 ${fontSize}px Georgia, serif`;
  const fit = (width - 48) / ctx.measureText(text).width;
  if (fit < 1) {
    fontSize *= fit;
    ctx.font = `700 ${fontSize}px Georgia, serif`;
  }
  ctx.fillText(text, width / 2, height / 2 + 2);
  return toTexture(canvas);
}

/** Painted wooden sign board. */
export function signTexture(text: string): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512, 128);
  ctx.fillStyle = '#5d4a33';
  ctx.fillRect(0, 0, 512, 128);
  speckle(ctx, 512, 90 + text.length, 2500, 0.16);
  ctx.fillStyle = '#e4dcc3';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 64px Georgia, serif';
  ctx.fillText(text, 256, 68);
  return toTexture(canvas);
}

/** Flow gauge face, 0 to GAUGE_MAX over a 270 degree sweep, red line at the rating. */
export function gaugeFace(): THREE.CanvasTexture {
  return square(512, (ctx, size) => {
    const c = size / 2;
    ctx.fillStyle = '#e9e2cc';
    ctx.beginPath();
    ctx.arc(c, c, c - 4, 0, Math.PI * 2);
    ctx.fill();
    speckle(ctx, size, 101, 1500, 0.08);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let value = 0; value <= GAUGE_MAX; value += 2) {
      const angle = gaugeAngle(value);
      const isMajor = value % 10 === 0;
      const inner = c - (isMajor ? 62 : 40);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = isMajor ? 6 : 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.sin(angle) * inner, c - Math.cos(angle) * inner);
      ctx.lineTo(c + Math.sin(angle) * (c - 22), c - Math.cos(angle) * (c - 22));
      ctx.stroke();
      if (isMajor) {
        ctx.fillStyle = '#1a1a1a';
        ctx.font = '700 40px Georgia, serif';
        ctx.fillText(String(value), c + Math.sin(angle) * (c - 98), c - Math.cos(angle) * (c - 98));
      }
    }
    const mark = gaugeAngle(ENGINE_RATING);
    ctx.strokeStyle = '#a3241c';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(c + Math.sin(mark) * (c - 74), c - Math.cos(mark) * (c - 74));
    ctx.lineTo(c + Math.sin(mark) * (c - 14), c - Math.cos(mark) * (c - 14));
    ctx.stroke();
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'italic 30px Georgia, serif';
    ctx.fillText('marks', c, c + 96);
  });
}

/** Needle angle in radians, clockwise from straight up. */
export function gaugeAngle(value: number): number {
  const t = Math.min(1, Math.max(0, value / GAUGE_MAX));
  return (-135 + t * 270) * (Math.PI / 180);
}

/** The music box card: one pin per beat, tallest bar is the longest chime. */
export function melodyCard(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(768, 512);
  ctx.fillStyle = '#d9cfae';
  ctx.fillRect(0, 0, 768, 512);
  speckle(ctx, 768, 111, 3000, 0.1);
  ctx.strokeStyle = 'rgba(60,40,20,0.7)';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, 740, 484);
  const left = 190;
  const top = 70;
  const rowH = 76;
  const colW = 90;
  for (let chime = 0; chime < CHIME_COUNT; chime++) {
    const y = top + (CHIME_COUNT - 1 - chime) * rowH + rowH / 2;
    ctx.strokeStyle = 'rgba(60,40,20,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + colW * MELODY.length, y);
    ctx.stroke();
    ctx.fillStyle = '#6b4a1c';
    const bar = 130 - chime * 22;
    ctx.fillRect(left - 30 - bar, y - 8, bar, 16);
  }
  MELODY.forEach((chime, beat) => {
    const x = left + beat * colW + colW / 2;
    const y = top + (CHIME_COUNT - 1 - chime) * rowH + rowH / 2;
    ctx.fillStyle = '#2a1c0a';
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(60,40,20,0.75)';
    ctx.font = 'italic 26px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(beat + 1), x, 476);
  });
  return toTexture(canvas);
}

/** Compass plate for the lamp wheel. */
export function compassFace(): THREE.CanvasTexture {
  return square(512, (ctx, size) => {
    const c = size / 2;
    ctx.fillStyle = '#b9974f';
    ctx.beginPath();
    ctx.arc(c, c, c - 2, 0, Math.PI * 2);
    ctx.fill();
    speckle(ctx, size, 121, 2000, 0.12);
    ctx.fillStyle = '#1d1608';
    ctx.strokeStyle = '#1d1608';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    COMPASS.forEach((name, i) => {
      const angle = (i * Math.PI) / 4;
      const isMain = i % 2 === 0;
      ctx.font = `700 ${isMain ? 58 : 34}px Georgia, serif`;
      ctx.fillText(name, c + Math.sin(angle) * (c - 62), c - Math.cos(angle) * (c - 62));
      ctx.lineWidth = isMain ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(c + Math.sin(angle) * (c - 112), c - Math.cos(angle) * (c - 112));
      ctx.lineTo(c + Math.sin(angle) * (c - 150), c - Math.cos(angle) * (c - 150));
      ctx.stroke();
    });
  });
}

/** Painted constellations for the inside of the dome. */
export function starChart(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(1024, 512);
  const rand = mulberry32(131);
  ctx.fillStyle = '#121a2a';
  ctx.fillRect(0, 0, 1024, 512);
  const stars: [number, number][] = [];
  for (let i = 0; i < 260; i++) {
    const x = rand() * 1024;
    const y = rand() * 512;
    const r = 0.6 + rand() * 2.2;
    ctx.fillStyle = `rgba(230,220,180,${0.35 + rand() * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (r > 2) stars.push([x, y]);
  }
  ctx.strokeStyle = 'rgba(214,190,120,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i + 1 < stars.length; i += 2) {
    const a = stars[i];
    const b = stars[i + 1];
    if (a && b && Math.hypot(a[0] - b[0], a[1] - b[1]) < 220) {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }
  return toTexture(canvas, true);
}

function radial(size: number, stops: [number, string][]): THREE.CanvasTexture {
  return square(size, (ctx) => {
    const c = size / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c);
    stops.forEach(([offset, colour]) => gradient.addColorStop(offset, colour));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  });
}

export function glowSprite(): THREE.CanvasTexture {
  return radial(128, [
    [0, 'rgba(255,255,255,1)'],
    [0.25, 'rgba(255,255,255,0.55)'],
    [1, 'rgba(255,255,255,0)']
  ]);
}

export function mistSprite(): THREE.CanvasTexture {
  return square(256, (ctx, size) => {
    const rand = mulberry32(141);
    for (let i = 0; i < 26; i++) {
      const x = size * (0.25 + rand() * 0.5);
      const y = size * (0.35 + rand() * 0.3);
      const r = size * (0.12 + rand() * 0.2);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, 'rgba(255,255,255,0.16)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    }
  });
}

/** Marker for a place to walk to: a ring with a chevron. */
export function walkMarker(): THREE.CanvasTexture {
  return square(128, (ctx, size) => {
    const c = size / 2;
    ctx.shadowColor = 'rgba(255,230,170,0.9)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(255,240,205,0.95)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c, c, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(c - 15, c + 8);
    ctx.lineTo(c, c - 10);
    ctx.lineTo(c + 15, c + 8);
    ctx.stroke();
  });
}

/** Marker for something to touch: a four point glint. */
export function useMarker(): THREE.CanvasTexture {
  return square(128, (ctx, size) => {
    const c = size / 2;
    ctx.shadowColor = 'rgba(140,255,235,0.9)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(225,255,248,0.95)';
    ctx.beginPath();
    const long = 40;
    const short = 9;
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? long : short;
      const a = (i * Math.PI) / 4;
      ctx.lineTo(c + Math.sin(a) * r, c - Math.cos(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  });
}
