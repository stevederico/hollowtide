import * as THREE from 'three';
import { bookMesh, box, cylinder, DEG, hitBox, lampPost, mesh, type Kit, type Site, type View } from '../kit.ts';
import { EYE, heightAt, PIER_TOP, SEA_HIGH, SEA_LOW, STANDS, yawBetween, type Spot } from '../layout.ts';

/** A standing view on the ground at a spot. */
export function groundView(spot: Spot, yawDegrees: number, lift = 0): View {
  return {
    position: new THREE.Vector3(spot.x, heightAt(spot.x, spot.z) + EYE + lift, spot.z),
    yaw: yawDegrees * DEG,
    pitch: 0
  };
}

/** A standing view at a spot that faces a landmark. */
export function viewToward(spot: Spot, target: Spot): View {
  return groundView(spot, yawBetween(spot, target) / DEG);
}

function buildBoat(kit: Kit): THREE.Group {
  const boat = new THREE.Group();
  const hullMaterial = kit.woodDark.clone();
  hullMaterial.side = THREE.DoubleSide;
  const hull = mesh(new THREE.SphereGeometry(1, 18, 9, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), hullMaterial);
  hull.scale.set(0.8, 0.55, 2.1);
  boat.add(hull);
  boat.add(box(kit.wood, [1.4, 0.05, 0.3], [0, -0.12, 0.5]));
  boat.add(box(kit.wood, [1.3, 0.05, 0.3], [0, -0.12, -0.7]));
  const oar = cylinder(kit.wood, 0.03, 0.03, 2.6, [0.5, 0.0, 0.2], 6);
  oar.rotation.set(Math.PI / 2, 0, 0.5);
  boat.add(oar);
  boat.rotation.set(0.12, 0.5, 0.38);
  return boat;
}

export function buildDock(kit: Kit, globe: THREE.Material): Site {
  const group = new THREE.Group();

  const boards = kit.tiled(kit.plankTex, 7, 1);
  boards.rotation = Math.PI / 2;
  const deckMaterial = kit.wood.clone();
  deckMaterial.map = boards;
  group.add(box(deckMaterial, [3.2, 0.16, 21], [0, PIER_TOP - 0.08, 59.5]));
  group.add(box(kit.woodDark, [0.18, 0.2, 21], [-1.5, PIER_TOP - 0.26, 59.5]));
  group.add(box(kit.woodDark, [0.18, 0.2, 21], [1.5, PIER_TOP - 0.26, 59.5]));
  for (let z = 50; z <= 70; z += 4) {
    [-1.55, 1.55].forEach((x) => {
      const tall = z === 70 || z === 58;
      const height = tall ? 8 : 6.8;
      group.add(cylinder(kit.woodDark, 0.16, 0.19, height, [x, PIER_TOP - 6.6 + height / 2, z], 8));
    });
  }

  const crate = box(kit.wood, [0.9, 0.7, 0.9], [1.0, PIER_TOP + 0.35, 60.4]);
  crate.rotation.y = 0.3;
  group.add(crate);
  group.add(box(kit.woodDark, [0.6, 0.45, 0.6], [1.15, PIER_TOP + 0.225, 59.3]));
  const coil = mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 20), kit.paper, [-1.0, PIER_TOP + 0.07, 61.5]);
  coil.rotation.x = Math.PI / 2;
  group.add(coil);

  const book = bookMesh(kit);
  book.position.set(1.0, PIER_TOP + 0.7, 60.4);
  book.rotation.y = -0.5;
  group.add(book);
  const bookHit = hitBox(kit, [0.7, 0.5, 0.7], [1.0, PIER_TOP + 0.85, 60.4]);
  group.add(bookHit);

  const endLamp = lampPost(kit, globe, 3.4);
  endLamp.position.set(-1.35, PIER_TOP, 68.6);
  group.add(endLamp);
  const shoreLamp = lampPost(kit, globe, 3.4);
  shoreLamp.position.set(1.9, heightAt(1.9, 49) - 0.1, 49);
  shoreLamp.rotation.y = Math.PI;
  group.add(shoreLamp);

  const boat = buildBoat(kit);
  const boatSpot = { x: -3.6, z: 59.6 };
  const seabed = heightAt(boatSpot.x, boatSpot.z);
  boat.position.set(boatSpot.x, 0, boatSpot.z);
  group.add(boat);
  const boatHit = hitBox(kit, [2.4, 1.6, 4.4], [boatSpot.x, 0.2, boatSpot.z]);
  group.add(boatHit);
  let sea = SEA_HIGH;

  return {
    group,
    views: {
      dock: { position: new THREE.Vector3(STANDS.dock.x, PIER_TOP + EYE, STANDS.dock.z), yaw: 0, pitch: 0 },
      beach: groundView(STANDS.beach, 0)
    },
    hotspots: [
      {
        id: 'journal-arrival',
        node: 'dock',
        label: 'Read The Note',
        targets: [book, bookHit],
        marker: new THREE.Vector3(1.0, PIER_TOP + 1.0, 60.4),
        action: () => ({ type: 'readJournal', id: 'arrival' })
      },
      {
        id: 'boat',
        node: 'dock',
        label: 'Your Boat',
        targets: [boat, boatHit],
        action: () => ({
          type: 'examine',
          text: 'Your boat. The hull is split along the keel. It will not float again.'
        })
      }
    ],
    sync: (state) => {
      sea = state.tide === 'low' ? SEA_LOW : SEA_HIGH;
    },
    update: (dt) => {
      const rest = Math.max(sea - 0.05, seabed + 0.45);
      boat.position.y += (rest - boat.position.y) * Math.min(1, dt * 0.5);
      boatHit.position.y = boat.position.y + 0.2;
    }
  };
}
