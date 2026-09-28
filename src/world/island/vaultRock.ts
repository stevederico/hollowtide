import * as THREE from 'three';
import { GLYPH_COUNT, VAULT_CODE } from '../../game/constants.ts';
import {
  box,
  DEG,
  Eased,
  EasedAngle,
  faceViewer,
  glowDisc,
  heading,
  hitBox,
  mesh,
  plate,
  worldPoint,
  type Hotspot,
  type Kit,
  type Site
} from '../kit.ts';
import { EYE, SITES, STANDS, WALKWAY_TOP } from '../layout.ts';
import { mulberry32 } from '../noise.ts';
import { boulderGeometry, carveRecess } from '../terrain.ts';
import * as tex from '../textures.ts';
import { viewToward } from './dock.ts';

const VIEW_YAW = 45 * DEG;
const DOOR_Y = 1.05;
const DOOR_RADIUS = 1.7;
const DIAL_X = [-1.05, -0.35, 0.35, 1.05];

function buildCauseway(kit: Kit): THREE.Group {
  const causeway = new THREE.Group();
  const rand = mulberry32(81);
  const from = { x: 37.6, z: -34.6 };
  const to = { x: 45.0, z: -43.5 };
  const count = 9;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const x = from.x + (to.x - from.x) * t + (rand() - 0.5) * 0.3;
    const z = from.z + (to.z - from.z) * t + (rand() - 0.5) * 0.3;
    const slab = box(kit.stoneDark, [2.1, 0.45, 1.5], [x, WALKWAY_TOP - 0.225 - rand() * 0.06, z]);
    slab.rotation.y = -VIEW_YAW + (rand() - 0.5) * 0.25;
    causeway.add(slab);
    causeway.add(box(kit.rock, [1.3, 5, 1.0], [x, WALKWAY_TOP - 2.9, z]));
  }
  return causeway;
}

export function buildVaultRock(kit: Kit, glowTex: THREE.Texture): Site {
  const root = new THREE.Group();
  const rockMaterial = kit.rock.clone();
  rockMaterial.map = kit.tiled(kit.rockTex, 6, 4);
  const rock = mesh(boulderGeometry(9, 4, 0.34), rockMaterial);
  rock.scale.set(13.5, 13, 11.5);
  rock.position.set(SITES.vaultRock.x, 2.5, SITES.vaultRock.z);
  root.add(rock);
  [
    [63, -40, 3.5],
    [42, -58, 3],
    [66, -62, 4.5]
  ].forEach(([x, z, size], i) => {
    const outcrop = mesh(boulderGeometry(12 + i, 2, 0.3), rockMaterial);
    outcrop.scale.set(size ?? 3, (size ?? 3) * 1.3, size ?? 3);
    outcrop.position.set(x ?? 0, 0.5, z ?? 0);
    root.add(outcrop);
  });
  root.add(buildCauseway(kit));

  const portal = new THREE.Group();
  portal.position.set(SITES.vaultDoor.x, 0, SITES.vaultDoor.z);
  faceViewer(portal, VIEW_YAW);
  root.add(portal);

  portal.add(box(kit.stoneDark, [4.6, 5.2, 2.4], [0, DOOR_Y, -1.75]));
  carveRecess(rock, worldPoint(portal, 0, DOOR_Y, 0), heading(VIEW_YAW).negate(), 3.4);
  [-2.3, 2.3].forEach((x) => {
    const shard = mesh(new THREE.OctahedronGeometry(0.16), kit.crystal, [x, DOOR_Y + 0.9, 0.1], { cast: false });
    shard.scale.y = 1.8;
    portal.add(shard);
    portal.add(box(kit.iron, [0.08, 0.5, 0.4], [x, DOOR_Y + 0.5, -0.1]));
    const light = new THREE.PointLight(0xa8d8d8, 3, 9, 1.7);
    light.position.set(x * 0.9, DOOR_Y + 1.4, 2.2);
    portal.add(light);
  });
  portal.add(box(kit.stoneDark, [3.4, 0.5, 1.6], [0, WALKWAY_TOP - 0.25, 0.6]));
  const surround = mesh(new THREE.TorusGeometry(DOOR_RADIUS + 0.12, 0.24, 12, 48), kit.stone, [0, DOOR_Y, -0.2]);
  portal.add(surround);
  const opening = mesh(new THREE.CircleGeometry(DOOR_RADIUS, 40), kit.dark, [0, DOOR_Y, -0.28], { cast: false });
  portal.add(opening);
  const inner = glowDisc(glowTex, 0x49d8c6, DOOR_RADIUS);
  inner.position.set(0, DOOR_Y, -0.26);
  portal.add(inner);

  const door = new THREE.Group();
  door.position.set(0, DOOR_Y, -0.1);
  portal.add(door);
  const slab = mesh(new THREE.CylinderGeometry(DOOR_RADIUS, DOOR_RADIUS, 0.3, 48).rotateX(Math.PI / 2), kit.bronze);
  door.add(slab);
  const band = mesh(new THREE.TorusGeometry(DOOR_RADIUS - 0.18, 0.05, 8, 48), kit.brass, [0, 0, 0.16]);
  door.add(band);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    door.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), kit.brass, [Math.sin(a) * 1.45, Math.cos(a) * 1.45, 0.16]));
  }

  const faces = Array.from({ length: GLYPH_COUNT }, (_, glyph) => tex.glyphTexture(glyph, tex.BRASS_PLATE));
  const hotspots: Hotspot[] = [];
  const dials = DIAL_X.map((x, index) => {
    const dial = new THREE.Group();
    dial.position.set(x, 0.42, 0.16);
    door.add(dial);
    dial.add(mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.08, 28).rotateX(Math.PI / 2), kit.iron));
    const face = plate(faces[0] ?? tex.glyphTexture(0, tex.BRASS_PLATE), 0.58, 0.58);
    face.position.z = 0.05;
    dial.add(face);
    const target = hitBox(kit, [0.68, 0.8, 0.3], [0, 0, 0.1]);
    dial.add(target);
    hotspots.push({
      id: `vault-dial-${index}`,
      node: 'vaultDoor',
      label: 'Turn The Dial',
      targets: [face, target],
      isActive: (state) => !state.vaultOpen,
      action: () => ({ type: 'turnVaultDial', index, delta: 1 })
    });
    return { face, spin: new EasedAngle(0, 9), shown: -1 };
  });

  const wheel = new THREE.Group();
  wheel.position.set(0, -0.62, 0.22);
  door.add(wheel);
  wheel.add(mesh(new THREE.TorusGeometry(0.42, 0.05, 10, 32), kit.brass));
  for (let i = 0; i < 3; i++) {
    const spoke = box(kit.brass, [0.84, 0.06, 0.05], [0, 0, 0]);
    spoke.rotation.z = (i / 3) * Math.PI;
    wheel.add(spoke);
  }
  wheel.add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 14).rotateX(Math.PI / 2), kit.iron));
  const wheelHit = hitBox(kit, [1.1, 1.0, 0.4], [0, 0, 0.1]);
  wheel.add(wheelHit);
  hotspots.push({
    id: 'vault-wheel',
    node: 'vaultDoor',
    label: 'Turn The Wheel',
    targets: [wheel, wheelHit],
    isActive: (state) => !state.vaultOpen,
    action: () => ({ type: 'openVault' })
  });

  const open = new Eased(0, 0.9);
  let ready = false;

  return {
    group: root,
    views: {
      cove: viewToward(STANDS.cove, SITES.vaultDoor),
      vaultDoor: {
        position: new THREE.Vector3(STANDS.vaultDoor.x, WALKWAY_TOP + EYE, STANDS.vaultDoor.z),
        yaw: VIEW_YAW,
        pitch: 1 * DEG,
        frameWidth: 4.2,
        frameHeight: 4,
        distance: 3.4
      }
    },
    anchors: {
      'cove>vaultDoor': new THREE.Vector3(41.2, WALKWAY_TOP + 0.9, -39),
      'vaultDoor>vault': worldPoint(portal, 0, DOOR_Y, 0.2)
    },
    hotspots,
    sync: (state) => {
      open.target = state.vaultOpen ? 1 : 0;
      ready = VAULT_CODE.every((glyph, i) => state.vaultDials[i] === glyph);
      dials.forEach((dial, index) => {
        const glyph = state.vaultDials[index] ?? 0;
        if (dial.shown === glyph) return;
        if (dial.shown !== -1) dial.spin.value = dial.spin.target - Math.PI / 2;
        dial.shown = glyph;
        const material = dial.face.material;
        if (material instanceof THREE.MeshStandardMaterial) material.map = faces[glyph] ?? null;
      });
    },
    update: (dt, time) => {
      const amount = open.step(dt);
      door.position.x = -amount * (DOOR_RADIUS * 2 + 0.5);
      door.rotation.z = amount * 2.2;
      wheel.rotation.z = amount * 9 + (ready && amount < 0.01 ? Math.sin(time * 3) * 0.04 : 0);
      inner.material.opacity = amount * (0.55 + Math.sin(time * 1.7) * 0.08);
      dials.forEach((dial) => {
        dial.face.rotation.z = dial.spin.step(dt) - dial.spin.target;
      });
    }
  };
}
