import * as THREE from 'three';
import { MELODY, MELODY_BEAT } from '../../game/constants.ts';
import {
  bookMesh,
  box,
  combine,
  cylinder,
  DEG,
  faceViewer,
  hitBox,
  lampMaterial,
  mesh,
  plate,
  roundRoom,
  worldPoint,
  type Area,
  type Kit,
  type Site
} from '../kit.ts';
import * as tex from '../textures.ts';

const ORIGIN = new THREE.Vector3(-60, -200, 0);
const RADIUS = 3.4;
const HEIGHT = 6;
const CARD_WIDTH = 0.46;
const CARD_PIXELS = 768;
const CARD_LEFT = 190;
const CARD_COLUMN = 90;

function buildStairs(kit: Kit): THREE.Group {
  const stairs = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const angle = (300 + i * 13) * DEG;
    const step = box(kit.woodDark, [1.3, 0.1, 0.62], [0, 0, 0]);
    step.position.set(Math.sin(angle) * 2.7, 0.3 + i * 0.34, -Math.cos(angle) * 2.7);
    step.rotation.y = Math.PI / 2 - angle;
    stairs.add(step);
    const post = cylinder(kit.iron, 0.02, 0.02, 1.0, [Math.sin(angle) * 2.1, 0.8 + i * 0.34, -Math.cos(angle) * 2.1], 6);
    stairs.add(post);
  }
  return stairs;
}

export function buildTowerHall(kit: Kit): Area {
  const group = new THREE.Group();
  group.position.copy(ORIGIN);

  const walls = kit.plaster.clone();
  walls.map = kit.tiled(kit.plasterTex, 8, 3);
  const floor = kit.wood.clone();
  floor.map = kit.tiled(kit.plankTex, 3, 3);
  group.add(roundRoom(RADIUS, HEIGHT, walls, floor));
  const ceiling = mesh(new THREE.RingGeometry(1.1, RADIUS, 40), kit.woodDark, [0, HEIGHT, 0]);
  ceiling.rotation.x = Math.PI / 2;
  group.add(ceiling);
  const above = mesh(new THREE.CircleGeometry(1.1, 24), kit.dark, [0, HEIGHT + 0.05, 0], { cast: false });
  above.rotation.x = Math.PI / 2;
  group.add(above);
  group.add(buildStairs(kit));

  group.add(box(kit.stoneDark, [0.4, 2.8, 1.8], [-RADIUS + 0.1, 1.4, 0]));
  group.add(box(kit.woodDark, [0.14, 2.3, 1.25], [-RADIUS + 0.28, 1.2, 0]));

  group.add(box(kit.wood, [0.9, 0.07, 2.2], [2.5, 0.85, 0.3]));
  [-0.7, 1.3].forEach((z) => group.add(box(kit.woodDark, [0.8, 0.85, 0.08], [2.5, 0.42, z])));
  const shade = lampMaterial(0xffc98a);
  shade.emissiveIntensity = 3;
  group.add(cylinder(kit.brass, 0.05, 0.09, 0.22, [2.65, 1.0, 1.15], 10));
  group.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), shade, [2.65, 1.2, 1.15], { cast: false }));
  const deskLight = new THREE.PointLight(0xffb469, 5, 7, 1.8);
  deskLight.position.set(2.3, 1.5, 0.9);
  group.add(deskLight);
  const ceilingLight = new THREE.PointLight(0xffc27a, 24, 14, 1.6);
  ceilingLight.position.set(-0.6, 4.2, 0.4);
  group.add(ceilingLight);
  group.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), shade, [-0.6, 4.4, 0.4], { cast: false }));
  group.add(new THREE.HemisphereLight(0x6a6350, 0x14100c, 0.5));

  const book = bookMesh(kit);
  book.position.set(2.4, 0.89, 0.75);
  book.rotation.y = 1.9;
  group.add(book);
  const bookHit = hitBox(kit, [0.6, 0.4, 0.6], [2.4, 1.0, 0.75]);
  group.add(bookHit);

  // Music box. Local +z faces the room, +x runs south.
  const musicBox = new THREE.Group();
  musicBox.position.set(2.5, 0.89, -0.25);
  faceViewer(musicBox, 90 * DEG);
  group.add(musicBox);
  musicBox.add(box(kit.woodDark, [0.56, 0.16, 0.34], [0, 0.08, 0]));
  musicBox.add(box(kit.dark, [0.5, 0.01, 0.28], [0, 0.163, 0]));
  const lid = new THREE.Group();
  lid.position.set(0, 0.16, -0.17);
  lid.rotation.x = -0.22;
  musicBox.add(lid);
  lid.add(box(kit.woodDark, [0.56, 0.36, 0.025], [0, 0.18, 0]));
  const card = plate(tex.melodyCard(), CARD_WIDTH, CARD_WIDTH * (512 / 768));
  card.position.set(0, 0.18, 0.016);
  lid.add(card);
  const cursorMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd58a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const cursor = new THREE.Mesh(new THREE.PlaneGeometry(CARD_WIDTH * (CARD_COLUMN / CARD_PIXELS), 0.26), cursorMaterial);
  cursor.position.set(0, 0.185, 0.02);
  lid.add(cursor);
  const drum = cylinder(kit.bronze, 0.05, 0.05, 0.42, [0, 0.16, 0.02], 16);
  drum.rotation.z = Math.PI / 2;
  musicBox.add(drum);
  musicBox.add(box(kit.iron, [0.42, 0.01, 0.1], [0, 0.175, 0.1]));
  const crank = new THREE.Group();
  crank.position.set(0.3, 0.1, 0.02);
  musicBox.add(crank);
  crank.add(cylinder(kit.brass, 0.012, 0.012, 0.06, [0, 0, 0], 8).rotateZ(Math.PI / 2));
  crank.add(box(kit.brass, [0.015, 0.1, 0.015], [0.03, 0.05, 0]));
  crank.add(mesh(new THREE.SphereGeometry(0.02, 8, 6), kit.woodDark, [0.04, 0.1, 0]));
  const boxHit = hitBox(kit, [0.8, 0.7, 0.6], [0, 0.25, 0]);
  musicBox.add(boxHit);

  let playing = -1;
  const site: Site = {
    group,
    views: {
      lighthouseHall: { position: worldPoint(group, -1.7, 1.7, 0), yaw: 90 * DEG, pitch: -4 * DEG },
      musicBox: {
        position: worldPoint(musicBox, 0, 0.62, 1.05),
        yaw: 90 * DEG,
        pitch: -22 * DEG,
        frameWidth: 0.95,
        frameHeight: 0.7,
        distance: 1.15
      }
    },
    anchors: {
      'lighthouseHall>lighthouseBase': worldPoint(group, -RADIUS + 0.4, 1.4, 0),
      'lighthouseHall>musicBox': worldPoint(musicBox, 0, 0.5, 0),
      'lighthouseHall>lampRoom': worldPoint(group, Math.sin(352 * DEG) * 2.6, 2.3, -Math.cos(352 * DEG) * 2.6)
    },
    hotspots: [
      {
        id: 'journal-lamp',
        node: 'lighthouseHall',
        label: 'Read The Journal',
        targets: [book, bookHit],
        marker: worldPoint(group, 2.4, 1.2, 0.75),
        action: () => ({ type: 'readJournal', id: 'lamp' })
      },
      {
        id: 'music-box',
        node: 'musicBox',
        label: 'Wind The Music Box',
        targets: [boxHit],
        action: () => ({ type: 'playMusicBox' })
      }
    ],
    signal: (event) => {
      if (event.type === 'melody') playing = 0;
    },
    update: (dt) => {
      if (playing < 0) {
        cursorMaterial.opacity = Math.max(0, cursorMaterial.opacity - dt * 2);
        return;
      }
      playing += dt;
      const beat = Math.floor(playing / MELODY_BEAT);
      if (beat >= MELODY.length) {
        playing = -1;
        return;
      }
      const pixel = CARD_LEFT + beat * CARD_COLUMN + CARD_COLUMN / 2;
      cursor.position.x = (pixel / CARD_PIXELS - 0.5) * CARD_WIDTH;
      cursorMaterial.opacity = 0.5;
      drum.rotation.x += dt * 2.2;
      crank.rotation.x += dt * 6;
    }
  };
  return combine('lighthouseHall', { colour: 0x0c0a08, density: 0.03 }, [site]);
}
