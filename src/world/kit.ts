import * as THREE from 'three';
import type { Action, AreaId, GameEvent, GameState, NodeId } from '../game/types.ts';
import { damp } from './noise.ts';
import * as tex from './textures.ts';

export interface View {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
  /** Width in metres that a close up must keep in frame. */
  frameWidth?: number;
  frameHeight?: number;
  distance?: number;
}

export interface Hotspot {
  id: string;
  node: NodeId;
  label: string;
  targets: THREE.Object3D[];
  /** Where the glint sits. An object is followed as it moves. */
  marker?: THREE.Vector3 | THREE.Object3D;
  /** A point that is certainly on the target, when its origin is not. */
  probe?: THREE.Vector3;
  action: (state: GameState) => Action;
  isActive?: (state: GameState) => boolean;
}

export interface Area {
  id: AreaId;
  group: THREE.Group;
  views: Partial<Record<NodeId, View>>;
  hotspots: Hotspot[];
  /** Marker positions for links, keyed "from>to". */
  anchors: Record<string, THREE.Vector3>;
  fog: { colour: number; density: number };
  sync(state: GameState): void;
  signal(event: GameEvent): void;
  update(dt: number, time: number): void;
}

/** A value that eases toward its target each frame. */
export class Eased {
  value: number;
  target: number;
  private readonly rate: number;

  constructor(value: number, rate = 6) {
    this.value = value;
    this.target = value;
    this.rate = rate;
  }

  step(dt: number): number {
    this.value = damp(this.value, this.target, this.rate, dt);
    return this.value;
  }

  snap(): void {
    this.value = this.target;
  }
}

/** Ease an angle the short way round. */
export class EasedAngle extends Eased {
  setTarget(angle: number): void {
    const turn = Math.PI * 2;
    const delta = ((((angle - this.target) % turn) + turn + Math.PI) % turn) - Math.PI;
    this.target += delta;
  }
}

export const DEG = Math.PI / 180;

function standard(params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(params);
}

function tiled(texture: THREE.Texture, x: number, y: number): THREE.Texture {
  const copy = texture.clone();
  copy.repeat.set(x, y);
  copy.needsUpdate = true;
  return copy;
}

/** Shared materials and textures, built once. */
export function createKit() {
  const stoneTex = tex.stoneBlocks();
  const plankTex = tex.planks();
  const rockTex = tex.roughRock();
  const plasterTex = tex.plaster();

  return {
    stoneTex,
    plankTex,
    rockTex,
    plasterTex,
    tiled,
    stone: standard({ map: tiled(stoneTex, 2, 1), roughness: 0.95, color: 0xb9bcc0 }),
    stoneDark: standard({ map: tiled(stoneTex, 3, 2), roughness: 1, color: 0x70747a }),
    rock: standard({ map: tiled(rockTex, 2, 2), roughness: 1, color: 0x8a8d92 }),
    wood: standard({ map: tiled(plankTex, 1, 1), roughness: 0.9, color: 0xa08c78 }),
    woodDark: standard({ map: tiled(plankTex, 1, 1), roughness: 0.95, color: 0x5d5148 }),
    slate: standard({ color: 0x2c3138, roughness: 0.8 }),
    iron: standard({ color: 0x30343a, roughness: 0.55, metalness: 0.85 }),
    brass: standard({ color: 0xc09a4c, roughness: 0.32, metalness: 0.95 }),
    bronze: standard({ color: 0x8b6a3c, roughness: 0.45, metalness: 0.9 }),
    copper: standard({ color: 0xa8633f, roughness: 0.5, metalness: 0.85 }),
    plaster: standard({ map: tiled(plasterTex, 4, 2), roughness: 1, color: 0xb8b2a2 }),
    paper: standard({ color: 0xd9cfae, roughness: 1 }),
    leather: standard({ color: 0x4b2c1e, roughness: 0.8 }),
    glass: standard({
      color: 0x0f1d22,
      roughness: 0.05,
      metalness: 0.9,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide
    }),
    crystal: standard({
      color: 0x7fe8dc,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.82,
      emissive: 0x2fbfae,
      emissiveIntensity: 0.25
    }),
    dark: new THREE.MeshBasicMaterial({ color: 0x020304 }),
    hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  };
}

export type Kit = ReturnType<typeof createKit>;

/** A lamp material whose glow follows the island power. */
export function lampMaterial(colour = 0xffc27a): THREE.MeshStandardMaterial {
  return standard({ color: 0x3a3630, emissive: colour, emissiveIntensity: 0, roughness: 0.4 });
}

export function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position?: [number, number, number],
  options: { cast?: boolean; receive?: boolean } = {}
): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  if (position) result.position.set(...position);
  result.castShadow = options.cast ?? true;
  result.receiveShadow = options.receive ?? true;
  return result;
}

export function box(
  material: THREE.Material,
  size: [number, number, number],
  position: [number, number, number]
): THREE.Mesh {
  return mesh(new THREE.BoxGeometry(...size), material, position);
}

export function cylinder(
  material: THREE.Material,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  position: [number, number, number],
  segments = 20
): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material, position);
}

/** A textured quad. The texture faces local +z. */
export function plate(
  texture: THREE.Texture,
  width: number,
  height: number,
  options: { glow?: boolean; metal?: boolean } = {}
): THREE.Mesh {
  const material = options.glow
    ? new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
        side: THREE.DoubleSide
      })
    : standard({
        map: texture,
        transparent: true,
        roughness: options.metal ? 0.4 : 0.9,
        metalness: options.metal ? 0.6 : 0
      });
  const result = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  result.receiveShadow = !options.glow;
  return result;
}

/** Invisible, generous click target. */
export function hitBox(kit: Kit, size: [number, number, number], position: [number, number, number]): THREE.Mesh {
  const result = new THREE.Mesh(new THREE.BoxGeometry(...size), kit.hit);
  result.position.set(...position);
  return result;
}

/** Rotate a group so its local +z faces a viewer who looks along the given yaw. */
export function faceViewer(object: THREE.Object3D, viewerYaw: number): void {
  object.rotation.y = -viewerYaw;
}

/** Unit vector on the ground for a compass yaw. */
export function heading(yaw: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
}

/** A closed book lying flat, for journals. */
export function bookMesh(kit: Kit): THREE.Group {
  const group = new THREE.Group();
  group.add(box(kit.leather, [0.3, 0.05, 0.4], [0, 0.025, 0]));
  group.add(box(kit.paper, [0.27, 0.036, 0.37], [0.012, 0.025, 0]));
  group.add(box(kit.brass, [0.06, 0.006, 0.4], [-0.08, 0.052, 0]));
  return group;
}

/** Street lamp with a globe that lights with the power. */
export function lampPost(kit: Kit, globe: THREE.Material, height = 3.2): THREE.Group {
  const group = new THREE.Group();
  group.add(cylinder(kit.iron, 0.05, 0.08, height, [0, height / 2, 0], 8));
  group.add(cylinder(kit.iron, 0.14, 0.18, 0.3, [0, 0.15, 0], 8));
  group.add(box(kit.iron, [0.5, 0.04, 0.04], [0.25, height - 0.05, 0]));
  const lamp = mesh(new THREE.SphereGeometry(0.17, 12, 10), globe, [0.5, height - 0.26, 0], { cast: false });
  group.add(lamp);
  group.add(cylinder(kit.iron, 0.02, 0.12, 0.1, [0.5, height - 0.08, 0], 8));
  return group;
}

/** Inside of a box shaped room, with its floor at y = 0. */
export function boxRoom(
  width: number,
  height: number,
  depth: number,
  walls: THREE.Material,
  floor: THREE.Material,
  ceiling: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  const add = (w: number, h: number, material: THREE.Material, pos: [number, number, number], rot: [number, number]) => {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
    wall.position.set(...pos);
    wall.rotation.set(rot[0], rot[1], 0);
    wall.receiveShadow = true;
    group.add(wall);
  };
  add(width, height, walls, [0, height / 2, -depth / 2], [0, 0]);
  add(width, height, walls, [0, height / 2, depth / 2], [0, Math.PI]);
  add(depth, height, walls, [-width / 2, height / 2, 0], [0, Math.PI / 2]);
  add(depth, height, walls, [width / 2, height / 2, 0], [0, -Math.PI / 2]);
  add(width, depth, floor, [0, 0, 0], [-Math.PI / 2, 0]);
  add(width, depth, ceiling, [0, height, 0], [Math.PI / 2, 0]);
  return group;
}

/** Inside of a round room, with its floor at y = 0. */
export function roundRoom(
  radius: number,
  height: number,
  walls: THREE.Material,
  floor: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  const wallMaterial = walls.clone();
  wallMaterial.side = THREE.BackSide;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 40, 1, true), wallMaterial);
  wall.position.y = height / 2;
  wall.receiveShadow = true;
  group.add(wall);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(radius, 40), floor);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  return group;
}

/** One landmark or room: geometry plus the views and hotspots that belong to it. */
export interface Site {
  group: THREE.Object3D;
  views?: Partial<Record<NodeId, View>>;
  hotspots?: Hotspot[];
  anchors?: Record<string, THREE.Vector3>;
  sync?(state: GameState): void;
  /** React to a game event, such as a chime being struck. */
  signal?(event: GameEvent): void;
  update?(dt: number, time: number): void;
}

/** Merge sites into one area. */
export function combine(id: AreaId, fog: Area['fog'], sites: Site[], extra: THREE.Object3D[] = []): Area {
  const group = new THREE.Group();
  group.name = id;
  sites.forEach((site) => group.add(site.group));
  extra.forEach((object) => group.add(object));
  return {
    id,
    group,
    fog,
    views: Object.assign({}, ...sites.map((site) => site.views ?? {})),
    hotspots: sites.flatMap((site) => site.hotspots ?? []),
    anchors: Object.assign({}, ...sites.map((site) => site.anchors ?? {})),
    sync: (state) => sites.forEach((site) => site.sync?.(state)),
    signal: (event) => sites.forEach((site) => site.signal?.(event)),
    update: (dt, time) => sites.forEach((site) => site.update?.(dt, time))
  };
}

/** World position of a point given in an object's local space. */
export function worldPoint(object: THREE.Object3D, x: number, y: number, z: number): THREE.Vector3 {
  object.updateWorldMatrix(true, false);
  return object.localToWorld(new THREE.Vector3(x, y, z));
}

/** A flat glowing disc, for light spilling out of a doorway. Faces local +z. */
export function glowDisc(texture: THREE.Texture, colour: number, radius: number): THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color: colour,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  return new THREE.Mesh(new THREE.CircleGeometry(radius, 40), material);
}

/** A soft additive glow that always faces the camera. */
export function glow(texture: THREE.Texture, colour: number, size: number): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: colour,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    opacity: 0
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  return sprite;
}
