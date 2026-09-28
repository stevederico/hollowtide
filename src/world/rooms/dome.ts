import * as THREE from 'three';
import { GLYPH_COUNT, RING_ORDERS, VAULT_CODE } from '../../game/constants.ts';
import { isCodeProjected, isDomeLit } from '../../game/state.ts';
import {
  bookMesh,
  box,
  combine,
  cylinder,
  DEG,
  Eased,
  EasedAngle,
  glow,
  hitBox,
  lampMaterial,
  mesh,
  plate,
  roundRoom,
  worldPoint,
  type Area,
  type Hotspot,
  type Kit,
  type Site
} from '../kit.ts';
import * as tex from '../textures.ts';

const ORIGIN = new THREE.Vector3(0, -200, 0);
const RADIUS = 5;
const WALL = 3.6;
const TABLE = 0.95;
/** Bands are 0.42 m wide so each stays a finger wide in a portrait phone close-up. */
const RINGS = [
  { inner: 1.18, outer: 1.6, glyph: 0.32 },
  { inner: 0.74, outer: 1.16, glyph: 0.3 },
  { inner: 0.3, outer: 0.72, glyph: 0.26 }
];
const TABLE_RADIUS = 1.72;
const DIAL_EYE = { y: 3.45, z: 0.55 };
const STEP = (Math.PI * 2) / GLYPH_COUNT;

/** Satin metals for the dial, so glare never hides a glyph. */
const DIAL_METALS = [
  new THREE.MeshStandardMaterial({ color: 0xc09a4c, roughness: 0.62, metalness: 0.75 }),
  new THREE.MeshStandardMaterial({ color: 0x8b6a3c, roughness: 0.62, metalness: 0.75 })
];

function buildRing(index: number, faces: THREE.Texture[]): THREE.Group {
  const spec = RINGS[index];
  const order = RING_ORDERS[index];
  const ring = new THREE.Group();
  if (!spec || !order) return ring;
  const band = mesh(new THREE.RingGeometry(spec.inner, spec.outer, 56), DIAL_METALS[index % 2]);
  band.rotation.x = -Math.PI / 2;
  band.name = 'band';
  ring.add(band);
  order.forEach((glyph, slot) => {
    const holder = new THREE.Group();
    holder.rotation.y = -slot * STEP;
    ring.add(holder);
    const face = plate(faces[glyph] ?? new THREE.Texture(), spec.glyph, spec.glyph);
    face.rotation.x = -Math.PI / 2;
    face.position.set(0, 0.006, -(spec.inner + spec.outer) / 2);
    holder.add(face);
  });
  ring.position.y = TABLE + 0.02 + index * 0.012;
  return ring;
}

export function buildDome(kit: Kit, glowTex: THREE.Texture): Area {
  const group = new THREE.Group();
  group.position.copy(ORIGIN);

  const walls = kit.stone.clone();
  walls.map = kit.tiled(kit.stoneTex, 8, 1.5);
  const floor = kit.stoneDark.clone();
  floor.map = kit.tiled(kit.stoneTex, 4, 4);
  group.add(roundRoom(RADIUS, WALL, walls, floor));
  const chart = new THREE.MeshStandardMaterial({ map: tex.starChart(), roughness: 1, side: THREE.BackSide });
  group.add(mesh(new THREE.SphereGeometry(RADIUS, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), chart, [0, WALL, 0], { cast: false }));
  const rim = mesh(new THREE.TorusGeometry(RADIUS - 0.05, 0.1, 8, 48), kit.iron, [0, WALL, 0]);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  group.add(box(kit.stoneDark, [1.9, 2.8, 0.4], [0, 1.4, RADIUS - 0.12]));
  group.add(box(kit.woodDark, [1.25, 2.3, 0.14], [0, 1.2, RADIUS - 0.3]));

  group.add(cylinder(kit.stoneDark, 0.5, 0.65, TABLE - 0.06, [0, (TABLE - 0.06) / 2, 0], 20));
  group.add(cylinder(kit.woodDark, TABLE_RADIUS, TABLE_RADIUS, 0.08, [0, TABLE - 0.03, 0], 48));
  group.add(cylinder(DIAL_METALS[1], 0.28, 0.28, 0.05, [0, TABLE + 0.03, 0], 24));
  const pointer = mesh(new THREE.ConeGeometry(0.1, 0.3, 4), kit.copper, [0, TABLE + 0.05, -TABLE_RADIUS + 0.04]);
  pointer.rotation.x = Math.PI / 2;
  pointer.scale.z = 0.4;
  group.add(pointer);

  const faces = Array.from({ length: GLYPH_COUNT }, (_, glyph) => tex.glyphTexture(glyph, tex.BRASS_PLATE));
  const hotspots: Hotspot[] = [];
  const rings = RINGS.map((_, index) => {
    const ring = buildRing(index, faces);
    group.add(ring);
    hotspots.push({
      id: `ring-${index}`,
      node: 'starDial',
      label: ['Outer Ring', 'Middle Ring', 'Inner Ring'][index] ?? 'Ring',
      targets: [ring],
      probe: worldPoint(group, 0, TABLE + 0.03, ((RINGS[index]?.inner ?? 0) + (RINGS[index]?.outer ?? 0)) / 2),
      action: () => ({ type: 'rotateRing', ring: index, delta: 1 })
    });
    return { ring, angle: new EasedAngle(0, 7) };
  });

  const lectern = new THREE.Group();
  lectern.position.set(-2.6, 0, 0.5);
  lectern.rotation.y = 35 * DEG;
  group.add(lectern);
  lectern.add(box(kit.woodDark, [0.16, 1.05, 0.16], [0, 0.52, 0]));
  lectern.add(box(kit.woodDark, [0.5, 0.06, 0.5], [0, 0.03, 0]));
  const top = box(kit.wood, [0.6, 0.04, 0.5], [0, 1.08, 0]);
  top.rotation.x = 0.35;
  lectern.add(top);
  const book = bookMesh(kit);
  book.position.set(0, 1.11, 0.02);
  book.rotation.x = 0.35;
  lectern.add(book);
  const bookHit = hitBox(kit, [0.8, 0.7, 0.8], [0, 1.2, 0]);
  lectern.add(bookHit);

  const scope = new THREE.Group();
  scope.position.set(3.0, 0, -1.2);
  group.add(scope);
  scope.add(cylinder(kit.iron, 0.2, 0.34, 1.5, [0, 0.75, 0], 12));
  const tube = cylinder(kit.brass, 0.2, 0.26, 3.6, [0.2, 2.5, -0.3], 18);
  tube.rotation.set(-0.5, 0, -0.35);
  scope.add(tube);

  const sconce = lampMaterial(0xffc27a);
  const sconces = [60, 180, 300].map((degrees) => {
    const a = degrees * DEG;
    group.add(mesh(new THREE.SphereGeometry(0.1, 12, 10), sconce, [Math.sin(a) * 4.8, 2.7, -Math.cos(a) * 4.8], { cast: false }));
    const light = new THREE.PointLight(0xffb469, 0, 10, 1.8);
    light.position.set(Math.sin(a) * 4.3, 2.7, -Math.cos(a) * 4.3);
    group.add(light);
    return light;
  });
  const moon = new THREE.PointLight(0x7f9fd6, 30, 18, 1.5);
  moon.position.set(1.5, 6.5, -1);
  group.add(moon);
  group.add(new THREE.HemisphereLight(0x4e5d78, 0x12100e, 0.6));

  const crystalMaterial = kit.crystal.clone();
  const crystal = mesh(new THREE.OctahedronGeometry(0.4), crystalMaterial, [0, WALL + RADIUS - 0.7, 0], { cast: false });
  crystal.scale.y = 1.5;
  group.add(crystal);
  const halo = glow(glowTex, 0x7ff5e2, 5);
  halo.position.copy(crystal.position);
  group.add(halo);
  const shaft = mesh(
    new THREE.CylinderGeometry(0.08, 0.28, WALL + RADIUS - 0.7 - TABLE, 24, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0x6fe8d6,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    }),
    [0, (WALL + RADIUS - 0.7 + TABLE) / 2, 0],
    { cast: false }
  );
  group.add(shaft);
  const tealLight = new THREE.PointLight(0x5fe6d2, 0, 14, 1.6);
  tealLight.position.set(0, 4.6, -1.2);
  group.add(tealLight);

  const code = plate(tex.codeTexture(VAULT_CODE), 3.6, 0.9, { glow: true });
  code.position.set(0, 2.45, -RADIUS + 0.55);
  group.add(code);

  const lit = new Eased(0, 1.4);
  const shown = new Eased(0, 1.2);
  const power = new Eased(0, 1);

  const site: Site = {
    group,
    views: {
      observatory: { position: worldPoint(group, 0, 1.7, 3.4), yaw: 0, pitch: 2 * DEG },
      starDial: {
        position: worldPoint(group, 0, DIAL_EYE.y, DIAL_EYE.z),
        yaw: 0,
        pitch: -Math.atan2(DIAL_EYE.y - TABLE, DIAL_EYE.z),
        frameWidth: TABLE_RADIUS * 2,
        frameHeight: TABLE_RADIUS * 2 + 0.6,
        distance: Math.hypot(DIAL_EYE.y - TABLE, DIAL_EYE.z)
      }
    },
    anchors: {
      'observatory>observatoryYard': worldPoint(group, 0, 1.4, RADIUS - 0.5),
      'observatory>starDial': worldPoint(group, 0, TABLE + 0.35, 0)
    },
    hotspots: [
      ...hotspots,
      {
        id: 'journal-stars',
        node: 'observatory',
        label: 'Read The Journal',
        targets: [book, bookHit],
        marker: worldPoint(lectern, 0, 1.45, 0),
        action: () => ({ type: 'readJournal', id: 'stars' })
      }
    ],
    sync: (state) => {
      rings.forEach((entry, i) => entry.angle.setTarget((state.rings[i] ?? 0) * STEP));
      lit.target = isDomeLit(state) ? 1 : 0;
      shown.target = isCodeProjected(state) ? 1 : 0;
      power.target = state.powered ? 1 : 0;
    },
    update: (dt, time) => {
      rings.forEach((entry) => (entry.ring.rotation.y = entry.angle.step(dt)));
      const glowing = lit.step(dt);
      const pulse = 1 + Math.sin(time * 2.1) * 0.12;
      crystalMaterial.emissiveIntensity = 0.2 + glowing * 3.5 * pulse;
      halo.material.opacity = glowing * 0.6;
      if (shaft.material instanceof THREE.MeshBasicMaterial) shaft.material.opacity = glowing * 0.018 * pulse;
      tealLight.intensity = glowing * 10;
      if (code.material instanceof THREE.MeshBasicMaterial) code.material.opacity = shown.step(dt) * (0.85 + Math.sin(time * 1.3) * 0.1);
      const level = power.step(dt);
      sconce.emissiveIntensity = level * 3;
      sconces.forEach((light) => (light.intensity = level * 12));
    }
  };
  return combine('observatory', { colour: 0x0a0d14, density: 0.025 }, [site]);
}
