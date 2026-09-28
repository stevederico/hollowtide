import * as THREE from 'three';
import { box, cylinder, lampPost, plate, type Kit, type Site } from '../kit.ts';
import { heightAt, STANDS, yawBetween, type Spot } from '../layout.ts';
import * as tex from '../textures.ts';
import { groundView } from './dock.ts';

const SIGNS: readonly { text: string; to: Spot }[] = [
  { text: 'DOCK', to: STANDS.beach },
  { text: 'ENGINE', to: STANDS.engineYard },
  { text: 'TOWER', to: STANDS.lighthouseBase },
  { text: 'STONES', to: STANDS.garden },
  { text: 'DOME', to: STANDS.observatoryYard }
];

const LAMPS: readonly [number, number, number][] = [
  [-2.6, 33, 1.4],
  [2.4, 21.5, 3.6],
  [-19, 23.4, 0.3],
  [21, 10.4, -2.4],
  [-9, -2.6, 2.4],
  [8.6, -5, -0.6],
  [25, -26, 2],
  [39.6, -13, 3.1],
  [-37, -8.6, 1.2],
  [30.6, -33.6, 0.8],
  [-52, -1.6, 2.6]
];

function buildSignpost(kit: Kit): THREE.Group {
  const post = new THREE.Group();
  const spot = { x: 2.6, z: 16.2 };
  post.position.set(spot.x, heightAt(spot.x, spot.z) - 0.1, spot.z);
  post.add(cylinder(kit.woodDark, 0.09, 0.12, 3.4, [0, 1.7, 0], 8));
  SIGNS.forEach((sign, i) => {
    const arm = new THREE.Group();
    arm.position.y = 3.15 - i * 0.36;
    // Boards point along local +x, so turn +x toward the destination.
    arm.rotation.y = Math.PI / 2 - yawBetween(spot, sign.to);
    post.add(arm);
    arm.add(box(kit.woodDark, [1.3, 0.3, 0.05], [0.75, 0, 0]));
    const texture = tex.signTexture(sign.text);
    [1, -1].forEach((side) => {
      const face = plate(texture, 1.24, 0.27);
      face.position.set(0.75, 0, side * 0.03);
      face.rotation.y = side === 1 ? 0 : Math.PI;
      arm.add(face);
    });
  });
  return post;
}

/** Footpath furniture: the crossroads sign and the lamps along the paths. */
export function buildPaths(kit: Kit, globe: THREE.Material): Site {
  const group = new THREE.Group();
  group.add(buildSignpost(kit));
  LAMPS.forEach(([x, z, turn]) => {
    const lamp = lampPost(kit, globe);
    lamp.position.set(x, heightAt(x, z) - 0.1, z);
    lamp.rotation.y = turn;
    group.add(lamp);
  });
  return {
    group,
    views: { crossroads: groundView(STANDS.crossroads, 0) }
  };
}

/** Warm pools of light that come on with the power. */
export function buildPowerLights(): { group: THREE.Group; setLevel(level: number): void } {
  const group = new THREE.Group();
  const spots: [number, number][] = [
    [1.6, 20.6],
    [-39, 23],
    [42.4, 2.4],
    [9.4, -28.6],
    [-15.6, -16.4],
    [0.6, 50]
  ];
  const lights = spots.map(([x, z]) => {
    const light = new THREE.PointLight(0xffb469, 0, 26, 1.8);
    light.position.set(x, heightAt(x, z) + 3, z);
    group.add(light);
    return light;
  });
  return {
    group,
    setLevel: (level) => lights.forEach((light) => (light.intensity = level * 42))
  };
}
