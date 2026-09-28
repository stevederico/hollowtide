import * as THREE from 'three';
import { GLYPH } from '../../game/constants.ts';
import { isStackLit } from '../../game/state.ts';
import {
  box,
  cylinder,
  DEG,
  Eased,
  faceViewer,
  glow,
  glowDisc,
  heading,
  mesh,
  plate,
  worldPoint,
  type Kit,
  type Site
} from '../kit.ts';
import { EYE, SITES, STANDS, WALKWAY_TOP } from '../layout.ts';
import { fbm, mulberry32 } from '../noise.ts';
import { boulderGeometry, carveRecess } from '../terrain.ts';
import * as tex from '../textures.ts';
import { viewToward } from './dock.ts';

const VIEW_YAW = 270 * DEG;
const DOOR_Y = WALKWAY_TOP + 1.45;
const DOOR_RADIUS = 1.25;

function stackGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(4.2, 7.6, 32, 28, 16);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const bulge = 1 + fbm(x * 0.22 + 3, y * 0.16 + z * 0.22, 3) * 0.3;
    position.setXYZ(i, x * bulge, y, z * bulge);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function buildStones(kit: Kit): THREE.Group {
  const stones = new THREE.Group();
  const rand = mulberry32(91);
  const from = { x: -58.6, z: -2.6 };
  const to = { x: -64.2, z: -0.3 };
  const count = 7;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t + (rand() - 0.5) * 0.5;
    const radius = 0.55 + rand() * 0.2;
    stones.add(cylinder(kit.stoneDark, radius, radius * 1.15, 4, [x, WALKWAY_TOP - 2, z], 9));
  }
  stones.add(box(kit.stoneDark, [6, 0.5, 3.6], [STANDS.stackLanding.x - 1.9, WALKWAY_TOP - 0.25, 0]));
  stones.add(box(kit.rock, [5.4, 5, 3.0], [STANDS.stackLanding.x - 1.9, WALKWAY_TOP - 3, 0]));
  return stones;
}

export function buildStack(kit: Kit, glowTex: THREE.Texture): Site {
  const root = new THREE.Group();
  const site = SITES.stack;
  const rockMaterial = kit.rock.clone();
  rockMaterial.map = kit.tiled(kit.rockTex, 5, 6);
  const stack = mesh(stackGeometry(), rockMaterial, [site.x, 9, site.z]);
  root.add(stack);
  [
    [-84, 12, 2.6],
    [-70, -13, 2.0],
    [-88, -9, 3.4]
  ].forEach(([x, z, size], i) => {
    const outcrop = mesh(boulderGeometry(30 + i, 2, 0.3), rockMaterial);
    outcrop.scale.set(size ?? 2, (size ?? 2) * 1.6, size ?? 2);
    outcrop.position.set(x ?? 0, 0.4, z ?? 0);
    root.add(outcrop);
  });
  root.add(buildStones(kit));

  const portal = new THREE.Group();
  portal.position.set(site.x + 6.75, 0, site.z);
  faceViewer(portal, VIEW_YAW);
  root.add(portal);
  portal.add(box(kit.stoneDark, [3.6, 4.4, 2.4], [0, DOOR_Y, -1.7]));
  carveRecess(stack, worldPoint(portal, 0, DOOR_Y, 0), heading(VIEW_YAW).negate(), 2.8);
  const doorLight = new THREE.PointLight(0x9fb8e6, 4, 8, 1.7);
  doorLight.position.set(0, DOOR_Y + 0.9, 1.6);
  portal.add(doorLight);
  portal.add(mesh(new THREE.TorusGeometry(DOOR_RADIUS + 0.1, 0.2, 10, 40), kit.stone, [0, DOOR_Y, -0.2]));
  portal.add(mesh(new THREE.CircleGeometry(DOOR_RADIUS, 36), kit.dark, [0, DOOR_Y, -0.24], { cast: false }));
  const inner = glowDisc(glowTex, 0x49d8c6, DOOR_RADIUS);
  inner.position.set(0, DOOR_Y, -0.22);
  portal.add(inner);

  const door = new THREE.Group();
  door.position.set(0, DOOR_Y, -0.1);
  portal.add(door);
  door.add(mesh(new THREE.CylinderGeometry(DOOR_RADIUS, DOOR_RADIUS, 0.26, 40).rotateX(Math.PI / 2), kit.stone));
  const carved = plate(tex.glyphTexture(GLYPH.eye, { ink: '#101214', ground: null }), 1.9, 1.9);
  carved.position.z = 0.14;
  door.add(carved);
  const lit = plate(tex.glyphTexture(GLYPH.eye, tex.LIGHT), 2.1, 2.1, { glow: true });
  lit.position.z = 0.15;
  door.add(lit);

  const beacon = glow(glowTex, 0x8ff8e6, 16);
  beacon.position.set(site.x + 3, 13, site.z);
  root.add(beacon);

  const revealed = new Eased(0, 0.8);
  const struck = new Eased(0, 1.2);

  return {
    group: root,
    views: {
      gardenShore: viewToward(STANDS.gardenShore, SITES.stack),
      stackLanding: {
        position: new THREE.Vector3(STANDS.stackLanding.x, WALKWAY_TOP + EYE, STANDS.stackLanding.z),
        yaw: VIEW_YAW,
        pitch: 0
      }
    },
    anchors: {
      'gardenShore>stackLanding': new THREE.Vector3(-61.4, WALKWAY_TOP + 0.9, -1.4),
      'stackLanding>gardenShore': new THREE.Vector3(-60, WALKWAY_TOP + 1.0, -2),
      'stackLanding>grotto': worldPoint(portal, 0, DOOR_Y, 0.2)
    },
    sync: (state) => {
      revealed.target = state.grottoRevealed ? 1 : 0;
      struck.target = isStackLit(state) ? 1 : 0;
    },
    update: (dt, time) => {
      const amount = revealed.step(dt);
      door.position.y = DOOR_Y - amount * (DOOR_RADIUS * 2 + 1.6);
      const pulse = 0.75 + Math.sin(time * 1.9) * 0.25;
      if (lit.material instanceof THREE.MeshBasicMaterial) lit.material.opacity = amount * pulse;
      inner.material.opacity = amount * 0.6 * pulse;
      beacon.material.opacity = struck.step(dt) * 0.55;
    }
  };
}
