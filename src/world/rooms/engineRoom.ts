import * as THREE from 'three';
import { ENGINE_RATING, GATE_FLOWS } from '../../game/constants.ts';
import { gateFlow } from '../../game/state.ts';
import {
  box,
  boxRoom,
  combine,
  cylinder,
  DEG,
  Eased,
  faceViewer,
  hitBox,
  lampMaterial,
  mesh,
  plate,
  worldPoint,
  type Area,
  type Hotspot,
  type Kit
} from '../kit.ts';
import * as tex from '../textures.ts';

const ORIGIN = new THREE.Vector3(-120, -200, 0);
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const LEVER_OPEN = 50 * DEG;
const LEVER_SHUT = 130 * DEG;
const PANEL_WIDTH = 3.4;
const PANEL_HEIGHT = 2.5;
const GATE_SPACING = 0.56;

interface Lever {
  pivot: THREE.Group;
  angle: Eased;
}

/** A lever whose handle swings between two angles about its base. */
function buildLever(kit: Kit, length: number, knob: THREE.Material): Lever {
  const pivot = new THREE.Group();
  pivot.add(cylinder(kit.iron, 0.018, 0.022, length, [0, length / 2, 0], 8));
  pivot.add(mesh(new THREE.SphereGeometry(0.05, 12, 10), knob, [0, length, 0]));
  pivot.rotation.x = LEVER_SHUT;
  return { pivot, angle: new Eased(LEVER_SHUT, 10) };
}

function label(text: string, width: number, height: number, x: number, y: number): THREE.Mesh {
  const result = plate(tex.labelTexture(text, 512, Math.round((512 * height) / width)), width, height, { metal: true });
  result.position.set(x, y, 0.012);
  return result;
}

function buildMachine(kit: Kit): { group: THREE.Group; flywheel: THREE.Group } {
  const group = new THREE.Group();
  group.add(box(kit.iron, [2.6, 1.0, 1.3], [0.4, 0.5, -2.6]));
  group.add(box(kit.stoneDark, [3.4, 0.25, 1.9], [0.2, 0.12, -2.6]));
  const boiler = cylinder(kit.copper, 0.72, 0.72, 3.2, [1.4, 1.75, -2.7], 22);
  boiler.rotation.z = Math.PI / 2;
  group.add(boiler);
  [-0.1, 2.9].forEach((x) => {
    const band = mesh(new THREE.TorusGeometry(0.74, 0.04, 8, 28), kit.brass, [x, 1.75, -2.7]);
    band.rotation.y = Math.PI / 2;
    group.add(band);
  });
  [-0.3, 0.5, 1.3].forEach((x) => group.add(cylinder(kit.brass, 0.13, 0.13, 0.7, [x, 1.2, -2.2], 12)));
  const pipe = cylinder(kit.copper, 0.09, 0.09, 6.2, [-1.4, 3.7, -2.9], 10);
  pipe.rotation.z = Math.PI / 2;
  group.add(pipe);
  group.add(cylinder(kit.copper, 0.09, 0.09, 1.4, [1.6, 3.0, -2.9], 10));
  group.add(cylinder(kit.copper, 0.09, 0.09, 2.2, [-4.3, 2.8, -2.9], 10));

  const flywheel = new THREE.Group();
  flywheel.position.set(-1.7, 1.45, -2.4);
  group.add(flywheel);
  const rim = mesh(new THREE.TorusGeometry(1.15, 0.12, 12, 40), kit.iron);
  rim.rotation.y = Math.PI / 2;
  flywheel.add(rim);
  for (let i = 0; i < 6; i++) {
    const spoke = box(kit.iron, [0.07, 2.2, 0.07], [0, 0, 0]);
    spoke.rotation.x = (i / 6) * Math.PI;
    flywheel.add(spoke);
  }
  const hub = cylinder(kit.brass, 0.18, 0.18, 0.5, [0, 0, 0], 14);
  hub.rotation.z = Math.PI / 2;
  flywheel.add(hub);
  group.add(box(kit.iron, [0.3, 1.45, 0.5], [-1.7, 0.72, -2.4]));
  return { group, flywheel };
}

export function buildEngineRoom(kit: Kit): Area {
  const group = new THREE.Group();
  group.position.copy(ORIGIN);

  const walls = kit.stone.clone();
  walls.map = kit.tiled(kit.stoneTex, 3, 1.5);
  const floor = kit.stoneDark.clone();
  floor.map = kit.tiled(kit.stoneTex, 4, 4);
  const ceiling = kit.woodDark.clone();
  ceiling.map = kit.tiled(kit.plankTex, 3, 1);
  group.add(boxRoom(9, 4.2, 7, walls, floor, ceiling));
  [-2, 0, 2].forEach((z) => group.add(box(kit.woodDark, [9, 0.25, 0.25], [0, 4.05, z])));

  group.add(box(kit.stoneDark, [0.3, 2.8, 1.9], [4.4, 1.4, 0.3]));
  group.add(box(kit.woodDark, [0.12, 2.3, 1.3], [4.3, 1.2, 0.3]));

  const moonlight = new THREE.MeshBasicMaterial({ color: 0x6f8fc0 });
  group.add(box(kit.stoneDark, [1.5, 1.7, 0.2], [-2.4, 2.4, 3.45]));
  const pane = mesh(new THREE.PlaneGeometry(1.1, 1.3), moonlight, [-2.4, 2.4, 3.34], { cast: false });
  pane.rotation.y = Math.PI;
  group.add(pane);
  [-0.18, 0.18].forEach((x) => group.add(box(kit.iron, [0.04, 1.3, 0.04], [-2.4 + x, 2.4, 3.32])));
  const moon = new THREE.PointLight(0x7f9fd6, 16, 14, 1.6);
  moon.position.set(-2.4, 2.5, 2.4);
  group.add(moon);
  group.add(new THREE.HemisphereLight(0x51607a, 0x15130f, 0.55));

  group.add(box(kit.wood, [2.2, 0.08, 0.8], [1.6, 0.9, 3.0]));
  [0.6, 2.6].forEach((x) => group.add(box(kit.woodDark, [0.1, 0.9, 0.7], [x, 0.45, 3.0])));
  group.add(box(kit.iron, [0.5, 0.3, 0.3], [1.2, 1.1, 3.0]));
  group.add(cylinder(kit.brass, 0.08, 0.1, 0.3, [2.1, 1.1, 3.05], 10));

  const machine = buildMachine(kit);
  group.add(machine.group);

  const bulb = lampMaterial(0xffc27a);
  const bulbs = [
    [-2.2, 0.6],
    [1.8, 0.2]
  ].map(([x, z]) => {
    group.add(cylinder(kit.iron, 0.01, 0.01, 0.8, [x ?? 0, 3.8, z ?? 0], 4));
    group.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), bulb, [x ?? 0, 3.35, z ?? 0], { cast: false }));
    const light = new THREE.PointLight(0xffb469, 0, 12, 1.7);
    light.position.set(x ?? 0, 3.2, z ?? 0);
    group.add(light);
    return light;
  });

  // Control panel on the west wall. Local +x runs north, +z faces the room.
  // Laid out as a compact grid so every control stays a finger wide on a phone.
  const panel = new THREE.Group();
  panel.position.set(-4.42, 1.55, 0.2);
  faceViewer(panel, 270 * DEG);
  group.add(panel);
  panel.add(box(kit.woodDark, [PANEL_WIDTH, PANEL_HEIGHT, 0.1], [0, 0, -0.05]));
  panel.add(box(kit.iron, [PANEL_WIDTH + 0.1, 0.08, 0.14], [0, PANEL_HEIGHT / 2, -0.03]));
  panel.add(box(kit.iron, [PANEL_WIDTH + 0.1, 0.08, 0.14], [0, -PANEL_HEIGHT / 2, -0.03]));
  panel.add(box(kit.iron, [PANEL_WIDTH - 0.2, 0.03, 0.03], [0, -0.12, 0.01]));

  const panelGlow = new THREE.PointLight(0xc4d4ff, 4, 8, 1.6);
  panelGlow.position.set(0.4, 0.2, 2.4);
  panel.add(panelGlow);

  const gauge = new THREE.Group();
  gauge.position.set(-0.95, 0.62, 0);
  panel.add(gauge);
  gauge.add(mesh(new THREE.TorusGeometry(0.44, 0.04, 10, 40), kit.brass, [0, 0, 0.02]));
  const face = plate(tex.gaugeFace(), 0.86, 0.86);
  if (face.material instanceof THREE.MeshStandardMaterial) face.material.color.setHex(0xa8a296);
  face.position.z = 0.012;
  gauge.add(face);
  const needle = new THREE.Group();
  needle.position.z = 0.03;
  gauge.add(needle);
  const ink = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.6 });
  needle.add(mesh(new THREE.BoxGeometry(0.018, 0.4, 0.006), ink, [0, 0.14, 0], { cast: false }));
  needle.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 14).rotateX(Math.PI / 2), kit.brass, undefined, { cast: false }));
  panel.add(label(`RATED ${ENGINE_RATING} MARKS`, 0.8, 0.14, -0.95, 0.06));

  const hotspots: Hotspot[] = [];
  const pilot = GATE_FLOWS.map(() => lampMaterial(0xffb040));
  const gates = GATE_FLOWS.map((_, index) => {
    const x = (index - (GATE_FLOWS.length - 1) / 2) * GATE_SPACING;
    panel.add(box(kit.iron, [0.16, 0.5, 0.03], [x, -0.66, 0.015]));
    panel.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), pilot[index] ?? kit.brass, [x, -0.3, 0.03], { cast: false }));
    panel.add(label(NUMERALS[index] ?? '', 0.24, 0.14, x, -1.06));
    const lever = buildLever(kit, 0.3, kit.bronze);
    lever.pivot.position.set(x, -0.66, 0.03);
    panel.add(lever.pivot);
    const target = hitBox(kit, [GATE_SPACING * 0.92, 0.95, 0.5], [x, -0.66, 0.2]);
    panel.add(target);
    hotspots.push({
      id: `gate-${index}`,
      node: 'enginePanel',
      label: `Gate ${NUMERALS[index] ?? ''}`,
      targets: [target],
      action: () => ({ type: 'toggleGate', index })
    });
    return lever;
  });

  const mainX = 0.2;
  panel.add(label('MAIN', 0.44, 0.14, mainX, 1.0));
  panel.add(box(kit.iron, [0.36, 0.7, 0.04], [mainX, 0.52, 0.02]));
  [-0.09, 0.09].forEach((x) => panel.add(box(kit.copper, [0.04, 0.12, 0.06], [mainX + x, 0.76, 0.06])));
  const main = new THREE.Group();
  main.position.set(mainX, 0.24, 0.05);
  panel.add(main);
  [-0.09, 0.09].forEach((x) => main.add(box(kit.copper, [0.03, 0.56, 0.02], [x, 0.28, 0])));
  main.add(box(kit.woodDark, [0.3, 0.07, 0.07], [0, 0.58, 0]));
  const mainHit = hitBox(kit, [0.56, 0.95, 0.7], [mainX, 0.54, 0.3]);
  panel.add(mainHit);
  hotspots.push({
    id: 'main-switch',
    node: 'enginePanel',
    label: 'Main Switch',
    targets: [mainHit],
    action: () => ({ type: 'engage' })
  });

  const breakerX = 0.78;
  panel.add(label('BREAKER', 0.5, 0.13, breakerX, 0.2));
  panel.add(cylinder(kit.iron, 0.13, 0.13, 0.04, [breakerX, 0.58, 0.02], 20).rotateX(Math.PI / 2));
  const breakerMaterial = new THREE.MeshStandardMaterial({ color: 0x8a1f16, emissive: 0xff2a1a, emissiveIntensity: 0, roughness: 0.5 });
  const breaker = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.08, 20).rotateX(Math.PI / 2), breakerMaterial, [breakerX, 0.58, 0.06]);
  panel.add(breaker);
  const breakerHit = hitBox(kit, [0.54, 0.7, 0.4], [breakerX, 0.5, 0.15]);
  panel.add(breakerHit);
  hotspots.push({
    id: 'breaker',
    node: 'enginePanel',
    label: 'Breaker',
    targets: [breaker, breakerHit],
    action: () => ({ type: 'resetBreaker' })
  });

  const tideX = 1.34;
  panel.add(label('HIGH TIDE', 0.5, 0.13, tideX, 1.0));
  panel.add(label('LOW TIDE', 0.5, 0.13, tideX, 0.06));
  panel.add(box(kit.iron, [0.18, 0.62, 0.03], [tideX, 0.53, 0.015]));
  const tide = buildLever(kit, 0.34, kit.brass);
  tide.pivot.position.set(tideX, 0.53, 0.03);
  panel.add(tide.pivot);
  const tideHit = hitBox(kit, [0.54, 1.05, 0.7], [tideX, 0.53, 0.3]);
  panel.add(tideHit);
  hotspots.push({
    id: 'tide-lever',
    node: 'enginePanel',
    label: 'Tide Lever',
    targets: [tideHit],
    action: () => ({ type: 'toggleTide' })
  });

  const flow = new Eased(0, 3.5);
  const power = new Eased(0, 1.1);
  const mainAngle = new Eased(60 * DEG, 9);
  const trip = new Eased(0, 12);
  let open: boolean[] = [];

  const site = {
    group,
    views: {
      engineRoom: { position: worldPoint(group, 2.3, 1.7, 0.3), yaw: 270 * DEG, pitch: -2 * DEG },
      enginePanel: {
        position: worldPoint(panel, 0, 0, 2.5),
        yaw: 270 * DEG,
        pitch: 0,
        frameWidth: PANEL_WIDTH + 0.2,
        frameHeight: PANEL_HEIGHT + 0.3,
        distance: 2.5
      }
    },
    anchors: {
      'engineRoom>engineYard': worldPoint(group, 4.2, 1.4, 0.3),
      'engineRoom>enginePanel': worldPoint(panel, 0, 0.2, 0.3)
    },
    hotspots,
    sync: (state: Parameters<Area['sync']>[0]) => {
      open = state.gates;
      flow.target = gateFlow(state);
      power.target = state.powered ? 1 : 0;
      mainAngle.target = state.powered ? 6 * DEG : 60 * DEG;
      trip.target = state.breakerTripped ? 1 : 0;
      gates.forEach((lever, i) => (lever.angle.target = state.gates[i] ? LEVER_OPEN : LEVER_SHUT));
      tide.angle.target = state.tide === 'high' ? LEVER_OPEN : LEVER_SHUT;
    },
    update: (dt: number, time: number) => {
      const jitter = flow.target > 0 ? Math.sin(time * 23) * 0.35 : 0;
      needle.rotation.z = -tex.gaugeAngle(flow.step(dt) + jitter);
      gates.forEach((lever, i) => {
        lever.pivot.rotation.x = lever.angle.step(dt);
        const lamp = pilot[i];
        if (lamp) lamp.emissiveIntensity = open[i] ? 2.4 : 0;
      });
      tide.pivot.rotation.x = tide.angle.step(dt);
      main.rotation.x = mainAngle.step(dt);
      const tripped = trip.step(dt);
      breaker.position.z = 0.06 + tripped * 0.07;
      breakerMaterial.emissiveIntensity = tripped * (1.6 + Math.sin(time * 8) * 0.8);
      const level = power.step(dt);
      bulb.emissiveIntensity = level * 4;
      bulbs.forEach((light) => (light.intensity = level * 11));
      machine.flywheel.rotation.x += level * 3.2 * dt;
    }
  };
  return combine('engineRoom', { colour: 0x0a0d12, density: 0.03 }, [site]);
}
