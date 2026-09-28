import * as THREE from 'three';
import { meets, NODE_IDS, NODES, type LinkDef } from '../game/nodes.ts';
import type { AreaId, GameEvent, GameState, NodeId } from '../game/types.ts';
import { buildIsland } from './island/index.ts';
import { createKit, type Area, type Hotspot, type View } from './kit.ts';
import { buildDome } from './rooms/dome.ts';
import { buildEngineRoom } from './rooms/engineRoom.ts';
import { buildGrotto } from './rooms/grotto.ts';
import { buildTowerHall } from './rooms/towerHall.ts';
import { buildVault } from './rooms/vault.ts';
import { buildSky, FOG_COLOUR, FOG_DENSITY, MOON_DIR } from './terrain.ts';
import * as tex from './textures.ts';

export type Pick =
  | { kind: 'link'; link: LinkDef; label: string }
  | { kind: 'hotspot'; hotspot: Hotspot; label: string };

interface Marker {
  sprite: THREE.Sprite;
  pick: Pick;
  follow: THREE.Object3D | null;
  base: number;
  isOpen: boolean;
}

const MARKER_DROP = 0.8;
/** How close in CSS pixels a tap must land to a marker. */
const MARKER_REACH = 30;
const SHADOW_FRAMES = 120;
const REFERENCE_TAN = Math.tan((62 * Math.PI) / 360);

function buildMoonlight(): THREE.DirectionalLight {
  const moon = new THREE.DirectionalLight(0xb4c8ea, 2.6);
  moon.position.copy(MOON_DIR).multiplyScalar(160);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  const camera = moon.shadow.camera;
  camera.left = -95;
  camera.right = 95;
  camera.top = 95;
  camera.bottom = -95;
  camera.near = 20;
  camera.far = 340;
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.35;
  return moon;
}

/** The 3D island: every area, the camera views, and what can be clicked from where. */
export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.08, 900);
  readonly sky = buildSky();
  private readonly areas: Record<AreaId, Area>;
  private readonly views = new Map<NodeId, View>();
  private readonly fog = new THREE.FogExp2(FOG_COLOUR, FOG_DENSITY);
  private readonly raycaster = new THREE.Raycaster();
  private readonly markerLayer = new THREE.Group();
  private readonly walkTexture = tex.walkMarker();
  private readonly useTexture = tex.useMarker();
  private markers: Marker[] = [];
  private picks = new Map<THREE.Object3D, Pick>();
  private targets: THREE.Object3D[] = [];
  private node: NodeId = 'dock';
  private area: AreaId = 'island';
  private shadowFrames = SHADOW_FRAMES;
  showMarkers = true;
  /** False while the title screen is up, so the backdrop stays clean. */
  isLive = false;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    const kit = createKit();
    const glowTex = tex.glowSprite();
    const island = buildIsland(kit, glowTex);
    island.group.add(buildMoonlight(), new THREE.HemisphereLight(0x7d9bc6, 0x2c3034, 1.9));
    this.areas = {
      island,
      engineRoom: buildEngineRoom(kit),
      lighthouseHall: buildTowerHall(kit),
      observatory: buildDome(kit, glowTex),
      vault: buildVault(kit, glowTex),
      grotto: buildGrotto(kit, glowTex)
    };
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x020304);
    this.scene.add(this.sky, this.markerLayer);
    Object.values(this.areas).forEach((area) => {
      this.scene.add(area.group);
      area.group.visible = false;
      NODE_IDS.forEach((id) => {
        const view = area.views[id];
        if (view) this.views.set(id, view);
      });
    });
    this.buildEnvironment();
    this.camera.rotation.order = 'YXZ';
  }

  /** Reflections for brass and glass, taken from the night sky. */
  private buildEnvironment(): void {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const probe = new THREE.Scene();
    probe.add(buildSky());
    this.scene.environment = pmrem.fromScene(probe, 0.04).texture;
    this.scene.environmentIntensity = 0.9;
    pmrem.dispose();
  }

  view(node: NodeId): View {
    const view = this.views.get(node);
    if (!view) throw new Error(`No view for node ${node}`);
    return view;
  }

  hasView(node: NodeId): boolean {
    return this.views.has(node);
  }

  /** Where the marker for a link sits. */
  anchor(from: NodeId, to: NodeId): THREE.Vector3 {
    const key = `${from}>${to}`;
    const own = this.areas[NODES[from].area].anchors[key] ?? this.areas[NODES[to].area].anchors[key];
    if (own) return own;
    return this.view(to).position.clone().setY(this.view(to).position.y - MARKER_DROP);
  }

  /** Move the camera to a node and rebuild what can be clicked there. */
  setNode(node: NodeId, state: GameState): void {
    this.node = node;
    this.area = NODES[node].area;
    Object.values(this.areas).forEach((area) => (area.group.visible = area.id === this.area));
    const isOutside = this.area === 'island';
    this.sky.visible = isOutside;
    const fog = this.areas[this.area].fog;
    this.fog.color.setHex(fog.colour);
    this.fog.density = fog.density;
    this.camera.position.copy(this.view(node).position);
    this.sky.position.copy(this.camera.position);
    this.shadowFrames = SHADOW_FRAMES;
    this.refresh(state);
  }

  /** Push the game state into the scene and refresh the clickable set. */
  sync(state: GameState): void {
    Object.values(this.areas).forEach((area) => area.sync(state));
    this.shadowFrames = SHADOW_FRAMES;
    this.refresh(state);
  }

  signal(event: GameEvent): void {
    Object.values(this.areas).forEach((area) => area.signal(event));
  }

  private addMarker(texture: THREE.Texture, at: THREE.Vector3 | THREE.Object3D, pick: Pick, base: number, isOpen: boolean): void {
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
      sizeAttenuation: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.renderOrder = 10;
    const follow = at instanceof THREE.Object3D ? at : null;
    if (at instanceof THREE.Vector3) sprite.position.copy(at);
    this.markerLayer.add(sprite);
    this.markers.push({ sprite, pick, follow, base, isOpen });
  }

  private refresh(state: GameState): void {
    this.markers.forEach((marker) => {
      marker.sprite.material.dispose();
      this.markerLayer.remove(marker.sprite);
    });
    this.markers = [];
    this.picks = new Map();
    this.targets = [];

    NODES[this.node].links.forEach((link) => {
      if (link.kind === 'back' || !this.hasView(link.to)) return;
      const pick: Pick = { kind: 'link', link, label: link.label };
      const texture = link.kind === 'look' ? this.useTexture : this.walkTexture;
      this.addMarker(texture, this.anchor(this.node, link.to), pick, 0.078, meets(state, link.requires));
    });

    this.areas[this.area].hotspots.forEach((hotspot) => {
      if (hotspot.node !== this.node) return;
      if (hotspot.isActive && !hotspot.isActive(state)) return;
      const pick: Pick = { kind: 'hotspot', hotspot, label: hotspot.label };
      hotspot.targets.forEach((target) => {
        this.picks.set(target, pick);
        this.targets.push(target);
      });
      if (hotspot.marker) this.addMarker(this.useTexture, hotspot.marker, pick, 0.06, true);
    });
  }

  /** Links out of the current node with the compass yaw to their markers. */
  linkHeadings(): { link: LinkDef; yaw: number }[] {
    return this.markers.flatMap((marker) => {
      if (marker.pick.kind !== 'link') return [];
      const delta = marker.sprite.position.clone().sub(this.camera.position);
      return [{ link: marker.pick.link, yaw: Math.atan2(delta.x, -delta.z) }];
    });
  }

  /** The nearest marker within reach of a point, measured on screen. */
  private pickMarker(x: number, y: number): Pick | null {
    const canvas = this.renderer.domElement;
    const halfWidth = canvas.clientWidth / 2;
    const halfHeight = canvas.clientHeight / 2;
    let best: Pick | null = null;
    let bestDistance = MARKER_REACH;
    this.markers.forEach((marker) => {
      const point = marker.sprite.position.clone().project(this.camera);
      if (point.z > 1) return;
      const distance = Math.hypot((point.x - x) * halfWidth, (point.y - y) * halfHeight);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = marker.pick;
      }
    });
    return best;
  }

  /** What is under a point in normalised device coordinates. Markers win, as they draw on top. */
  pick(x: number, y: number): Pick | null {
    const marker = this.pickMarker(x, y);
    if (marker) return marker;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const hits = this.raycaster.intersectObjects(this.targets, true);
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object;
      while (object) {
        const pick = this.picks.get(object);
        if (pick) return pick;
        object = object.parent;
      }
    }
    return null;
  }

  /** Everything clickable from here, with where it sits in the world. Debug only. */
  spots(): { label: string; position: THREE.Vector3 }[] {
    const seen = new Set<Pick>();
    const markers = this.markers.map((marker) => {
      seen.add(marker.pick);
      const label = marker.pick.kind === 'link' ? `go:${marker.pick.link.to}` : marker.pick.hotspot.id;
      return { label, position: marker.sprite.position.clone() };
    });
    return markers.concat(this.targets.flatMap((target) => {
      const pick = this.picks.get(target);
      if (!pick || seen.has(pick)) return [];
      seen.add(pick);
      const position = (pick.kind === 'hotspot' && pick.hotspot.probe) || target.getWorldPosition(new THREE.Vector3());
      return [{ label: pick.kind === 'link' ? `go:${pick.link.to}` : pick.hotspot.id, position }];
    }));
  }

  /** Screen size in CSS pixels of a hotspot's click targets. Debug only. */
  targetSize(id: string): { width: number; height: number } | null {
    const hotspot = this.areas[this.area].hotspots.find((entry) => entry.id === id);
    if (!hotspot) return null;
    const canvas = this.renderer.domElement;
    const bounds = new THREE.Box2();
    hotspot.targets.forEach((target) => {
      const box = new THREE.Box3().setFromObject(target);
      [box.min.x, box.max.x].forEach((x) =>
        [box.min.y, box.max.y].forEach((y) =>
          [box.min.z, box.max.z].forEach((z) => {
            const point = new THREE.Vector3(x, y, z).project(this.camera);
            bounds.expandByPoint(new THREE.Vector2(((point.x + 1) / 2) * canvas.clientWidth, ((1 - point.y) / 2) * canvas.clientHeight));
          })
        )
      );
    });
    const size = bounds.getSize(new THREE.Vector2());
    return { width: Math.round(size.x), height: Math.round(size.y) };
  }

  update(dt: number, time: number): void {
    this.areas[this.area].update(dt, time);
    if (this.area !== 'island') this.areas.island.update(dt, time);
    this.sky.position.copy(this.camera.position);

    const scale = Math.tan((this.camera.fov * Math.PI) / 360) / REFERENCE_TAN;
    const pulse = 0.62 + Math.sin(time * 2.4) * 0.2;
    this.markers.forEach((marker, i) => {
      if (marker.follow) marker.follow.getWorldPosition(marker.sprite.position);
      const size = marker.base * scale * (1 + Math.sin(time * 2.4 + i) * 0.05);
      marker.sprite.scale.set(size, size, 1);
      const shown = this.showMarkers && this.isLive ? 1 : 0;
      marker.sprite.material.opacity = shown * pulse * (marker.isOpen ? 1 : 0.4);
    });

    if (this.area === 'island' && this.shadowFrames > 0) {
      this.shadowFrames -= 1;
      this.renderer.shadowMap.needsUpdate = true;
    }
  }
}
