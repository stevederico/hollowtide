import * as THREE from 'three';
import {
  bookMesh,
  box,
  combine,
  cylinder,
  Eased,
  glow,
  hitBox,
  mesh,
  worldPoint,
  type Area,
  type Kit,
  type Site
} from '../kit.ts';
import { mulberry32 } from '../noise.ts';
import { boulderGeometry } from '../terrain.ts';
import { forkMesh } from './vault.ts';

const ORIGIN = new THREE.Vector3(120, -200, 0);
const HEART_Y = 2.7;

export function buildGrotto(kit: Kit, glowTex: THREE.Texture): Area {
  const group = new THREE.Group();
  group.position.copy(ORIGIN);

  const cave = kit.rock.clone();
  cave.map = kit.tiled(kit.rockTex, 5, 3);
  cave.side = THREE.BackSide;
  const shell = mesh(boulderGeometry(17, 4, 0.22), cave, [0, 2.2, 0], { cast: false });
  shell.scale.set(7.2, 4.6, 7.2);
  group.add(shell);
  const floorMaterial = kit.rock.clone();
  floorMaterial.map = kit.tiled(kit.rockTex, 4, 4);
  const floor = mesh(new THREE.CircleGeometry(7.4, 40), floorMaterial, [0, 0, 0]);
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  const rand = mulberry32(55);
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const r = 3.6 + rand() * 2.6;
    const size = 0.3 + rand() * 0.7;
    const rock = mesh(boulderGeometry(70 + i, 1, 0.3), kit.rock, [Math.sin(a) * r, size * 0.3, Math.cos(a) * r - 0.6]);
    rock.scale.set(size, size * 0.8, size);
    if (Math.abs(rock.position.x) < 1.2 && rock.position.z > 1.5) continue;
    group.add(rock);
  }

  const poolMaterial = new THREE.MeshStandardMaterial({
    color: 0x0c3a3a,
    emissive: 0x2fd6c2,
    emissiveIntensity: 0.3,
    roughness: 0.1,
    metalness: 0.4,
    transparent: true,
    opacity: 0.92
  });
  const pool = mesh(new THREE.CircleGeometry(2.7, 40), poolMaterial, [0, 0.03, -1.4], { cast: false });
  pool.rotation.x = -Math.PI / 2;
  group.add(pool);
  const lip = mesh(new THREE.TorusGeometry(2.75, 0.16, 8, 40), kit.stoneDark, [0, 0.04, -1.4]);
  lip.rotation.x = Math.PI / 2;
  group.add(lip);

  const heart = new THREE.Group();
  heart.position.set(0, HEART_Y, -1.4);
  group.add(heart);
  const heartMaterial = kit.crystal.clone();
  const gem = mesh(new THREE.OctahedronGeometry(0.75, 0), heartMaterial, undefined, { cast: false });
  gem.scale.y = 1.6;
  heart.add(gem);
  const rings = [1.35, 1.6, 1.85].map((radius, i) => {
    const ring = mesh(new THREE.TorusGeometry(radius, 0.035, 8, 56), kit.brass);
    ring.rotation.set(i * 1.1, i * 0.7, 0);
    heart.add(ring);
    return ring;
  });
  const halo = glow(glowTex, 0x6ff2de, 9);
  heart.add(halo);
  const heartLight = new THREE.PointLight(0x5fe6d2, 10, 20, 1.5);
  heart.add(heartLight);
  group.add(new THREE.HemisphereLight(0x2e4a4c, 0x0a0c0c, 0.5));
  const entry = new THREE.PointLight(0x7f9fd6, 8, 9, 1.8);
  entry.position.set(0, 2.2, 4.6);
  group.add(entry);

  const cradle = new THREE.Group();
  cradle.position.set(0, 0, 1.5);
  group.add(cradle);
  cradle.add(cylinder(kit.stoneDark, 0.26, 0.36, 1.05, [0, 0.52, 0], 14));
  cradle.add(cylinder(kit.brass, 0.3, 0.3, 0.05, [0, 1.07, 0], 18));
  [-0.09, 0.09].forEach((x) => cradle.add(box(kit.brass, [0.025, 0.2, 0.06], [x, 1.19, 0])));
  const steel = new THREE.MeshStandardMaterial({
    color: 0xdfe8ee,
    roughness: 0.2,
    metalness: 1,
    emissive: 0x7fe8dc,
    emissiveIntensity: 1.2
  });
  const fork = forkMesh(steel);
  fork.position.y = 1.1;
  fork.visible = false;
  cradle.add(fork);
  const cradleHit = hitBox(kit, [0.9, 1.3, 0.9], [0, 1.3, 0]);
  cradle.add(cradleHit);

  group.add(box(kit.stoneDark, [1.0, 0.7, 0.7], [-1.8, 0.35, 1.3]));
  const book = bookMesh(kit);
  book.position.set(-1.8, 0.7, 1.3);
  book.rotation.y = 0.5;
  group.add(book);
  const bookHit = hitBox(kit, [0.8, 0.5, 0.8], [-1.8, 0.85, 1.3]);
  group.add(bookHit);

  const awake = new Eased(0, 0.7);
  let turn = 0;

  const site: Site = {
    group,
    views: { grotto: { position: worldPoint(group, 0, 1.7, 4.2), yaw: 0, pitch: 4 * (Math.PI / 180) } },
    anchors: { 'grotto>stackLanding': worldPoint(group, 1.6, 1.3, 4.6) },
    hotspots: [
      {
        id: 'cradle',
        node: 'grotto',
        label: 'Brass Cradle',
        targets: [cradleHit],
        marker: worldPoint(cradle, 0, 1.6, 0),
        isActive: (state) => !state.forkPlaced,
        action: () => ({ type: 'placeFork' })
      },
      {
        id: 'journal-heart',
        node: 'grotto',
        label: 'Read The Journal',
        targets: [book, bookHit],
        marker: worldPoint(group, -1.8, 1.05, 1.3),
        action: () => ({ type: 'readJournal', id: 'heart' })
      }
    ],
    sync: (state) => {
      fork.visible = state.forkPlaced;
      awake.target = state.forkPlaced ? 1 : 0;
    },
    update: (dt, time) => {
      const level = awake.step(dt);
      turn += dt * (0.12 + level * 0.9);
      rings.forEach((ring, i) => {
        ring.rotation.x = i * 1.1 + turn * (1 + i * 0.3);
        ring.rotation.y = i * 0.7 + turn * 0.6;
      });
      gem.rotation.y = turn * 0.8;
      heart.position.y = HEART_Y + Math.sin(time * 0.8) * 0.08;
      const beat = 1 + Math.sin(time * (1.2 + level * 2.2)) * (0.15 + level * 0.2);
      heartMaterial.emissiveIntensity = (0.5 + level * 1.6) * beat;
      heartLight.intensity = (10 + level * 14) * beat;
      halo.material.opacity = (0.22 + level * 0.2) * beat;
      poolMaterial.emissiveIntensity = (0.3 + level * 0.5) * beat;
    }
  };
  return combine('grotto', { colour: 0x050d0e, density: 0.03 }, [site]);
}
