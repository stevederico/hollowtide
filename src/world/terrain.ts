import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Kit } from './kit.ts';
import { heightAt, isClearOfPads, pathDistance, SEA_HIGH } from './layout.ts';
import { fbm, mulberry32, smoothstep } from './noise.ts';
import * as tex from './textures.ts';

export const FOG_COLOUR = 0x2b3f50;
export const FOG_DENSITY = 0.0105;
export const MOON_DIR = new THREE.Vector3(-0.55, 0.5, -0.65).normalize();
const MOON_COLOUR = 0xa9c0e6;

const TERRAIN_SIZE = 300;
const TERRAIN_SEGMENTS = 240;

const SAND = new THREE.Color(0x9a8f6f);
const WET_SAND = new THREE.Color(0x54503f);
const GRASS = new THREE.Color(0x46573a);
const DRY_GRASS = new THREE.Color(0x63643f);
const ROCK = new THREE.Color(0x5b5d61);
const PATH = new THREE.Color(0x7d725a);
const SEABED = new THREE.Color(0x26353a);

function groundColour(x: number, z: number, h: number, slope: number, out: THREE.Color): void {
  if (h < -0.6) {
    out.copy(SEABED).lerp(WET_SAND, smoothstep(-3, -0.6, h));
    return;
  }
  out.copy(WET_SAND).lerp(SAND, smoothstep(-0.4, 0.7, h));
  const patch = fbm(x * 0.08, z * 0.08, 3) * 0.5 + 0.5;
  const grass = new THREE.Color().copy(GRASS).lerp(DRY_GRASS, patch);
  out.lerp(grass, smoothstep(0.9, 1.9, h + patch * 0.5));
  out.lerp(ROCK, smoothstep(0.45, 0.8, slope));
  if (h > 0.6) out.lerp(PATH, 1 - smoothstep(0.7, 1.9, pathDistance(x, z)));
}

export function buildTerrain(): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute('position');
  const colours = new Float32Array(position.count * 3);
  const colour = new THREE.Color();
  const step = 0.8;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const h = heightAt(x, z);
    position.setY(i, h);
    const slope = Math.hypot(heightAt(x + step, z) - h, heightAt(x, z + step) - h) / step;
    groundColour(x, z, h, slope, colour);
    colours.set([colour.r, colour.g, colour.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  const detail = tex.groundDetail();
  detail.repeat.set(90, 90);
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 1 });
  const terrain = new THREE.Mesh(geometry, material);
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  return terrain;
}

const WATER_VERTEX = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const WATER_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uSky;
  uniform vec3 uFogColour;
  uniform float uFogDensity;
  uniform vec3 uMoonDir;
  uniform vec3 uMoonColour;
  varying vec3 vWorld;

  vec2 wave(vec2 p, vec2 dir, float freq, float speed, float amp) {
    float phase = dot(p, dir) * freq + uTime * speed;
    return dir * (cos(phase) * amp * freq);
  }

  void main() {
    vec2 p = vWorld.xz;
    vec2 d = vec2(0.0);
    d += wave(p, normalize(vec2(1.0, 0.3)), 0.18, 0.7, 0.25);
    d += wave(p, normalize(vec2(-0.4, 1.0)), 0.31, 0.9, 0.14);
    d += wave(p, normalize(vec2(0.7, -0.6)), 0.83, 1.4, 0.05);
    d += wave(p, normalize(vec2(-0.8, -0.2)), 1.7, 1.9, 0.025);
    d += wave(p, normalize(vec2(0.2, 0.9)), 3.9, 2.6, 0.012);
    vec3 n = normalize(vec3(-d.x, 1.0, -d.y));
    vec3 v = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 4.0);
    vec3 colour = mix(uDeep, uSky, clamp(fresnel * 0.9 + 0.05, 0.0, 1.0));
    vec3 h = normalize(uMoonDir + v);
    colour += uMoonColour * pow(max(dot(n, h), 0.0), 160.0) * 1.8;
    float dist = length(cameraPosition - vWorld);
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    colour = mix(colour, uFogColour, fog);
    gl_FragColor = vec4(colour, mix(0.84, 1.0, max(fresnel, fog)));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface Water {
  mesh: THREE.Mesh;
  setTime(time: number): void;
  setFog(colour: number, density: number): void;
}

export function buildWater(): Water {
  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(0x07161d) },
    uSky: { value: new THREE.Color(0x3b5468) },
    uFogColour: { value: new THREE.Color(FOG_COLOUR) },
    uFogDensity: { value: FOG_DENSITY },
    uMoonDir: { value: MOON_DIR },
    uMoonColour: { value: new THREE.Color(MOON_COLOUR) }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: WATER_VERTEX,
    fragmentShader: WATER_FRAGMENT,
    transparent: true,
    depthWrite: false
  });
  const geometry = new THREE.PlaneGeometry(1400, 1400, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = SEA_HIGH;
  mesh.renderOrder = 1;
  return {
    mesh,
    setTime: (time) => {
      uniforms.uTime.value = time;
    },
    setFog: (colour, density) => {
      uniforms.uFogColour.value.setHex(colour);
      uniforms.uFogDensity.value = density;
    }
  };
}

const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uHorizon;
  uniform vec3 uZenith;
  uniform vec3 uMoonDir;
  uniform vec3 uMoonColour;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float up = clamp(dir.y, 0.0, 1.0);
    vec3 colour = mix(uHorizon, uZenith, pow(up, 0.55));
    float moon = max(dot(dir, uMoonDir), 0.0);
    colour += uMoonColour * smoothstep(0.9994, 0.9997, moon) * 3.0;
    colour += uMoonColour * pow(moon, 900.0) * 0.6;
    colour += uMoonColour * pow(moon, 24.0) * 0.12;
    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

function buildStars(): THREE.Points {
  const rand = mulberry32(7);
  const count = 900;
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = 0.12 + rand() * 0.88;
    const angle = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(angle) * r * 380, y * 380, Math.sin(angle) * r * 380], i * 3);
    const shine = (0.25 + rand() * 0.75) * smoothstep(0.12, 0.45, y);
    colours.set([shine * 0.85, shine * 0.92, shine], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const material = new THREE.PointsMaterial({
    size: 1.6,
    sizeAttenuation: false,
    vertexColors: true,
    fog: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  return new THREE.Points(geometry, material);
}

/** Sky dome, moon and stars. Keep it centred on the camera. */
export function buildSky(): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uHorizon: { value: new THREE.Color(FOG_COLOUR) },
      uZenith: { value: new THREE.Color(0x0b1424) },
      uMoonDir: { value: MOON_DIR },
      uMoonColour: { value: new THREE.Color(0xdfe9ff) }
    },
    vertexShader: SKY_VERTEX,
    fragmentShader: SKY_FRAGMENT,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), material);
  dome.renderOrder = -2;
  group.add(dome);
  const stars = buildStars();
  stars.renderOrder = -1;
  group.add(stars);
  return group;
}

export interface Mist {
  group: THREE.Group;
  update(time: number): void;
}

/** Slow banks of mist lying on the water around the island. */
export function buildMist(): Mist {
  const group = new THREE.Group();
  const rand = mulberry32(19);
  const texture = tex.mistSprite();
  const banks: { sprite: THREE.Sprite; angle: number; radius: number; speed: number; height: number }[] = [];
  for (let i = 0; i < 22; i++) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: 0xa9c2d2,
      transparent: true,
      opacity: 0.16 + rand() * 0.16,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(material);
    const size = 90 + rand() * 90;
    sprite.scale.set(size, size * 0.34, 1);
    sprite.renderOrder = 2;
    group.add(sprite);
    banks.push({
      sprite,
      angle: rand() * Math.PI * 2,
      radius: 125 + rand() * 80,
      speed: (rand() - 0.5) * 0.012,
      height: 2 + rand() * 5
    });
  }
  return {
    group,
    update: (time) => {
      banks.forEach((bank) => {
        const angle = bank.angle + time * bank.speed;
        bank.sprite.position.set(Math.cos(angle) * bank.radius, bank.height, Math.sin(angle) * bank.radius);
      });
    }
  };
}

function paint(geometry: THREE.BufferGeometry, colour: number): THREE.BufferGeometry {
  const c = new THREE.Color(colour);
  const count = geometry.getAttribute('position').count;
  const colours = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colours.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

function pineGeometry(): THREE.BufferGeometry {
  const parts = [
    paint(new THREE.CylinderGeometry(0.12, 0.2, 2.2, 6).translate(0, 1.1, 0), 0x3a2c22),
    paint(new THREE.ConeGeometry(1.5, 2.6, 7).translate(0, 2.7, 0), 0x2c4a3a),
    paint(new THREE.ConeGeometry(1.15, 2.3, 7).translate(0, 4.1, 0), 0x335441),
    paint(new THREE.ConeGeometry(0.75, 2.0, 7).translate(0, 5.4, 0), 0x3b5f49)
  ];
  return mergeGeometries(parts);
}

/** Pines in drifts, kept clear of paths and buildings. */
export function buildTrees(): THREE.InstancedMesh {
  const rand = mulberry32(3);
  const spots: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  for (let tries = 0; tries < 3000 && spots.length < 170; tries++) {
    const x = (rand() - 0.5) * 120;
    const z = (rand() - 0.5) * 110;
    const h = heightAt(x, z);
    const isWooded = fbm(x * 0.05 + 40, z * 0.05 + 12, 2) > -0.12;
    const isInVista = Math.abs(x) < 10 && z > 8;
    if (h < 1.7 || !isWooded || isInVista || pathDistance(x, z) < 4 || !isClearOfPads(x, z, 1.5)) continue;
    const scale = 0.8 + rand() * 0.9;
    dummy.position.set(x, h - 0.15, z);
    dummy.rotation.set((rand() - 0.5) * 0.08, rand() * Math.PI * 2, (rand() - 0.5) * 0.08);
    dummy.scale.set(scale, scale * (0.9 + rand() * 0.4), scale);
    dummy.updateMatrix();
    spots.push(dummy.matrix.clone());
  }
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
  const trees = new THREE.InstancedMesh(pineGeometry(), material, spots.length);
  spots.forEach((matrix, i) => trees.setMatrixAt(i, matrix));
  trees.castShadow = true;
  trees.receiveShadow = true;
  return trees;
}

/** A lumpy boulder shape. */
export function boulderGeometry(seed: number, detail = 1, roughness = 0.28): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const position = geometry.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i);
    const bump = fbm(v.x * 1.3 + seed, v.y * 1.3 + v.z * 1.7 - seed, 3);
    v.multiplyScalar(1 + bump * roughness);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Press a flat recess into a rock so a door can sit in it.
 * Vertices in front of the door plane, near its axis, are pushed back behind it.
 */
export function carveRecess(rock: THREE.Mesh, door: THREE.Vector3, outward: THREE.Vector3, radius: number): void {
  rock.updateMatrixWorld(true);
  const position = rock.geometry.getAttribute('position');
  const inverse = rock.matrixWorld.clone().invert();
  const v = new THREE.Vector3();
  const depth = 0.45;
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).applyMatrix4(rock.matrixWorld);
    const offset = v.clone().sub(door);
    const ahead = offset.dot(outward);
    const aside = offset.addScaledVector(outward, -ahead).length();
    const pull = (1 - smoothstep(radius, radius * 1.5, aside)) * Math.max(0, ahead + depth);
    if (pull <= 0) continue;
    v.addScaledVector(outward, -pull).applyMatrix4(inverse);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  position.needsUpdate = true;
  rock.geometry.computeVertexNormals();
}

/** Boulders along the shoreline and scattered inland. */
export function buildRocks(kit: Kit): THREE.InstancedMesh {
  const rand = mulberry32(5);
  const dummy = new THREE.Object3D();
  const spots: THREE.Matrix4[] = [];
  for (let tries = 0; tries < 2500 && spots.length < 150; tries++) {
    const x = (rand() - 0.5) * 150;
    const z = (rand() - 0.5) * 140;
    const h = heightAt(x, z);
    const isShore = h > -1.6 && h < 0.9;
    const isInland = h > 2 && rand() < 0.08;
    if ((!isShore && !isInland) || pathDistance(x, z) < 4 || !isClearOfPads(x, z, 0)) continue;
    if (Math.abs(x) < 6 && z > 40) continue;
    const scale = 0.4 + rand() * rand() * 2.4;
    dummy.position.set(x, h + scale * 0.15, z);
    dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    dummy.scale.set(scale, scale * (0.5 + rand() * 0.5), scale * (0.7 + rand() * 0.6));
    dummy.updateMatrix();
    spots.push(dummy.matrix.clone());
  }
  const rocks = new THREE.InstancedMesh(boulderGeometry(1), kit.rock, spots.length);
  spots.forEach((matrix, i) => rocks.setMatrixAt(i, matrix));
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  return rocks;
}
