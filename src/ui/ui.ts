import { ENDING_TOTAL, GAME_TITLE, JOURNAL_TOTAL } from '../game/constants.ts';
import { JOURNAL_ORDER, JOURNALS } from '../game/journals.ts';
import { backLink } from '../game/nodes.ts';
import type { EndingId, GameState, ItemId, JournalId } from '../game/types.ts';
import { ICONS } from './icons.ts';

export interface UiHandlers {
  onBegin(): void;
  onContinue(): void;
  onRestart(): void;
  onStepBack(): void;
  onTurn(direction: 1 | -1): void;
  onSound(): void;
  onMarkers(): void;
  onKeepExploring(): void;
  onJournalOpened(id: JournalId): void;
}

const ITEMS: Readonly<Record<ItemId, { name: string; icon: string }>> = {
  lens: { name: 'Lamp Lens', icon: ICONS.lens },
  fork: { name: 'Tuning Fork', icon: ICONS.fork }
};

const ENDINGS: Readonly<Record<EndingId, { title: string; text: string[] }>> = {
  ferry: {
    title: 'The Ferry Answers',
    text: [
      'The voice of the bell rolls out over the water, and the mist thins before it.',
      'Far off, a lantern swings in reply. The ferry is coming.',
      'You leave Hollowtide as you found it: silent, and keeping its secrets.'
    ]
  },
  keeper: {
    title: 'Keeper Of The Tide',
    text: [
      'The fork sings, and the heart beneath the stack answers.',
      'The water turns at your word now. The lamps will not go dark again.',
      'Hollowtide has a keeper again, and no one will ring for the ferry.'
    ]
  }
};

const HOW_TO_PLAY = `
  <ul class="how">
    <li><b>Look</b> Drag the view. Arrow keys or A and D turn.</li>
    <li><b>Walk</b> Tap a glowing ring. W or Up walks ahead.</li>
    <li><b>Touch</b> Tap a glint, a lever, a dial, a book.</li>
    <li><b>Keys</b> J journal, M sound, Esc steps back.</li>
  </ul>`;

const TEMPLATE = `
  <div id="fade" class="fade"></div>

  <header id="hud" class="hud" hidden>
    <p id="place" class="place" aria-live="polite"></p>
    <p id="readout" class="readout" aria-live="polite" hidden></p>
    <nav class="hud-buttons" aria-label="Game">
      <button id="btn-journal" class="icon-button" type="button" aria-label="Journal">${ICONS.book}<span id="journal-count" class="badge">0</span></button>
      <button id="btn-sound" class="icon-button" type="button" aria-label="Sound On">${ICONS.soundOn}</button>
      <button id="btn-menu" class="icon-button" type="button" aria-label="Menu">${ICONS.menu}</button>
    </nav>
    <button id="btn-left" class="turn turn-left" type="button" aria-label="Turn Left">${ICONS.left}</button>
    <button id="btn-right" class="turn turn-right" type="button" aria-label="Turn Right">${ICONS.right}</button>
    <div class="hud-bottom">
      <ul id="inventory" class="inventory" aria-label="Inventory"></ul>
      <p id="message" class="message" role="status" aria-live="polite"></p>
      <button id="btn-back" class="pill back" type="button" hidden>${ICONS.back}<span>Step Back</span></button>
    </div>
  </header>

  <section id="title" class="overlay title" aria-labelledby="title-name">
    <div class="title-card">
      <p class="eyebrow">A Point And Click Mystery</p>
      <h1 id="title-name">${GAME_TITLE}</h1>
      <p class="lede">The fog has left you on the dock of a silent island. The ferry will not come unless it is called.</p>
      <p class="goal"><b>Goal</b> Wake the island and call the ferry.</p>
      <div class="actions">
        <button id="btn-continue" class="pill primary" type="button" hidden>Continue</button>
        <button id="btn-begin" class="pill primary" type="button" disabled>Loading</button>
      </div>
      ${HOW_TO_PLAY}
      <p class="fine">Best with sound on.</p>
    </div>
  </section>

  <section id="journal" class="overlay" role="dialog" aria-modal="true" aria-labelledby="journal-title" hidden>
    <div class="book">
      <button id="journal-close" class="icon-button close" type="button" aria-label="Close Journal">${ICONS.close}</button>
      <nav id="journal-tabs" class="tabs" aria-label="Journals"></nav>
      <article class="page">
        <p id="journal-found" class="found"></p>
        <h2 id="journal-title"></h2>
        <div id="journal-text" class="page-text"></div>
      </article>
      <footer class="page-nav">
        <button id="journal-prev" class="pill" type="button">Previous</button>
        <span id="journal-page" class="page-count"></span>
        <button id="journal-next" class="pill" type="button">Next</button>
      </footer>
    </div>
  </section>

  <section id="menu" class="overlay" role="dialog" aria-modal="true" aria-labelledby="menu-title" hidden>
    <div class="panel">
      <h2 id="menu-title">Paused</h2>
      <div class="actions column">
        <button id="menu-resume" class="pill primary" type="button">Resume</button>
        <button id="menu-sound" class="pill" type="button">Sound On</button>
        <button id="menu-markers" class="pill" type="button">Markers On</button>
        <button id="menu-restart" class="pill" type="button">Restart</button>
      </div>
      <div id="menu-confirm" class="confirm" hidden>
        <p>Start over? Your progress will be lost.</p>
        <div class="actions">
          <button id="menu-restart-yes" class="pill danger" type="button">Start Over</button>
          <button id="menu-restart-no" class="pill" type="button">Cancel</button>
        </div>
      </div>
      ${HOW_TO_PLAY}
    </div>
  </section>

  <section id="ending" class="overlay ending" role="dialog" aria-modal="true" aria-labelledby="ending-title" hidden>
    <div class="panel">
      <p id="ending-kind" class="eyebrow"></p>
      <h2 id="ending-title"></h2>
      <div id="ending-text"></div>
      <dl id="ending-stats" class="stats"></dl>
      <p id="ending-hint" class="fine"></p>
      <div class="actions">
        <button id="ending-explore" class="pill" type="button">Keep Exploring</button>
        <button id="ending-again" class="pill primary" type="button">Play Again</button>
      </div>
    </div>
  </section>
`;

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes % 60)}:${pad(seconds % 60)}` : `${minutes}:${pad(seconds % 60)}`;
}

/** Every DOM layer over the canvas: title, HUD, journal, menu and endings. */
export class Ui {
  private readonly elements = new Map<string, HTMLElement>();
  private messageTimer = 0;
  private placeTimer = 0;
  private journalId: JournalId = 'arrival';
  private journalPage = 0;
  private known: JournalId[] = [];
  private lastFocus: HTMLElement | null = null;
  reducedMotion = false;

  constructor(
    root: HTMLElement,
    private readonly handlers: UiHandlers
  ) {
    root.innerHTML = TEMPLATE;
    root.querySelectorAll<HTMLElement>('[id]').forEach((element) => this.elements.set(element.id, element));
    this.bind();
  }

  private el(id: string): HTMLElement {
    const element = this.elements.get(id);
    if (!element) throw new Error(`Missing UI element ${id}`);
    return element;
  }

  private on(id: string, handler: () => void): void {
    this.el(id).addEventListener('click', (event) => {
      event.stopPropagation();
      handler();
    });
  }

  private bind(): void {
    const h = this.handlers;
    this.on('btn-begin', () => h.onBegin());
    this.on('btn-continue', () => h.onContinue());
    this.on('btn-back', () => h.onStepBack());
    this.on('btn-left', () => h.onTurn(-1));
    this.on('btn-right', () => h.onTurn(1));
    this.on('btn-sound', () => h.onSound());
    this.on('menu-sound', () => h.onSound());
    this.on('menu-markers', () => h.onMarkers());
    this.on('btn-menu', () => this.openMenu());
    this.on('menu-resume', () => this.closeOverlays());
    this.on('menu-restart', () => (this.el('menu-confirm').hidden = false));
    this.on('menu-restart-no', () => (this.el('menu-confirm').hidden = true));
    this.on('menu-restart-yes', () => {
      this.closeOverlays();
      h.onRestart();
    });
    this.on('btn-journal', () => this.openJournal());
    this.on('journal-close', () => this.closeOverlays());
    this.on('journal-prev', () => this.turnPage(-1));
    this.on('journal-next', () => this.turnPage(1));
    this.on('ending-explore', () => {
      this.el('ending').hidden = true;
      h.onKeepExploring();
    });
    this.on('ending-again', () => {
      this.el('ending').hidden = true;
      h.onRestart();
    });
    ['journal', 'menu'].forEach((id) => {
      this.el(id).addEventListener('click', (event) => {
        if (event.target === this.el(id)) this.closeOverlays();
      });
    });
  }

  /** True while a layer is covering the scene and should swallow game input. */
  get isBlocking(): boolean {
    return ['title', 'journal', 'menu', 'ending'].some((id) => !this.el(id).hidden);
  }

  /** True while the game is paused: title, menu or an ending card. Reading a journal still counts as play. */
  get isPaused(): boolean {
    return ['title', 'menu', 'ending'].some((id) => !this.el(id).hidden);
  }

  get isTitleShown(): boolean {
    return !this.el('title').hidden;
  }

  setReady(hasSave: boolean): void {
    const begin = this.el('btn-begin');
    begin.textContent = hasSave ? 'New Game' : 'Begin';
    begin.removeAttribute('disabled');
    begin.classList.toggle('primary', !hasSave);
    this.el('btn-continue').hidden = !hasSave;
    (hasSave ? this.el('btn-continue') : begin).focus();
  }

  showTitle(hasSave: boolean): void {
    this.el('title').hidden = false;
    this.el('hud').hidden = true;
    this.setReady(hasSave);
  }

  hideTitle(): void {
    this.el('title').hidden = true;
    this.el('hud').hidden = false;
  }

  /** Fade the scene to black or back. Resolves when the fade has finished. */
  fade(toBlack: boolean, ms = 260): Promise<void> {
    const fade = this.el('fade');
    const duration = this.reducedMotion ? 60 : ms;
    fade.style.transitionDuration = `${duration}ms`;
    fade.classList.toggle('on', toBlack);
    return new Promise((resolve) => window.setTimeout(resolve, duration));
  }

  setPlace(title: string): void {
    const place = this.el('place');
    place.textContent = title;
    place.classList.add('show');
    window.clearTimeout(this.placeTimer);
    this.placeTimer = window.setTimeout(() => place.classList.remove('show'), 3600);
  }

  /** Show a line of narration. */
  say(text: string): void {
    const message = this.el('message');
    message.textContent = text;
    message.classList.remove('hint');
    message.classList.add('show');
    window.clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => message.classList.remove('show'), 2600 + text.length * 45);
  }

  /** Show what is under the pointer. Narration takes priority. */
  hint(label: string | null): void {
    const message = this.el('message');
    const isNarrating = message.classList.contains('show') && !message.classList.contains('hint');
    if (isNarrating) return;
    if (!label) {
      message.classList.remove('show', 'hint');
      return;
    }
    message.textContent = label;
    message.classList.add('show', 'hint');
  }

  sync(state: GameState, isMuted: boolean, showMarkers: boolean): void {
    this.known = JOURNAL_ORDER.filter((id) => state.journals.includes(id));
    this.el('journal-count').textContent = String(this.known.length);
    this.el('btn-journal').toggleAttribute('disabled', this.known.length === 0);
    this.el('inventory').innerHTML = state.inventory
      .map((item) => `<li class="item" title="${ITEMS[item].name}">${ITEMS[item].icon}<span>${ITEMS[item].name}</span></li>`)
      .join('');
    const back = backLink(state.node);
    this.el('btn-back').hidden = back === undefined;
    const label = this.el('btn-back').querySelector('span');
    if (label && back) label.textContent = back.kind === 'back' ? 'Step Back' : back.label;

    const soundLabel = isMuted ? 'Sound Off' : 'Sound On';
    this.el('btn-sound').innerHTML = isMuted ? ICONS.soundOff : ICONS.soundOn;
    this.el('btn-sound').setAttribute('aria-label', soundLabel);
    this.el('menu-sound').textContent = soundLabel;
    this.el('menu-markers').textContent = showMarkers ? 'Markers On' : 'Markers Off';
  }

  /** A line of instrument text shown over a close up, or null to hide it. */
  setReadout(text: string | null): void {
    const readout = this.el('readout');
    readout.hidden = text === null;
    readout.textContent = text ?? '';
  }

  setTurnButtons(isShown: boolean): void {
    this.el('btn-left').hidden = !isShown;
    this.el('btn-right').hidden = !isShown;
  }

  private open(id: string, focus: string): void {
    this.hint(null);
    const active = document.activeElement;
    this.lastFocus = active instanceof HTMLElement ? active : null;
    this.el(id).hidden = false;
    this.el(focus).focus();
  }

  openMenu(): void {
    if (this.isBlocking) return;
    this.el('menu-confirm').hidden = true;
    this.open('menu', 'menu-resume');
  }

  /** Open the journal, on a given entry or the last one read. */
  openJournal(id?: JournalId): void {
    if (this.known.length === 0 && !id) return;
    if (id) {
      this.journalId = id;
      this.journalPage = 0;
      if (!this.known.includes(id)) this.known = JOURNAL_ORDER.filter((entry) => this.known.includes(entry) || entry === id);
    } else if (!this.known.includes(this.journalId)) {
      this.journalId = this.known[this.known.length - 1] ?? 'arrival';
      this.journalPage = 0;
    }
    this.renderJournal();
    if (this.el('journal').hidden) this.open('journal', 'journal-close');
  }

  private turnPage(delta: number): void {
    const pages = JOURNALS[this.journalId].pages.length;
    const next = this.journalPage + delta;
    if (next < 0 || next >= pages) return;
    this.journalPage = next;
    this.handlers.onJournalOpened(this.journalId);
    this.renderJournal();
  }

  private renderJournal(): void {
    const journal = JOURNALS[this.journalId];
    const page = journal.pages[this.journalPage];
    this.el('journal-title').textContent = journal.title;
    this.el('journal-found').textContent = journal.found;
    this.el('journal-text').innerHTML = (page?.text ?? []).map((line) => `<p>${line}</p>`).join('');
    this.el('journal-page').textContent = `${this.journalPage + 1} / ${journal.pages.length}`;
    this.el('journal-prev').toggleAttribute('disabled', this.journalPage === 0);
    this.el('journal-next').toggleAttribute('disabled', this.journalPage >= journal.pages.length - 1);

    const tabs = this.el('journal-tabs');
    tabs.innerHTML = '';
    this.known.forEach((id, index) => {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'tab';
      tab.textContent = String(index + 1);
      tab.setAttribute('aria-label', JOURNALS[id].title);
      tab.setAttribute('aria-pressed', String(id === this.journalId));
      tab.addEventListener('click', (event) => {
        event.stopPropagation();
        this.handlers.onJournalOpened(id);
        this.openJournal(id);
      });
      tabs.append(tab);
    });
  }

  /** Close the journal or menu. Returns true if something was open. */
  closeOverlays(): boolean {
    const open = ['journal', 'menu'].filter((id) => !this.el(id).hidden);
    open.forEach((id) => (this.el(id).hidden = true));
    if (open.length > 0) this.lastFocus?.focus();
    return open.length > 0;
  }

  showEnding(id: EndingId, state: GameState): void {
    this.closeOverlays();
    const ending = ENDINGS[id];
    const found = state.endingsFound.length;
    this.el('ending-kind').textContent = id === 'keeper' ? 'The Hidden Ending' : 'An Ending';
    this.el('ending-title').textContent = ending.title;
    this.el('ending-text').innerHTML = ending.text.map((line) => `<p>${line}</p>`).join('');
    const stats: [string, string][] = [
      ['Time', formatTime(state.elapsedMs)],
      ['Steps', String(state.steps)],
      ['Journals', `${state.journals.length} / ${JOURNAL_TOTAL}`],
      ['Endings', `${found} / ${ENDING_TOTAL}`]
    ];
    this.el('ending-stats').innerHTML = stats.map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('');
    // Once the fork is placed the bell stays silent, so the ferry needs a fresh game.
    const isFerryLeft = found < ENDING_TOTAL && state.forkPlaced;
    const hint = found >= ENDING_TOTAL
      ? 'You have found every ending.'
      : isFerryLeft
        ? 'Hollowtide keeps one more ending, in another game.'
        : 'Hollowtide keeps one more ending.';
    this.el('ending-hint').textContent = hint;
    this.open('ending', found < ENDING_TOTAL && !isFerryLeft ? 'ending-explore' : 'ending-again');
  }

  hideEnding(): void {
    this.el('ending').hidden = true;
  }
}
