import * as THREE from 'three';
import { CHIME_COUNT, SIGN_CHIMES } from '../../game/constants.ts';
import {
  box,
  cylinder,
  DEG,
  Eased,
  faceViewer,
  heading,
  hitBox,
  lampPost,
  mesh,
  plate,
  worldPoint,
  type Hotspot,
  type Kit,
  type Site
} from '../kit.ts';
import { heightAt, SITES, STANDS } from '../layout.ts';
import { mulberry32 } from '../noise.ts';
import { boulderGeometry } from '../terrain.ts';
import * as tex from '../textures.ts';
import { viewToward } from './dock.ts';

const VIEW_YAW = 315 * DEG;
const CHIME_LENGTHS = [1.9, 1.62, 1.36, 1.12, 0.9];
const CHIME_SPACING = 0.85;
const POST_X = 2.45;
const PLINTH_X = 3.35;
/** Sideways shift of the close-up so the chimes and the plinth sit centred together. */
const CLOSE_UP_SHIFT = 0.5;
const BEAM_HEIGHT = 3.1;

interface Chime {
  pivot: THREE.Group;
  swing: number;
  speed: number;
}

function buildStones(kit: Kit): THREE.Group {
  const stones = new THREE.Group();
  const rand = mulberry32(61);
  const centre = { x: -24.5, z: -22.5 };
  [20, 65, 110, 200, 245, 290, 335].forEach((degrees, i) => {
    const angle = degrees * DEG;
    const x = centre.x + Math.sin(angle) * 8.2;
    const z = centre.z - Math.cos(angle) * 8.2;
    const height = 2.6 + rand() * 1.4;
    const stone = mesh(boulderGeometry(60 + i, 2, 0.2), kit.rock);
    stone.scale.set(0.75 + rand() * 0.3, height / 2 + 0.3, 0.5 + rand() * 0.2);
    stone.position.set(x, heightAt(x, z) + height / 2 - 0.4, z);
    stone.rotation.set((rand() - 0.5) * 0.12, -angle, (rand() - 0.5) * 0.12);
    stones.add(stone);
  });
  return stones;
}

export function buildGarden(kit: Kit, globe: THREE.Material): Site {
  const root = new THREE.Group();
  root.add(buildStones(kit));

  const site = SITES.chimeFrame;
  const ground = heightAt(site.x, site.z);
  const frame = new THREE.Group();
  frame.position.set(site.x, ground - 0.05, site.z);
  faceViewer(frame, VIEW_YAW);
  root.add(frame);

  [-POST_X, POST_X].forEach((x) => {
    frame.add(box(kit.woodDark, [0.24, BEAM_HEIGHT + 0.3, 0.24], [x, (BEAM_HEIGHT + 0.3) / 2, 0]));
    frame.add(box(kit.stoneDark, [0.6, 0.3, 0.6], [x, 0.1, 0]));
  });
  frame.add(box(kit.woodDark, [POST_X * 2 + 0.7, 0.22, 0.28], [0, BEAM_HEIGHT, 0]));

  const hotspots: Hotspot[] = [];
  const chimes: Chime[] = CHIME_LENGTHS.map((length, index) => {
    const pivot = new THREE.Group();
    pivot.position.set((index - (CHIME_COUNT - 1) / 2) * CHIME_SPACING, BEAM_HEIGHT - 0.11, 0);
    frame.add(pivot);
    pivot.add(cylinder(kit.iron, 0.008, 0.008, 0.3, [0, -0.15, 0], 4));
    const tube = cylinder(kit.bronze, 0.085, 0.085, length, [0, -0.3 - length / 2, 0], 14);
    pivot.add(tube);
    const target = hitBox(kit, [CHIME_SPACING * 0.95, length + 0.5, 0.5], [0, -0.3 - length / 2, 0]);
    pivot.add(target);
    hotspots.push({
      id: `chime-${index}`,
      node: 'chimes',
      label: 'Strike The Chime',
      targets: [tube, target],
      action: () => ({ type: 'strikeChime', index })
    });
    return { pivot, swing: 0, speed: 0 };
  });

  const plinth = new THREE.Group();
  plinth.position.set(PLINTH_X, 0, -0.2);
  frame.add(plinth);
  plinth.add(box(kit.stoneDark, [0.9, 0.95, 0.9], [0, 0.45, 0]));
  plinth.add(box(kit.dark, [0.6, 0.02, 0.6], [0, 0.935, 0]));
  const sign = plate(tex.glyphTexture(SIGN_CHIMES, tex.CARVED), 0.6, 0.6);
  sign.position.set(0, 0.48, 0.456);
  plinth.add(sign);
  const lid = box(kit.stone, [1.0, 0.14, 1.0], [0, 1.0, 0]);
  plinth.add(lid);
  const lens = mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.08, 28), kit.crystal, [0, 1.22, 0], { cast: false });
  lens.rotation.set(Math.PI / 2, 0, 0.3);
  plinth.add(lens);
  const plinthHit = hitBox(kit, [1.1, 1.7, 1.1], [0, 0.8, 0]);
  plinth.add(plinthHit);
  hotspots.push({
    id: 'plinth',
    node: 'chimes',
    label: 'Stone Plinth',
    targets: [plinthHit],
    marker: worldPoint(plinth, 0, 1.55, 0),
    isActive: (state) => !state.itemsTaken.includes('lens'),
    action: () => ({ type: 'takeLens' })
  });

  const lamp = lampPost(kit, globe);
  lamp.position.set(-14.5, heightAt(-14.5, -15.5) - 0.1, -15.5);
  lamp.rotation.y = 2.2;
  root.add(lamp);

  const lidSlide = new Eased(0, 1.6);
  const toViewer = heading(VIEW_YAW).multiplyScalar(-3.7);
  const right = heading(VIEW_YAW + 90 * DEG).multiplyScalar(CLOSE_UP_SHIFT);
  const closeUp = new THREE.Vector3(site.x, ground + 1.75, site.z).add(toViewer).add(right);

  return {
    group: root,
    views: {
      garden: viewToward(STANDS.garden, SITES.chimeFrame),
      chimes: { position: closeUp, yaw: VIEW_YAW, pitch: -3 * DEG, frameWidth: 7.6, frameHeight: 4, distance: 3.7 }
    },
    anchors: { 'garden>chimes': worldPoint(frame, 0, 1.9, 0) },
    hotspots,
    sync: (state) => {
      lidSlide.target = state.chimesSolved ? 1 : 0;
      lens.visible = state.chimesSolved && !state.itemsTaken.includes('lens');
    },
    signal: (event) => {
      const chime = event.type === 'chime' ? chimes[event.index] : undefined;
      if (chime) chime.speed += 1.3;
    },
    update: (dt) => {
      lid.position.z = -lidSlide.step(dt) * 0.95;
      chimes.forEach((chime) => {
        chime.speed += (-chime.swing * 30 - chime.speed * 1.6) * dt;
        chime.swing += chime.speed * dt;
        chime.pivot.rotation.x = chime.swing;
      });
    }
  };
}

