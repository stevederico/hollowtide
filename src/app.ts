import { AudioEngine } from './audio/audio.ts';
import { Look } from './engine/look.ts';
import { Stage } from './engine/stage.ts';
import { dispatch } from './game/actions.ts';
import { PlayClock } from './game/clock.ts';
import { ENGINE_RATING, SAVE_KEY } from './game/constants.ts';
import { backLink, findLink, NODES } from './game/nodes.ts';
import { createInitialState, deserialize, gateFlow, serialize } from './game/state.ts';
import type { Action, EndingId, GameEvent, GameState, NodeId } from './game/types.ts';
import { Ui } from './ui/ui.ts';
import { World, type Pick } from './world/World.ts';

const CLICK_SLOP = 7;
const FORWARD_CONE = (60 * Math.PI) / 180;
const SAVE_EVERY_MS = 8000;
const ENDING_DELAY: Readonly<Record<EndingId, number>> = { ferry: 2800, keeper: 3800 };
const INTRO = 'Your boat is wrecked. Mist hides the sea. A note lies on the crate beside you.';

interface Drag {
  id: number;
  x: number;
  y: number;
  travelled: number;
}

function readSave(): GameState | null {
  try {
    return deserialize(window.localStorage.getItem(SAVE_KEY));
  } catch (error) {
    console.error('Could not read the save', error);
    return null;
  }
}

function angleBetween(a: number, b: number): number {
  const turn = Math.PI * 2;
  return Math.abs(((((a - b) % turn) + turn + Math.PI) % turn) - Math.PI);
}

/** Glue between the pure game, the 3D world, the sound and the DOM. */
export class App {
  private state: GameState = createInitialState();
  private readonly stage: Stage;
  private readonly world: World;
  private readonly look: Look;
  private readonly audio = new AudioEngine();
  private readonly ui: Ui;
  private drag: Drag | null = null;
  private isBusy = false;
  private isPlaying = false;
  private time = 0;
  private last = 0;
  private unsaved = 0;
  private readonly clock = new PlayClock();
  private endingTimer = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    uiRoot: HTMLElement
  ) {
    this.ui = new Ui(uiRoot, {
      onBegin: () => this.begin(this.freshState(), true),
      onContinue: () => this.begin(readSave() ?? createInitialState(), false),
      onRestart: () => this.begin(this.freshState(), true),
      onStepBack: () => this.stepBack(),
      onTurn: (direction) => this.look.turn(direction),
      onSound: () => this.toggleSound(),
      onMarkers: () => this.toggleMarkers(),
      onKeepExploring: () => this.send({ type: 'keepExploring' }),
      onJournalOpened: () => this.audio.play('page')
    });
    this.stage = new Stage(canvas);
    this.world = new World(this.stage.renderer);
    this.look = new Look(this.world.camera);
    this.stage.attach(this.world.scene, this.world.camera);

    const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.look.reducedMotion = calm.matches;
    this.ui.reducedMotion = calm.matches;

    this.world.sync(this.state);
    this.place(this.state.node);
    this.resize();
    this.bindInput();
    this.ui.showTitle(this.hasProgress(readSave()));
    requestAnimationFrame((now) => this.frame(now));
  }

  /** A new game that still remembers which endings were found before. */
  private freshState(): GameState {
    const endingsFound = [...new Set([...this.state.endingsFound, ...(readSave()?.endingsFound ?? [])])];
    return { ...createInitialState(), endingsFound };
  }

  private hasProgress(save: GameState | null): boolean {
    return save !== null && (save.steps > 0 || save.journals.length > 0);
  }

  /** The current state, for tests and debugging. */
  snapshot(): GameState {
    return this.state;
  }

  private place(node: NodeId, yaw?: number): void {
    this.world.setNode(node, this.state);
    this.look.setView(this.world.view(node), yaw);
    this.audio.setArea(NODES[node].area, this.state.powered);
    this.ui.setTurnButtons(!NODES[node].closeUp);
  }

  private begin(state: GameState, isNew: boolean): void {
    window.clearTimeout(this.endingTimer);
    this.audio.start();
    this.state = state.ending === null ? state : dispatch(state, { type: 'keepExploring' }).state;
    this.isPlaying = true;
    this.isBusy = true;
    this.world.isLive = true;
    this.ui.hideEnding();
    void this.ui.fade(true, 500).then(() => {
      this.ui.hideTitle();
      this.world.sync(this.state);
      this.place(this.state.node);
      this.refreshUi();
      this.save();
      this.ui.setPlace(NODES[this.state.node].title);
      if (isNew) this.ui.say(INTRO);
      this.canvas.focus();
      return this.ui.fade(false, 900);
    }).then(() => {
      this.isBusy = false;
    });
  }

  private refreshUi(): void {
    this.ui.sync(this.state, this.audio.muted, this.world.showMarkers);
    this.ui.setReadout(this.readout());
  }

  /** The engine gauge as text, so it reads on any screen. */
  private readout(): string | null {
    if (this.state.node !== 'enginePanel') return null;
    const flow = `Flow ${gateFlow(this.state)} of ${ENGINE_RATING} marks`;
    if (this.state.powered) return `${flow}. Engine running.`;
    if (this.state.breakerTripped) return `${flow}. Breaker thrown.`;
    return flow;
  }

  private save(): void {
    this.unsaved = 0;
    try {
      window.localStorage.setItem(SAVE_KEY, serialize(this.state));
    } catch (error) {
      console.error('Could not save the game', error);
    }
  }

  /** Run an action through the game and play out whatever it caused. */
  send(action: Action): void {
    if (!this.isPlaying || this.isBusy) return;
    const result = dispatch(this.state, action);
    this.state = result.state;
    this.world.sync(this.state);
    this.audio.setArea(NODES[this.state.node].area, this.state.powered);
    result.events.forEach((event) => this.handle(event));
    this.refreshUi();
    this.save();
  }

  private handle(event: GameEvent): void {
    this.world.signal(event);
    switch (event.type) {
      case 'message':
        this.ui.say(event.text);
        break;
      case 'sfx':
        this.audio.play(event.name);
        break;
      case 'chime':
        this.audio.chime(event.index);
        break;
      case 'melody':
        this.audio.melody();
        break;
      case 'journal':
        this.ui.openJournal(event.id);
        break;
      case 'moved':
        this.travel(event.from, event.to);
        break;
      case 'ending':
        this.endingTimer = window.setTimeout(() => this.ui.showEnding(event.id, this.state), ENDING_DELAY[event.id]);
        break;
    }
  }

  private arrivalYaw(from: NodeId, to: NodeId): number | undefined {
    const kind = findLink(from, to)?.kind;
    if (kind === 'back') return this.world.view(from).yaw;
    if (kind !== 'walk') return undefined;
    const a = this.world.view(from).position;
    const b = this.world.view(to).position;
    return Math.atan2(b.x - a.x, -(b.z - a.z));
  }

  private travel(from: NodeId, to: NodeId): void {
    this.isBusy = true;
    this.ui.hint(null);
    this.canvas.classList.remove('is-hot');
    const isStep = NODES[to].closeUp || NODES[from].closeUp;
    void this.ui.fade(true, isStep ? 180 : 300).then(() => {
      this.place(to, this.arrivalYaw(from, to));
      this.ui.setPlace(NODES[to].title);
      return this.ui.fade(false, isStep ? 260 : 480);
    }).then(() => {
      this.isBusy = false;
    });
  }

  private act(pick: Pick): void {
    if (pick.kind === 'link') this.send({ type: 'move', to: pick.link.to });
    else this.send(pick.hotspot.action(this.state));
  }

  private stepBack(): void {
    const link = backLink(this.state.node);
    if (link) this.send({ type: 'move', to: link.to });
    else this.walkToward(this.look.heading + Math.PI, 'There is no path behind you.');
  }

  private walkAhead(): void {
    this.walkToward(this.look.heading, 'There is no path that way.');
  }

  /** Follow the link whose marker lies closest to a heading, within a cone. */
  private walkToward(heading: number, refusal: string): void {
    const ahead = this.world
      .linkHeadings()
      .map((entry) => ({ ...entry, off: angleBetween(entry.yaw, heading) }))
      .filter((entry) => entry.off < FORWARD_CONE)
      .sort((a, b) => a.off - b.off)[0];
    if (ahead) this.send({ type: 'move', to: ahead.link.to });
    else this.ui.say(refusal);
  }

  private toggleSound(): void {
    this.audio.setMuted(!this.audio.muted);
    this.refreshUi();
  }

  private toggleMarkers(): void {
    this.world.showMarkers = !this.world.showMarkers;
    this.refreshUi();
  }

  private pickAt(clientX: number, clientY: number): Pick | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;
    return this.world.pick(x, y);
  }

  private get canPlay(): boolean {
    return this.isPlaying && !this.isBusy && !this.ui.isBlocking && this.state.ending === null;
  }

  private bindInput(): void {
    const canvas = this.canvas;
    canvas.addEventListener('pointerdown', (event) => {
      if (!this.canPlay) return;
      // A second finger never hijacks a drag, but the same pointer replaces a drag whose release was lost.
      if (this.drag && this.drag.id !== event.pointerId) return;
      canvas.setPointerCapture(event.pointerId);
      this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, travelled: 0 };
    });
    canvas.addEventListener('pointermove', (event) => {
      const drag = this.drag;
      if (drag && drag.id === event.pointerId) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        drag.travelled += Math.hypot(dx, dy);
        drag.x = event.clientX;
        drag.y = event.clientY;
        if (drag.travelled > CLICK_SLOP) {
          canvas.classList.add('is-dragging');
          this.look.drag(dx, dy, canvas.clientHeight);
        }
        return;
      }
      if (event.pointerType !== 'mouse' || !this.canPlay) return;
      const pick = this.pickAt(event.clientX, event.clientY);
      canvas.classList.toggle('is-hot', pick !== null);
      this.ui.hint(pick?.label ?? null);
    });
    const release = (event: PointerEvent, isClick: boolean): void => {
      const drag = this.drag;
      if (!drag || drag.id !== event.pointerId) return;
      this.drag = null;
      canvas.classList.remove('is-dragging');
      if (!isClick || drag.travelled > CLICK_SLOP || !this.canPlay) return;
      const pick = this.pickAt(event.clientX, event.clientY);
      if (pick) this.act(pick);
    };
    canvas.addEventListener('pointerup', (event) => release(event, true));
    canvas.addEventListener('pointercancel', (event) => release(event, false));
    canvas.addEventListener('lostpointercapture', (event) => release(event, false));
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    window.addEventListener('keydown', (event) => this.onKey(event));
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      this.audio.setSuspended(document.hidden);
      if (document.hidden) this.clock.pause();
      if (document.hidden && this.isPlaying) this.save();
    });
  }

  private onKey(event: KeyboardEvent): void {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') {
      if (!this.ui.closeOverlays() && this.canPlay) {
        if (NODES[this.state.node].closeUp) this.stepBack();
        else this.ui.openMenu();
      }
      return;
    }
    if (key === 'm' && this.isPlaying) {
      this.toggleSound();
      return;
    }
    if (!this.canPlay) return;
    const isButton = event.target instanceof HTMLButtonElement;
    switch (key) {
      case 'arrowleft':
      case 'a':
        this.look.turn(-1);
        break;
      case 'arrowright':
      case 'd':
        this.look.turn(1);
        break;
      case 'arrowup':
      case 'w':
        this.walkAhead();
        break;
      case 'arrowdown':
      case 's':
      case 'backspace':
        this.stepBack();
        break;
      case 'j':
        this.ui.openJournal();
        break;
      case 'enter':
      case ' ': {
        if (isButton) return;
        const pick = this.world.pick(0, 0);
        if (pick) this.act(pick);
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  }

  private resize(): void {
    const { width, height } = this.stage.resize();
    this.look.setAspect(width / height);
  }

  private frame(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.time += dt;

    if (this.ui.isTitleShown) this.look.drift(Math.sin(this.time * 0.07) * 0.5, 0.03);
    const isCounting = this.isPlaying && !document.hidden && !this.ui.isPaused && this.state.ending === null;
    const played = this.clock.sample(performance.now(), isCounting);
    if (played > 0) {
      this.state = dispatch(this.state, { type: 'tick', ms: played }).state;
      this.unsaved += played;
      if (this.unsaved > SAVE_EVERY_MS) this.save();
    }

    this.look.update(dt, this.time);
    this.world.update(dt, this.time);
    this.stage.render(this.time);
    requestAnimationFrame((next) => this.frame(next));
  }

  /** Skip the title. Debug only. */
  play(): void {
    this.begin(createInitialState(), true);
  }

  /** Jump straight to a node. Debug only. */
  warp(node: NodeId, patch: Partial<GameState> = {}): void {
    this.state = { ...this.state, ...patch, node };
    this.world.sync(this.state);
    this.place(node);
    this.refreshUi();
    this.settle(6);
  }

  /** Aim the camera and let every animation run out. Debug only. */
  aim(yawDegrees: number, pitchDegrees: number): void {
    this.look.drift((yawDegrees * Math.PI) / 180, (pitchDegrees * Math.PI) / 180);
    this.settle(6);
  }

  /** Face a clickable thing and report where it is on screen. Debug only. */
  find(name: string): { x: number; y: number } | string {
    const spots = this.world.spots();
    const spot = spots.find((entry) => entry.label === name);
    if (!spot) return `none of: ${spots.map((entry) => entry.label).join(', ')}`;
    const camera = this.world.camera;
    const delta = spot.position.clone().sub(camera.position);
    this.look.drift(Math.atan2(delta.x, -delta.z), Math.atan2(delta.y, Math.hypot(delta.x, delta.z)));
    this.settle(3);
    camera.updateMatrixWorld(true);
    const point = spot.position.clone().project(camera);
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: Math.round(rect.left + ((point.x + 1) / 2) * rect.width),
      y: Math.round(rect.top + ((1 - point.y) / 2) * rect.height)
    };
  }

  /** Where a clickable thing is on screen right now, without moving the camera. Debug only. */
  where(name: string): { x: number; y: number; onScreen: boolean } | string {
    const spot = this.world.spots().find((entry) => entry.label === name);
    if (!spot) return 'missing';
    const camera = this.world.camera;
    camera.updateMatrixWorld(true);
    const point = spot.position.clone().project(camera);
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.round(rect.left + ((point.x + 1) / 2) * rect.width);
    const y = Math.round(rect.top + ((1 - point.y) / 2) * rect.height);
    return { x, y, onScreen: point.z < 1 && x >= 0 && x <= rect.width && y >= 0 && y <= rect.height };
  }

  /** On-screen size of a hotspot's targets. Debug only. */
  size(id: string): { width: number; height: number } | null {
    this.world.camera.updateMatrixWorld(true);
    return this.world.targetSize(id);
  }

  /** True while a move or fade is still playing. Debug only. */
  get busy(): boolean {
    return this.isBusy;
  }

  /** Fast forward the scene by a number of seconds. Debug only. */
  settle(seconds: number): void {
    const step = 1 / 30;
    for (let t = 0; t < seconds; t += step) {
      this.time += step;
      this.look.update(step, this.time);
      this.world.update(step, this.time);
    }
  }
}
