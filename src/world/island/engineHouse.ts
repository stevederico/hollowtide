import * as THREE from 'three';
import { SIGN_ENGINE } from '../../game/constants.ts';
import { gateFlow } from '../../game/state.ts';
import { box, cylinder, DEG, faceViewer, lampPost, mesh, plate, worldPoint, type Kit, type Site } from '../kit.ts';
import { heightAt, SITES, STANDS } from '../layout.ts';
import * as tex from '../textures.ts';
import { viewToward } from './dock.ts';

/** A gabled roof: triangle profile pushed along the depth. */
export function gableRoof(width: number, rise: number, depth: number, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  return mesh(geometry, material);
}

function buildWheel(kit: Kit): THREE.Group {
  const wheel = new THREE.Group();
  [-0.5, 0.5].forEach((x) => {
    const rim = mesh(new THREE.TorusGeometry(2.2, 0.09, 8, 36), kit.woodDark, [x, 0, 0]);
    rim.rotation.y = Math.PI / 2;
    wheel.add(rim);
  });
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const paddle = box(kit.wood, [1.1, 0.06, 0.6], [0, Math.sin(angle) * 2.1, Math.cos(angle) * 2.1]);
    paddle.rotation.x = -angle;
    wheel.add(paddle);
    const spoke = box(kit.woodDark, [0.08, 0.08, 2.1], [0, Math.sin(angle) * 1.05, Math.cos(angle) * 1.05]);
    spoke.rotation.x = -angle;
    wheel.add(spoke);
  }
  const axle = cylinder(kit.iron, 0.14, 0.14, 2.2, [0, 0, 0], 10);
  axle.rotation.z = Math.PI / 2;
  wheel.add(axle);
  return wheel;
}

export function buildEngineHouse(kit: Kit, globe: THREE.Material, windows: THREE.Material): Site {
  const group = new THREE.Group();
  const site = SITES.engineHouse;
  const ground = heightAt(site.x, site.z);
  group.position.set(site.x, ground - 0.1, site.z);
  faceViewer(group, 270 * DEG);

  group.add(box(kit.stone, [8, 4.2, 7], [0, 2.1, 0]));
  group.add(box(kit.stoneDark, [8.5, 0.5, 7.5], [0, 0.15, 0]));
  const roof = gableRoof(9, 2.6, 8, kit.slate);
  roof.position.y = 4.2;
  group.add(roof);
  group.add(box(kit.stone, [0.9, 2.6, 0.9], [2.6, 6.2, -1.5]));
  group.add(box(kit.stoneDark, [1.1, 0.2, 1.1], [2.6, 7.5, -1.5]));

  group.add(box(kit.stoneDark, [1.9, 2.8, 0.3], [0, 1.4, 3.45]));
  group.add(box(kit.woodDark, [1.3, 2.3, 0.14], [0, 1.25, 3.58]));
  group.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), kit.brass, [0.45, 1.2, 3.68]));
  const sign = plate(tex.glyphTexture(SIGN_ENGINE, tex.CARVED), 0.85, 0.85);
  sign.position.set(0, 3.35, 3.53);
  group.add(sign);
  [-2.6, 2.6].forEach((x) => {
    group.add(box(kit.stoneDark, [1.1, 1.4, 0.2], [x, 2.3, 3.45]));
    group.add(mesh(new THREE.PlaneGeometry(0.8, 1.1), windows, [x, 2.3, 3.56], { cast: false }));
  });

  const pipe = cylinder(kit.iron, 0.42, 0.42, 16, [-1.5, 0.5, -10.5], 14);
  pipe.rotation.x = Math.PI / 2 + 0.16;
  group.add(pipe);
  [-6, -10, -14].forEach((z) => group.add(box(kit.stoneDark, [1.2, 2.4, 0.7], [-1.5, 0.2 + (z + 6) * 0.16, z])));

  const wheel = buildWheel(kit);
  wheel.position.set(5.1, 1.5, -0.5);
  group.add(wheel);
  group.add(box(kit.stoneDark, [0.5, 2.2, 1.0], [6.0, 0.6, -0.5]));
  group.add(box(kit.stoneDark, [1.6, 0.6, 5.2], [5.1, -0.35, -0.5]));

  const lamp = lampPost(kit, globe);
  lamp.position.set(-2.4, 0.1, 5.2);
  lamp.rotation.y = -0.6;
  group.add(lamp);

  let spin = 0;
  return {
    group,
    views: { engineYard: viewToward(STANDS.engineYard, SITES.engineHouse) },
    anchors: { 'engineYard>engineRoom': worldPoint(group, 0, 1.4, 3.8) },
    sync: (state) => {
      spin = state.powered ? 0.9 : gateFlow(state) > 0 ? 0.25 : 0;
    },
    update: (dt) => {
      wheel.rotation.x += spin * dt;
    }
  };
}
