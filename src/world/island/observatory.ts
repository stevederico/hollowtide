import * as THREE from 'three';
import { GLYPH } from '../../game/constants.ts';
import { isDomeLit } from '../../game/state.ts';
import { box, cylinder, Eased, glow, lampPost, mesh, plate, worldPoint, type Kit, type Site } from '../kit.ts';
import { heightAt, SITES, STANDS } from '../layout.ts';
import * as tex from '../textures.ts';
import { viewToward } from './dock.ts';

const WALL_RADIUS = 5.2;
const WALL_HEIGHT = 4;

export function buildObservatory(kit: Kit, globe: THREE.Material, windows: THREE.Material, glowTex: THREE.Texture): Site {
  const group = new THREE.Group();
  const site = SITES.observatory;
  const ground = heightAt(site.x, site.z);
  group.position.set(site.x, ground - 0.15, site.z);

  const wallMaterial = kit.stone.clone();
  wallMaterial.map = kit.tiled(kit.stoneTex, 8, 1.5);
  group.add(cylinder(wallMaterial, WALL_RADIUS, WALL_RADIUS, WALL_HEIGHT, [0, WALL_HEIGHT / 2, 0], 40));
  group.add(cylinder(kit.stoneDark, WALL_RADIUS + 0.4, WALL_RADIUS + 0.6, 0.6, [0, 0.2, 0], 40));
  group.add(cylinder(kit.iron, WALL_RADIUS + 0.15, WALL_RADIUS + 0.15, 0.25, [0, WALL_HEIGHT, 0], 40));

  const verdigris = new THREE.MeshStandardMaterial({ color: 0x4f8273, roughness: 0.6, metalness: 0.6 });
  const dome = mesh(new THREE.SphereGeometry(WALL_RADIUS, 40, 18, 0, Math.PI * 2, 0, Math.PI / 2), verdigris, [0, WALL_HEIGHT, 0]);
  group.add(dome);
  const slit = mesh(
    new THREE.SphereGeometry(WALL_RADIUS + 0.04, 6, 18, Math.PI * 0.2, 0.2, 0.12, Math.PI / 2 - 0.2),
    kit.dark,
    [0, WALL_HEIGHT, 0],
    { cast: false }
  );
  group.add(slit);
  for (let i = 0; i < 12; i++) {
    const rib = mesh(new THREE.TorusGeometry(WALL_RADIUS + 0.02, 0.05, 6, 24, Math.PI), kit.copper, [0, WALL_HEIGHT, 0]);
    rib.rotation.y = (i / 12) * Math.PI;
    group.add(rib);
  }

  group.add(box(kit.stoneDark, [2.0, 3.0, 0.6], [0, 1.5, WALL_RADIUS - 0.1]));
  group.add(box(kit.woodDark, [1.3, 2.3, 0.2], [0, 1.3, WALL_RADIUS + 0.16]));
  group.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), kit.brass, [0.45, 1.25, WALL_RADIUS + 0.3]));
  const sign = plate(tex.glyphTexture(GLYPH.sun, tex.CARVED), 0.8, 0.8);
  sign.position.set(0, 3.45, WALL_RADIUS + 0.21);
  group.add(sign);
  [0.5, 1.1].forEach((z, i) => group.add(box(kit.stoneDark, [2.6 + i * 0.5, 0.2, 0.7], [0, 0.1 - i * 0.18, WALL_RADIUS + z])));
  [-1, 1].forEach((side) => {
    const angle = side * 0.9;
    const pane = mesh(new THREE.PlaneGeometry(0.6, 1.2), windows, undefined, { cast: false });
    pane.position.set(Math.sin(angle) * (WALL_RADIUS + 0.03), 2.3, Math.cos(angle) * (WALL_RADIUS + 0.03));
    pane.rotation.y = angle;
    group.add(pane);
  });

  group.add(cylinder(kit.brass, 0.12, 0.3, 0.7, [0, WALL_HEIGHT + WALL_RADIUS + 0.3, 0], 10));
  const crystalMaterial = kit.crystal.clone();
  const crystal = mesh(new THREE.OctahedronGeometry(0.55), crystalMaterial, [0, WALL_HEIGHT + WALL_RADIUS + 1.15, 0]);
  crystal.scale.y = 1.5;
  group.add(crystal);
  const halo = glow(glowTex, 0x7ff5e2, 14);
  halo.position.copy(crystal.position);
  group.add(halo);

  const lamp = lampPost(kit, globe);
  lamp.position.set(-3.2, 0.1, WALL_RADIUS + 2.4);
  lamp.rotation.y = -1.2;
  group.add(lamp);

  const lit = new Eased(0, 1.5);
  return {
    group,
    views: { observatoryYard: viewToward(STANDS.observatoryYard, SITES.observatory) },
    anchors: { 'observatoryYard>observatory': worldPoint(group, 0, 1.5, WALL_RADIUS + 0.4) },
    sync: (state) => {
      lit.target = isDomeLit(state) ? 1 : 0;
    },
    update: (dt, time) => {
      const value = lit.step(dt);
      crystalMaterial.emissiveIntensity = 0.2 + value * (3.2 + Math.sin(time * 2.3) * 0.5);
      halo.material.opacity = value * 0.6;
      crystal.rotation.y = time * 0.3;
    }
  };
}
