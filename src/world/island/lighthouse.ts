import * as THREE from 'three';
import { LAMP_TO_DOME, LAMP_TO_STACK, SIGN_TOWER } from '../../game/constants.ts';
import { isBeamFocused } from '../../game/state.ts';
import {
  box,
  cylinder,
  DEG,
  Eased,
  EasedAngle,
  faceViewer,
  glow,
  hitBox,
  lampPost,
  mesh,
  plate,
  worldPoint,
  type Kit,
  type Site
} from '../kit.ts';
import { EYE, heightAt, SITES, STANDS } from '../layout.ts';
import * as tex from '../textures.ts';
import { viewToward } from './dock.ts';

const FLOOR = 22.3;
const LAMP_HEIGHT = 2.75;
const WIDE_LENGTH = 80;
const FOCUS_LENGTH = 170;
const DOME_TOP = 9.4;

/** Hollow cone of light along local -z, bright at the lamp and gone at the far end. */
function buildBeam(length: number, startRadius: number, endRadius: number, colour: number): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(endRadius, startRadius, length, 28, 6, true);
  geometry.translate(0, length / 2, 0);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const t = Math.min(1, -position.getZ(i) / length);
    const shade = (1 - t) ** 1.6;
    colours.set([shade, shade, shade], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const material = new THREE.MeshBasicMaterial({
    color: colour,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false
  });
  const beam = new THREE.Mesh(geometry, material);
  beam.renderOrder = 3;
  return beam;
}

function basicOf(object: THREE.Mesh): THREE.MeshBasicMaterial {
  if (!(object.material instanceof THREE.MeshBasicMaterial)) throw new Error('Beam needs a basic material');
  return object.material;
}

function buildTower(kit: Kit, windows: THREE.Material): THREE.Group {
  const tower = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ map: tex.towerBands(), roughness: 0.9 });
  tower.add(cylinder(paint, 2.4, 3.4, 22, [0, 11, 0], 36));
  tower.add(cylinder(kit.stoneDark, 3.9, 4.1, 1, [0, 0.3, 0], 36));

  tower.add(box(kit.stoneDark, [1.9, 2.9, 0.5], [0, 1.45, 3.2]));
  tower.add(box(kit.woodDark, [1.25, 2.3, 0.2], [0, 1.25, 3.42]));
  tower.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), kit.brass, [0.42, 1.2, 3.55]));
  const sign = plate(tex.glyphTexture(SIGN_TOWER, tex.CARVED), 0.85, 0.85);
  tower.add(box(kit.stoneDark, [1.3, 1.2, 0.5], [0, 3.5, 3.08]));
  sign.position.set(0, 3.5, 3.34);
  tower.add(sign);

  [8, 14.5].forEach((y, i) => {
    const pane = mesh(new THREE.PlaneGeometry(0.5, 1.0), windows, undefined, { cast: false });
    const angle = i === 0 ? 0.5 : -0.7;
    const radius = 3.4 - (y / 22) * 1.0 + 0.03;
    pane.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
    pane.rotation.y = angle;
    tower.add(pane);
  });

  tower.add(cylinder(kit.iron, 3.6, 3.3, 0.3, [0, FLOOR - 0.15, 0], 36));
  const rail = mesh(new THREE.TorusGeometry(3.5, 0.04, 6, 48), kit.iron, [0, FLOOR + 1.0, 0]);
  rail.rotation.x = Math.PI / 2;
  tower.add(rail);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    tower.add(cylinder(kit.iron, 0.03, 0.03, 1.0, [Math.sin(a) * 3.5, FLOOR + 0.5, Math.cos(a) * 3.5], 6));
  }

  tower.add(mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.4, 24, 1, true), kit.glass, [0, FLOOR + 1.7, 0], { cast: false }));
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    tower.add(cylinder(kit.iron, 0.04, 0.04, 3.4, [Math.sin(a) * 2.2, FLOOR + 1.7, Math.cos(a) * 2.2], 6));
  }
  tower.add(cylinder(kit.iron, 2.3, 2.3, 0.18, [0, FLOOR + 0.09, 0], 24));
  tower.add(cylinder(kit.iron, 2.35, 2.35, 0.2, [0, FLOOR + 3.4, 0], 24));
  tower.add(mesh(new THREE.ConeGeometry(2.8, 1.9, 24), kit.copper, [0, FLOOR + 4.45, 0]));
  tower.add(cylinder(kit.brass, 0.05, 0.05, 1.2, [0, FLOOR + 5.9, 0], 6));
  tower.add(mesh(new THREE.SphereGeometry(0.16, 10, 8), kit.brass, [0, FLOOR + 5.5, 0]));

  tower.add(cylinder(kit.iron, 0.3, 0.42, LAMP_HEIGHT - 0.5, [0, FLOOR + (LAMP_HEIGHT - 0.5) / 2, 0], 14));
  const hatch = box(kit.woodDark, [0.9, 0.06, 0.9], [1.0, FLOOR + 0.04, -1.0]);
  tower.add(hatch);
  tower.add(mesh(new THREE.TorusGeometry(0.1, 0.02, 6, 14), kit.iron, [1.0, FLOOR + 0.1, -0.75]));
  return tower;
}

export function buildLighthouse(kit: Kit, globe: THREE.Material, windows: THREE.Material, glowTex: THREE.Texture): Site {
  const root = new THREE.Group();
  const site = SITES.lighthouse;
  const ground = heightAt(site.x, site.z);

  const tower = buildTower(kit, windows);
  tower.position.set(site.x, ground - 0.2, site.z);
  faceViewer(tower, 90 * DEG);
  root.add(tower);

  const doorLamp = lampPost(kit, globe);
  doorLamp.position.set(site.x - 5.2, heightAt(site.x - 5.2, 2.6) - 0.1, 2.6);
  doorLamp.rotation.y = -Math.PI / 2;
  root.add(doorLamp);

  const floorY = ground - 0.2 + FLOOR;
  const lampCentre = new THREE.Vector3(site.x, floorY + LAMP_HEIGHT, site.z);

  // The rotating head lives in world space so its yaw is a plain compass heading.
  const head = new THREE.Group();
  head.position.copy(lampCentre);
  root.add(head);
  const core = new THREE.MeshStandardMaterial({ color: 0x4a4436, emissive: 0xffe2a6, emissiveIntensity: 0, roughness: 0.3 });
  head.add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16), core, undefined, { cast: false }));
  [-0.34, -0.17, 0, 0.17, 0.34].forEach((y) => {
    const ring = mesh(new THREE.TorusGeometry(Math.sqrt(0.55 ** 2 - y * y), 0.035, 8, 28), kit.brass, [0, y, 0]);
    ring.rotation.x = Math.PI / 2;
    head.add(ring);
  });
  head.add(mesh(new THREE.SphereGeometry(0.53, 20, 14), kit.glass, undefined, { cast: false }));
  head.add(box(kit.brass, [0.06, 0.06, 0.4], [0, -0.42, -0.72]));
  head.add(box(kit.brass, [0.06, 0.45, 0.06], [0, -0.22, -0.9]));
  const cradle = mesh(new THREE.TorusGeometry(0.3, 0.04, 8, 28), kit.brass, [0, 0, -0.9]);
  head.add(cradle);
  const lens = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 28), kit.crystal, [0, 0, -0.9], { cast: false });
  lens.rotation.x = Math.PI / 2;
  lens.visible = false;
  head.add(lens);
  const cradleHit = hitBox(kit, [0.9, 0.9, 0.5], [0, 0, -0.9]);
  head.add(cradleHit);
  const halo = glow(glowTex, 0xffe2a6, 7);
  head.add(halo);

  const tilt = new THREE.Group();
  head.add(tilt);
  const wide = buildBeam(WIDE_LENGTH, 0.5, 15, 0xffe0a8);
  const focused = buildBeam(1, 0.3, 2.4, 0xa8fff0);
  tilt.add(wide, focused);
  const lampLight = new THREE.PointLight(0xffdf9f, 0, 18, 2);
  head.add(lampLight);

  // Wheel pedestal on the west side of the lamp room.
  const pedestal = new THREE.Group();
  pedestal.position.set(site.x - 2.0, floorY, site.z - 0.45);
  faceViewer(pedestal, 270 * DEG);
  root.add(pedestal);
  pedestal.add(cylinder(kit.iron, 0.09, 0.16, 1.0, [0, 0.5, 0], 10));
  const desk = new THREE.Group();
  desk.position.set(0, 1.05, 0);
  desk.rotation.x = -55 * DEG;
  pedestal.add(desk);
  desk.add(box(kit.iron, [1.1, 0.5, 0.06], [0, 0, -0.04]));
  const face = plate(tex.compassFace(), 0.44, 0.44, { metal: true });
  face.rotation.z = -90 * DEG;
  desk.add(face);
  const needle = new THREE.Group();
  needle.position.z = 0.012;
  face.add(needle);
  needle.add(mesh(new THREE.BoxGeometry(0.025, 0.2, 0.008), new THREE.MeshStandardMaterial({ color: 0x8a1f16 }), [0, 0.08, 0], { cast: false }));
  needle.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 10).rotateX(Math.PI / 2), kit.iron, undefined, { cast: false }));
  const arrows = [-1, 1].map((side) => {
    const arrow = mesh(new THREE.ConeGeometry(0.1, 0.17, 3), kit.brass, [side * 0.4, 0, 0.03], { cast: false });
    arrow.rotation.z = -side * 90 * DEG;
    arrow.scale.z = 0.35;
    desk.add(arrow);
    const target = hitBox(kit, [0.3, 0.44, 0.24], [side * 0.4, 0, 0.06]);
    desk.add(target);
    return { arrow, target };
  });

  const yaw = new EasedAngle(0, 2.2);
  const pitch = new Eased(-2 * DEG, 2.2);
  const reach = new Eased(FOCUS_LENGTH, 2.2);
  const power = new Eased(0, 1.2);
  const focus = new Eased(0, 2);
  const needleAngle = new EasedAngle(0, 5);

  const dome = SITES.observatory;
  const domeTop = new THREE.Vector3(dome.x, heightAt(dome.x, dome.z) + DOME_TOP, dome.z);
  const stackTop = new THREE.Vector3(SITES.stack.x + 3, 13, SITES.stack.z);
  const aim = (target: THREE.Vector3): { pitch: number; reach: number } => {
    const flat = Math.hypot(target.x - lampCentre.x, target.z - lampCentre.z);
    return { pitch: Math.atan2(target.y - lampCentre.y, flat), reach: lampCentre.distanceTo(target) };
  };

  const leftArrow = arrows[0];
  const rightArrow = arrows[1];
  if (!leftArrow || !rightArrow) throw new Error('Lamp wheel is missing an arrow');

  return {
    group: root,
    views: {
      lighthouseBase: viewToward(STANDS.lighthouseBase, SITES.lighthouse),
      lampRoom: {
        position: new THREE.Vector3(site.x - 0.8, floorY + EYE, site.z + 0.2),
        yaw: 270 * DEG,
        pitch: -14 * DEG
      }
    },
    anchors: {
      'lighthouseBase>lighthouseHall': worldPoint(tower, 0, 1.4, 3.7),
      'lampRoom>lighthouseHall': worldPoint(tower, 1.0, FLOOR + 0.25, -1.0)
    },
    hotspots: [
      {
        id: 'lamp-left',
        node: 'lampRoom',
        label: 'Turn The Lamp Left',
        targets: [leftArrow.arrow, leftArrow.target],
        action: () => ({ type: 'turnLamp', delta: -1 })
      },
      {
        id: 'lamp-right',
        node: 'lampRoom',
        label: 'Turn The Lamp Right',
        targets: [rightArrow.arrow, rightArrow.target],
        action: () => ({ type: 'turnLamp', delta: 1 })
      },
      {
        id: 'lamp-cradle',
        node: 'lampRoom',
        label: 'Lens Cradle',
        targets: [cradle, cradleHit],
        marker: cradle,
        isActive: (state) => !state.lensFitted,
        action: () => ({ type: 'fitLens' })
      }
    ],
    sync: (state) => {
      const compass = state.lampDir * 45 * DEG;
      yaw.setTarget(compass);
      needleAngle.setTarget(compass);
      power.target = state.powered ? 1 : 0;
      focus.target = isBeamFocused(state) ? 1 : 0;
      lens.visible = state.lensFitted;
      const target = state.lampDir === LAMP_TO_DOME ? domeTop : state.lampDir === LAMP_TO_STACK ? stackTop : null;
      pitch.target = target ? aim(target).pitch : -2 * DEG;
      reach.target = target ? aim(target).reach : FOCUS_LENGTH;
    },
    update: (dt, time) => {
      head.rotation.y = -yaw.step(dt);
      tilt.rotation.x = pitch.step(dt);
      needle.rotation.z = -needleAngle.step(dt);
      const lit = power.step(dt);
      const tight = focus.step(dt);
      const flicker = 1 + Math.sin(time * 9) * 0.02;
      core.emissiveIntensity = lit * 5 * flicker;
      lampLight.intensity = lit * 7;
      halo.material.opacity = lit * 0.5;
      basicOf(wide).opacity = lit * (1 - tight) * 0.1;
      basicOf(focused).opacity = lit * tight * 0.34;
      focused.scale.set(1, 1, reach.step(dt));
    }
  };
}
