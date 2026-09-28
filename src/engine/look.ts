import * as THREE from 'three';
import type { View } from '../world/kit.ts';
import { damp } from '../world/noise.ts';

const DEG = Math.PI / 180;
const BASE_FOV = 62;
const MIN_WIDE_FOV = 78;
const MAX_FOV = 92;
const PITCH_LIMIT = 62 * DEG;
const CLOSE_PITCH = 12 * DEG;
const TURN = 45 * DEG;
const CLOSE_FOV_MAX = 80;

interface Limits {
  yaw: number;
  pitch: number;
  yawRange: number | null;
  pitchRange: number;
}

/** First person look: free turn at a node, a small pan inside a close up. */
export class Look {
  private yaw = 0;
  private pitch = 0;
  private yawGoal = 0;
  private pitchGoal = 0;
  private aspect = 1;
  private limits: Limits = { yaw: 0, pitch: 0, yawRange: null, pitchRange: PITCH_LIMIT };
  private view: View | null = null;
  /** Where the camera stands, after any pull back a narrow screen needs. */
  private readonly stand = new THREE.Vector3();
  reducedMotion = false;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  get heading(): number {
    return this.yaw;
  }

  /** Vertical field of view that keeps a usable width on tall screens. */
  private wideFov(): number {
    if (this.aspect >= 1.3) return BASE_FOV;
    const vertical = 2 * Math.atan(Math.tan((MIN_WIDE_FOV * DEG) / 2) / this.aspect);
    return Math.min(MAX_FOV, Math.max(BASE_FOV, vertical / DEG));
  }

  private applyFov(): void {
    const view = this.view;
    const isCloseUp = view?.frameWidth !== undefined && view.frameHeight !== undefined && view.distance !== undefined;
    if (view) this.stand.copy(view.position);
    if (!view || !isCloseUp) {
      this.camera.fov = this.wideFov();
      this.limits = { yaw: 0, pitch: 0, yawRange: null, pitchRange: PITCH_LIMIT };
    } else {
      const halfWidth = (view.frameWidth ?? 1) / 2;
      const halfHeight = (view.frameHeight ?? 1) / 2;
      const extent = Math.max(halfHeight, halfWidth / this.aspect);
      // On a narrow screen the lens alone cannot fit the frame, so step back along the view line.
      const distance = Math.max(view.distance ?? 1, extent / Math.tan((CLOSE_FOV_MAX * DEG) / 2));
      const pullBack = distance - (view.distance ?? 1);
      if (pullBack > 0) {
        const forward = new THREE.Vector3(
          Math.sin(view.yaw) * Math.cos(view.pitch),
          Math.sin(view.pitch),
          -Math.cos(view.yaw) * Math.cos(view.pitch)
        );
        this.stand.addScaledVector(forward, -pullBack);
      }
      const fit = 2 * Math.atan(extent / distance);
      const fov = Math.min(CLOSE_FOV_MAX, Math.max(24, fit / DEG));
      this.camera.fov = fov;
      const halfSeen = Math.atan(Math.tan((fov * DEG) / 2) * this.aspect);
      const spill = Math.atan(halfWidth / distance) - halfSeen;
      this.limits = {
        yaw: view.yaw,
        pitch: view.pitch,
        yawRange: Math.max(7 * DEG, spill + 5 * DEG),
        pitchRange: CLOSE_PITCH
      };
    }
    if (view) this.camera.position.copy(this.stand);
    this.camera.updateProjectionMatrix();
    this.clamp();
  }

  setAspect(aspect: number): void {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.applyFov();
  }

  /** Jump to a view. Pass a yaw to face the way the player walked in. */
  setView(view: View, yaw?: number): void {
    this.view = view;
    this.yawGoal = yaw ?? view.yaw;
    this.pitchGoal = yaw === undefined ? view.pitch : 0;
    this.applyFov();
    this.yaw = this.yawGoal;
    this.pitch = this.pitchGoal;
    this.apply();
  }

  private clamp(): void {
    const { yaw, pitch, yawRange, pitchRange } = this.limits;
    if (yawRange !== null) {
      this.yawGoal = Math.min(yaw + yawRange, Math.max(yaw - yawRange, this.yawGoal));
      this.pitchGoal = Math.min(pitch + pitchRange, Math.max(pitch - pitchRange, this.pitchGoal));
    } else {
      this.pitchGoal = Math.min(pitchRange, Math.max(-pitchRange, this.pitchGoal));
    }
  }

  /** Drag by screen pixels. The scene follows the finger. */
  drag(dx: number, dy: number, viewportHeight: number): void {
    const perPixel = (this.camera.fov * DEG) / viewportHeight;
    this.yawGoal -= dx * perPixel;
    this.pitchGoal += dy * perPixel;
    this.clamp();
  }

  /** Ease toward an absolute heading. */
  drift(yaw: number, pitch: number): void {
    this.yawGoal = yaw;
    this.pitchGoal = pitch;
    this.clamp();
  }

  turn(direction: 1 | -1): void {
    this.yawGoal += direction * (this.limits.yawRange === null ? TURN : 8 * DEG);
    this.clamp();
  }

  private apply(): void {
    this.camera.rotation.set(this.pitch, -this.yaw, 0, 'YXZ');
  }

  update(dt: number, time: number): void {
    const rate = this.reducedMotion ? 40 : 11;
    this.yaw = damp(this.yaw, this.yawGoal, rate, dt);
    this.pitch = damp(this.pitch, this.pitchGoal, rate, dt);
    this.apply();
    if (!this.reducedMotion && this.view) {
      // A slow breath so still views never look frozen.
      this.camera.position.set(this.stand.x, this.stand.y + Math.sin(time * 0.9) * 0.012, this.stand.z);
    }
  }
}
