import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.7 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrain;
    uniform float uVignette;
    varying vec2 vUv;

    float hash(vec2 p) {
      vec3 q = fract(vec3(p.xyx) * 0.1031 + uTime * 0.37);
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }

    void main() {
      vec4 colour = texture2D(tDiffuse, vUv);
      vec2 centred = vUv - 0.5;
      float edge = smoothstep(0.25, 0.85, length(centred) * 1.25);
      colour.rgb *= 1.0 - edge * uVignette;
      float luma = dot(colour.rgb, vec3(0.299, 0.587, 0.114));
      colour.rgb = mix(vec3(luma), colour.rgb, 1.08);
      colour.rgb += (hash(gl_FragCoord.xy) - 0.5) * uGrain;
      gl_FragColor = colour;
    }
  `
};

/** Renderer plus the post chain that gives the scenes their painted look. */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private grade: ShaderPass | null = null;
  private readonly isSmallScreen: boolean;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.isSmallScreen = Math.min(window.innerWidth, window.innerHeight) < 600;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isSmallScreen ? 1.5 : 2));
  }

  /** Build the post chain for a scene and camera. */
  attach(scene: THREE.Scene, camera: THREE.Camera): void {
    const composer = new EffectComposer(this.renderer);
    composer.addPass(new RenderPass(scene, camera));
    const strength = this.isSmallScreen ? 0.55 : 0.7;
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), strength, 0.7, 0.82));
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(GRADE_SHADER);
    composer.addPass(grade);
    this.composer = composer;
    this.grade = grade;
    this.resize();
  }

  resize(): { width: number; height: number } {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    this.renderer.setSize(width, height, false);
    this.composer?.setSize(width, height);
    return { width, height };
  }

  render(time: number): void {
    const uniform = this.grade?.uniforms.uTime;
    if (uniform) uniform.value = time % 100;
    this.composer?.render();
  }
}
