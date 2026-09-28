import * as THREE from 'three';
import {
  bookMesh,
  box,
  combine,
  cylinder,
  DEG,
  glow,
  hitBox,
  mesh,
  roundRoom,
  worldPoint,
  type Area,
  type Kit,
  type Site
} from '../kit.ts';

const ORIGIN = new THREE.Vector3(60, -200, 0);
const RADIUS = 4.6;
const HEIGHT = 5.6;

function bellGeometry(): THREE.BufferGeometry {
  const profile: [number, number][] = [
    [0.02, 0.95],
    [0.2, 0.93],
    [0.32, 0.8],
    [0.38, 0.55],
    [0.44, 0.3],
    [0.56, 0.1],
    [0.7, 0],
    [0.64, 0.02],
    [0.5, 0.14]
  ];
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    36
  );
}

/** A tuning fork, standing on its stem. */
export function forkMesh(material: THREE.Material): THREE.Group {
  const fork = new THREE.Group();
  fork.add(cylinder(material, 0.014, 0.014, 0.26, [0, 0.13, 0], 8));
  fork.add(box(material, [0.12, 0.025, 0.025], [0, 0.27, 0]));
  [-0.05, 0.05].forEach((x) => fork.add(box(material, [0.022, 0.4, 0.022], [x, 0.47, 0])));
  return fork;
}

export function buildVault(kit: Kit, glowTex: THREE.Texture): Area {
  const group = new THREE.Group();
  group.position.copy(ORIGIN);

  const walls = kit.rock.clone();
  walls.map = kit.tiled(kit.rockTex, 6, 2);
  const floor = kit.stoneDark.clone();
  floor.map = kit.tiled(kit.stoneTex, 4, 4);
  group.add(roundRoom(RADIUS, HEIGHT, walls, floor));
  const ceiling = mesh(new THREE.CircleGeometry(RADIUS, 40), walls, [0, HEIGHT, 0], { cast: false });
  ceiling.rotation.x = Math.PI / 2;
  group.add(ceiling);

  group.add(mesh(new THREE.TorusGeometry(1.75, 0.22, 10, 40), kit.stone, [0, 1.5, RADIUS - 0.1]));
  group.add(mesh(new THREE.CircleGeometry(1.7, 36).rotateY(Math.PI), kit.dark, [0, 1.5, RADIUS - 0.16], { cast: false }));

  [-1.4, 1.4].forEach((x) => group.add(box(kit.woodDark, [0.24, 4.0, 0.24], [x, 2.0, -0.6])));
  group.add(box(kit.woodDark, [3.3, 0.26, 0.3], [0, 4.0, -0.6]));
  group.add(cylinder(kit.stoneDark, 1.9, 2.1, 0.2, [0, 0.1, -0.6], 32));

  const bell = new THREE.Group();
  bell.position.set(0, 3.86, -0.6);
  group.add(bell);
  const bronze = kit.bronze.clone();
  bronze.side = THREE.DoubleSide;
  const body = mesh(bellGeometry(), bronze, [0, -1.75, 0]);
  body.scale.setScalar(1.55);
  bell.add(body);
  bell.add(cylinder(kit.iron, 0.04, 0.04, 0.3, [0, -0.15, 0], 8));
  bell.add(cylinder(kit.iron, 0.025, 0.025, 1.3, [0, -0.95, 0], 8));
  bell.add(mesh(new THREE.SphereGeometry(0.11, 12, 10), kit.iron, [0, -1.62, 0]));
  const rope = cylinder(kit.paper, 0.02, 0.02, 1.3, [0, -2.3, 0], 6);
  bell.add(rope);
  bell.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), kit.woodDark, [0, -2.96, 0]));
  const bellHit = hitBox(kit, [2.3, 3.4, 1.4], [0, -1.6, 0]);
  bell.add(bellHit);

  const stand = new THREE.Group();
  stand.position.set(2.5, 0, -0.2);
  group.add(stand);
  stand.add(cylinder(kit.stoneDark, 0.24, 0.32, 1.0, [0, 0.5, 0], 14));
  stand.add(cylinder(kit.brass, 0.3, 0.26, 0.06, [0, 1.03, 0], 18));
  const steel = new THREE.MeshStandardMaterial({
    color: 0xdfe8ee,
    roughness: 0.2,
    metalness: 1,
    emissive: 0x7fe8dc,
    emissiveIntensity: 0.35
  });
  const fork = forkMesh(steel);
  fork.position.y = 1.06;
  stand.add(fork);
  const forkHit = hitBox(kit, [0.7, 1.1, 0.7], [0, 1.4, 0]);
  stand.add(forkHit);

  group.add(box(kit.stoneDark, [1.1, 0.9, 0.7], [-2.6, 0.45, -0.2]));
  const book = bookMesh(kit);
  book.position.set(-2.6, 0.9, -0.2);
  book.rotation.y = 0.4;
  group.add(book);
  const bookHit = hitBox(kit, [0.8, 0.5, 0.8], [-2.6, 1.05, -0.2]);
  group.add(bookHit);

  const crystals = [35, 145, 215, 325].map((degrees, i) => {
    const a = degrees * DEG;
    const material = kit.crystal.clone();
    const shard = mesh(new THREE.OctahedronGeometry(0.22), material, [Math.sin(a) * 4.3, 2.0 + (i % 2) * 0.7, -Math.cos(a) * 4.3], { cast: false });
    shard.scale.y = 1.8;
    group.add(shard);
    const halo = glow(glowTex, 0x5fe6d2, 1.8);
    halo.material.opacity = 0.35;
    halo.position.copy(shard.position);
    group.add(halo);
    return material;
  });
  [
    [-2.6, -2.2],
    [2.6, 1.6]
  ].forEach(([x, z]) => {
    const light = new THREE.PointLight(0x5fe6d2, 20, 13, 1.6);
    light.position.set(x ?? 0, 2.6, z ?? 0);
    group.add(light);
  });
  const warm = new THREE.PointLight(0xffc98a, 10, 9, 1.8);
  warm.position.set(0, 1.6, 1.6);
  group.add(warm);
  group.add(new THREE.HemisphereLight(0x3d5a5c, 0x0c0e0e, 0.5));

  let swing = 0;
  let speed = 0;
  const site: Site = {
    group,
    views: { vault: { position: worldPoint(group, 0, 1.7, 3.3), yaw: 0, pitch: 3 * DEG } },
    anchors: { 'vault>vaultDoor': worldPoint(group, 0, 1.5, RADIUS - 0.4) },
    hotspots: [
      {
        id: 'bell',
        node: 'vault',
        label: 'Ring The Fog Bell',
        targets: [bellHit],
        marker: worldPoint(bell, 0, -2.75, 0.1),
        action: () => ({ type: 'ringBell' })
      },
      {
        id: 'fork',
        node: 'vault',
        label: 'Tuning Fork',
        targets: [forkHit],
        marker: worldPoint(stand, 0, 1.75, 0),
        isActive: (state) => !state.itemsTaken.includes('fork'),
        action: () => ({ type: 'takeFork' })
      },
      {
        id: 'journal-bell',
        node: 'vault',
        label: 'Read The Journal',
        targets: [book, bookHit],
        marker: worldPoint(group, -2.6, 1.25, -0.2),
        action: () => ({ type: 'readJournal', id: 'bell' })
      }
    ],
    sync: (state) => {
      fork.visible = !state.itemsTaken.includes('fork');
    },
    signal: (event) => {
      if (event.type === 'ending' && event.id === 'ferry') speed += 1.1;
    },
    update: (dt, time) => {
      speed += (-swing * 9 - speed * 0.5) * dt;
      swing += speed * dt;
      bell.rotation.z = swing;
      crystals.forEach((material, i) => (material.emissiveIntensity = 1.4 + Math.sin(time * 1.4 + i * 1.7) * 0.5));
    }
  };
  return combine('vault', { colour: 0x071012, density: 0.03 }, [site]);
}
