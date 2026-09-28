import { CHIME_FREQS, MELODY, MELODY_BEAT } from '../game/constants.ts';
import type { AreaId, SfxName } from '../game/types.ts';

const PAD_NOTES = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23];

interface Ambience {
  wind: number;
  sea: number;
  tone: number;
  cutoff: number;
}

const AMBIENCE: Readonly<Record<AreaId, Ambience>> = {
  island: { wind: 0.2, sea: 0.26, tone: 0.06, cutoff: 9000 },
  engineRoom: { wind: 0.05, sea: 0.07, tone: 0.05, cutoff: 700 },
  lighthouseHall: { wind: 0.09, sea: 0.04, tone: 0.06, cutoff: 900 },
  observatory: { wind: 0.1, sea: 0.02, tone: 0.08, cutoff: 1100 },
  vault: { wind: 0.0, sea: 0.05, tone: 0.11, cutoff: 500 },
  grotto: { wind: 0.0, sea: 0.09, tone: 0.13, cutoff: 600 }
};

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.04 * white) / 1.04;
    data[i] = white * 0.4 + last * 6;
  }
  return buffer;
}

function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.6;
    }
  }
  return buffer;
}

/** Every sound in the game, synthesised with WebAudio. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wet: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private wind: GainNode | null = null;
  private sea: GainNode | null = null;
  private tone: GainNode | null = null;
  private hum: GainNode | null = null;
  private muffle: BiquadFilterNode | null = null;
  private padTimer = 0;
  private area: AreaId = 'island';
  private isPowered = false;
  muted = false;

  /** Start the context. Must be called from a user gesture. */
  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch (error) {
      console.error('Audio is unavailable', error);
      return;
    }
    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.9;
    const limiter = ctx.createDynamicsCompressor();
    master.connect(limiter).connect(ctx.destination);
    this.master = master;

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 3.4);
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    wet.connect(reverb).connect(master);
    this.wet = wet;

    this.noise = noiseBuffer(ctx, 4);
    this.buildAmbience(ctx, master);
    this.setArea(this.area, this.isPowered);
    this.padTimer = window.setInterval(() => this.padNote(), 5200);
  }

  private loop(ctx: AudioContext): AudioBufferSourceNode {
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    source.start(0, Math.random() * 3);
    return source;
  }

  private lfo(ctx: AudioContext, rate: number, depth: number, target: AudioParam): void {
    const osc = ctx.createOscillator();
    osc.frequency.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = depth;
    osc.connect(gain).connect(target);
    osc.start();
  }

  private buildAmbience(ctx: AudioContext, master: GainNode): void {
    const muffle = ctx.createBiquadFilter();
    muffle.type = 'lowpass';
    muffle.frequency.value = 9000;
    muffle.connect(master);
    this.muffle = muffle;

    const windBand = ctx.createBiquadFilter();
    windBand.type = 'bandpass';
    windBand.frequency.value = 520;
    windBand.Q.value = 0.7;
    const windSwell = ctx.createGain();
    windSwell.gain.value = 0.6;
    const wind = ctx.createGain();
    wind.gain.value = 0;
    this.loop(ctx).connect(windBand).connect(windSwell).connect(wind).connect(muffle);
    this.lfo(ctx, 0.07, 240, windBand.frequency);
    this.lfo(ctx, 0.11, 0.35, windSwell.gain);
    this.wind = wind;

    const seaLow = ctx.createBiquadFilter();
    seaLow.type = 'lowpass';
    seaLow.frequency.value = 620;
    const seaSwell = ctx.createGain();
    seaSwell.gain.value = 0.55;
    const sea = ctx.createGain();
    sea.gain.value = 0;
    this.loop(ctx).connect(seaLow).connect(seaSwell).connect(sea).connect(muffle);
    this.lfo(ctx, 0.13, 0.4, seaSwell.gain);
    this.lfo(ctx, 0.05, 220, seaLow.frequency);
    this.sea = sea;

    const tone = ctx.createGain();
    tone.gain.value = 0;
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 420;
    [73.42, 110.0, 110.6, 146.4].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0.3;
      osc.connect(gain).connect(warm);
      this.lfo(ctx, 0.03 + i * 0.017, 0.18, gain.gain);
      osc.start();
    });
    warm.connect(tone).connect(master);
    if (this.wet) tone.connect(this.wet);
    this.tone = tone;

    const hum = ctx.createGain();
    hum.gain.value = 0;
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 190;
    [55, 82.5].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.connect(humFilter);
      osc.start();
    });
    const chug = ctx.createGain();
    chug.gain.value = 0.7;
    this.lfo(ctx, 3.1, 0.3, chug.gain);
    humFilter.connect(chug).connect(hum).connect(master);
    this.hum = hum;
  }

  private ramp(node: GainNode | null, value: number, seconds = 1.2): void {
    if (!node || !this.ctx) return;
    node.gain.setTargetAtTime(value, this.ctx.currentTime, seconds / 3);
  }

  /** Blend the ambience for where the player stands. */
  setArea(area: AreaId, isPowered: boolean): void {
    this.area = area;
    this.isPowered = isPowered;
    const mix = AMBIENCE[area];
    this.ramp(this.wind, mix.wind);
    this.ramp(this.sea, mix.sea);
    this.ramp(this.tone, mix.tone);
    const humLevel = !isPowered ? 0 : area === 'engineRoom' ? 0.16 : area === 'island' ? 0.012 : 0.03;
    this.ramp(this.hum, humLevel);
    if (this.muffle && this.ctx) this.muffle.frequency.setTargetAtTime(mix.cutoff, this.ctx.currentTime, 0.4);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.ramp(this.master, muted ? 0 : 0.9, 0.2);
  }

  /** Pause or resume all sound, for when the tab is hidden. */
  setSuspended(isSuspended: boolean): void {
    if (!this.ctx) return;
    void (isSuspended ? this.ctx.suspend() : this.ctx.resume());
  }

  private voice(
    freq: number,
    options: { type?: OscillatorType; attack?: number; decay: number; gain: number; when?: number; wet?: number; slide?: number }
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const start = ctx.currentTime + (options.when ?? 0);
    const osc = ctx.createOscillator();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, start);
    if (options.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * options.slide), start + options.decay);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain, start + (options.attack ?? 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.decay);
    osc.connect(gain).connect(this.master);
    if (this.wet && options.wet) {
      const send = ctx.createGain();
      send.gain.value = options.wet;
      gain.connect(send).connect(this.wet);
    }
    osc.start(start);
    osc.stop(start + options.decay + 0.1);
  }

  private burst(options: { freq: number; q?: number; decay: number; gain: number; when?: number; type?: BiquadFilterType; sweep?: number }): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const start = ctx.currentTime + (options.when ?? 0);
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = options.type ?? 'bandpass';
    filter.frequency.setValueAtTime(options.freq, start);
    if (options.sweep) filter.frequency.exponentialRampToValueAtTime(options.freq * options.sweep, start + options.decay);
    filter.Q.value = options.q ?? 1;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.decay);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start, Math.random() * 3);
    source.stop(start + options.decay + 0.1);
  }

  /** A struck tube: a fundamental with the inharmonic partials of a real chime. */
  bell(freq: number, gain = 0.2, decay = 3.2, when = 0): void {
    this.voice(freq, { decay, gain, when, wet: 0.6 });
    this.voice(freq * 2.76, { decay: decay * 0.55, gain: gain * 0.4, when, wet: 0.5 });
    this.voice(freq * 5.4, { decay: decay * 0.28, gain: gain * 0.2, when, wet: 0.4 });
    this.voice(freq * 8.93, { decay: decay * 0.14, gain: gain * 0.1, when });
    this.burst({ freq: freq * 4, q: 3, decay: 0.05, gain: gain * 0.5, when });
  }

  chime(index: number): void {
    const freq = CHIME_FREQS[index];
    if (freq) this.bell(freq);
  }

  /** The music box tune, one octave up and thin, like a comb on pins. */
  melody(): void {
    MELODY.forEach((note, beat) => {
      const freq = CHIME_FREQS[note];
      if (!freq) return;
      const when = beat * MELODY_BEAT + 0.05;
      this.voice(freq * 2, { type: 'triangle', decay: 1.1, gain: 0.16, when, wet: 0.35 });
      this.voice(freq * 4, { decay: 0.5, gain: 0.05, when });
      this.burst({ freq: 3200, q: 4, decay: 0.03, gain: 0.05, when });
    });
  }

  private padNote(): void {
    if (!this.ctx || this.ctx.state !== 'running' || Math.random() < 0.35) return;
    const freq = PAD_NOTES[Math.floor(Math.random() * PAD_NOTES.length)] ?? 220;
    const level = this.area === 'island' ? 0.035 : 0.05;
    this.voice(freq, { attack: 2.2, decay: 7, gain: level, wet: 0.9 });
    this.voice(freq * 1.498, { attack: 2.8, decay: 6, gain: level * 0.5, wet: 0.9, when: 0.6 });
  }

  play(name: SfxName): void {
    switch (name) {
      case 'step':
        [0, 0.26, 0.52].forEach((when, i) => this.burst({ freq: 260 + i * 40, q: 0.8, decay: 0.12, gain: 0.22, when }));
        break;
      case 'stairs':
        [0, 0.2, 0.4, 0.6, 0.8].forEach((when, i) => this.burst({ freq: 420 + i * 60, q: 1.4, decay: 0.1, gain: 0.2, when }));
        break;
      case 'door':
        this.voice(120, { type: 'sawtooth', decay: 0.5, gain: 0.05, slide: 1.8 });
        this.burst({ freq: 180, q: 0.7, decay: 0.3, gain: 0.3, when: 0.45, type: 'lowpass' });
        break;
      case 'click':
        this.burst({ freq: 1800, q: 2, decay: 0.04, gain: 0.12 });
        break;
      case 'lever':
        this.burst({ freq: 900, q: 1.5, decay: 0.06, gain: 0.3 });
        this.voice(140, { type: 'square', decay: 0.12, gain: 0.08, when: 0.04, slide: 0.6 });
        break;
      case 'dial':
      case 'ring':
        this.burst({ freq: 1400, q: 5, decay: 0.05, gain: 0.2 });
        this.burst({ freq: 700, q: 3, decay: 0.09, gain: 0.16, when: 0.07 });
        break;
      case 'wheel':
        this.burst({ freq: 300, q: 1, decay: 0.7, gain: 0.16, sweep: 1.6 });
        this.voice(90, { type: 'sawtooth', decay: 0.7, gain: 0.04, slide: 1.3 });
        break;
      case 'deny':
        this.voice(110, { type: 'square', decay: 0.18, gain: 0.07, slide: 0.7 });
        this.burst({ freq: 300, q: 1, decay: 0.1, gain: 0.16 });
        break;
      case 'stall':
        this.voice(60, { type: 'sawtooth', decay: 1.3, gain: 0.14, slide: 0.35 });
        [0, 0.2, 0.45].forEach((when) => this.burst({ freq: 200, q: 1, decay: 0.15, gain: 0.2, when }));
        break;
      case 'breaker':
        this.burst({ freq: 2400, q: 0.6, decay: 0.25, gain: 0.4 });
        this.voice(70, { type: 'square', decay: 0.4, gain: 0.16, slide: 0.4 });
        break;
      case 'powerOn':
        this.voice(40, { type: 'sawtooth', attack: 1.6, decay: 3, gain: 0.16, slide: 2.4 });
        this.bell(293.66, 0.1, 4, 1.4);
        this.bell(440, 0.08, 4, 1.8);
        break;
      case 'tide':
        this.burst({ freq: 400, q: 0.5, decay: 4, gain: 0.34, type: 'lowpass', sweep: 0.4 });
        break;
      case 'lens':
        this.bell(880, 0.1, 2.2);
        this.burst({ freq: 1200, q: 2, decay: 0.08, gain: 0.16 });
        break;
      case 'page':
        this.burst({ freq: 2600, q: 0.6, decay: 0.22, gain: 0.12, sweep: 0.5 });
        break;
      case 'pickup':
        this.bell(659.25, 0.1, 1.6);
        this.bell(987.77, 0.07, 1.6, 0.12);
        break;
      case 'solve':
        [293.66, 440, 587.33, 880].forEach((freq, i) => this.bell(freq, 0.11, 4, i * 0.22));
        break;
      case 'vaultOpen':
        this.burst({ freq: 120, q: 0.6, decay: 3.2, gain: 0.5, type: 'lowpass' });
        this.voice(48, { type: 'sawtooth', decay: 3, gain: 0.12, slide: 0.7 });
        this.bell(220, 0.1, 4, 2.4);
        break;
      case 'reveal':
        [523.25, 392, 293.66].forEach((freq, i) => this.bell(freq, 0.09, 5, i * 0.5));
        break;
      case 'bell':
        [0, 2.2, 4.4].forEach((when) => {
          this.bell(98, 0.4, 7, when);
          this.bell(146.83, 0.16, 6, when);
        });
        break;
      case 'heart':
        this.voice(55, { attack: 2, decay: 8, gain: 0.3, wet: 0.8 });
        [146.83, 220, 293.66, 440, 587.33].forEach((freq, i) => this.bell(freq, 0.1, 6, 0.8 + i * 0.5));
        break;
    }
  }

  dispose(): void {
    window.clearInterval(this.padTimer);
    void this.ctx?.close();
  }
}
