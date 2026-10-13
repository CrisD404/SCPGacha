/**
 * Efectos de sonido sintetizados con WebAudio: no hay archivos de audio,
 * todo funciona sin conexión y pesa 0 KB.
 */
export type SfxName =
  | 'tap' | 'tear' | 'whoosh' | 'flip' | 'reveal0' | 'reveal1' | 'reveal2' | 'stamp' | 'charge' | 'alarm'
  | 'heartbeat' | 'glitch' | 'blackout' | 'boom' | 'fanfare3' | 'fanfare4' | 'fanfare5' | 'shatter'
  | 'hit' | 'crit' | 'miss' | 'ko' | 'heal' | 'chime' | 'error' | 'deal' | 'victory' | 'defeat' | 'trophy' | 'toggle';

class Synth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = true;
  volume = 0.7;

  private ensure(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master.connect(comp).connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.master!.gain.value = this.volume * 0.55;
    return this.ctx;
  }

  /** Desbloquea el audio tras el primer gesto del usuario (requisito de los navegadores). */
  unlock() {
    this.ensure();
  }

  private tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; at?: number; to?: number; attack?: number; detune?: number; filter?: number } = {}) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.detune) osc.detune.value = opts.detune;
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t + dur);
    const peak = opts.gain ?? 0.3;
    const atk = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = osc;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opts.filter;
      osc.connect(f);
      node = f;
    }
    node.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private noise(dur: number, opts: { at?: number; gain?: number; type?: BiquadFilterType; freq?: number; to?: number; q?: number; attack?: number } = {}) {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noiseBuf) return;
    const t = ctx.currentTime + (opts.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 1200, t);
    if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    const peak = opts.gain ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private chord(freqs: number[], dur: number, opts: { at?: number; gain?: number; type?: OscillatorType; stagger?: number; filter?: number } = {}) {
    freqs.forEach((f, i) => this.tone(f, dur, { type: opts.type ?? 'triangle', gain: opts.gain ?? 0.12, at: (opts.at ?? 0) + i * (opts.stagger ?? 0), attack: 0.02, filter: opts.filter }));
  }

  play(name: SfxName) {
    if (!this.enabled) return;
    switch (name) {
      case 'tap':
        return this.tone(1400, 0.05, { type: 'square', gain: 0.05 });
      case 'deal':
        return this.noise(0.12, { freq: 3000, to: 1200, gain: 0.12, type: 'bandpass' });
      case 'tear':
        this.noise(0.35, { freq: 4000, to: 900, gain: 0.35, type: 'highpass', q: 0.7 });
        return this.noise(0.2, { at: 0.08, freq: 2500, to: 600, gain: 0.25 });
      case 'whoosh':
        return this.noise(0.4, { freq: 400, to: 3000, gain: 0.25, q: 2, attack: 0.1 });
      case 'flip':
        this.noise(0.06, { freq: 5000, gain: 0.18, type: 'highpass' });
        return this.tone(700, 0.08, { type: 'triangle', gain: 0.08, to: 1100 });
      case 'reveal0':
        return this.tone(880, 0.18, { type: 'triangle', gain: 0.1 });
      case 'reveal1':
        this.tone(659, 0.25, { type: 'triangle', gain: 0.12 });
        return this.tone(988, 0.35, { type: 'triangle', gain: 0.12, at: 0.08 });
      case 'reveal2':
        this.chord([523, 659, 784, 1047], 0.6, { stagger: 0.06, gain: 0.11 });
        return this.noise(0.5, { at: 0.1, freq: 8000, gain: 0.06, type: 'highpass' });
      case 'stamp':
        this.tone(140, 0.35, { type: 'sine', gain: 0.6, to: 45 });
        return this.noise(0.12, { freq: 900, gain: 0.4, type: 'lowpass' });
      case 'charge':
        return this.tone(180, 0.9, { type: 'sawtooth', gain: 0.12, to: 900, attack: 0.3, filter: 1800 });
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          this.tone(620, 0.32, { type: 'sawtooth', gain: 0.11, at: i * 0.4, to: 880, filter: 2200 });
          this.tone(880, 0.08, { type: 'square', gain: 0.03, at: i * 0.4 + 0.3, filter: 1500 });
        }
        return;
      case 'heartbeat':
        this.tone(70, 0.18, { gain: 0.7, to: 40 });
        return this.tone(65, 0.22, { gain: 0.55, to: 38, at: 0.22 });
      case 'glitch':
        for (let i = 0; i < 6; i++) this.tone(200 + Math.random() * 1800, 0.04, { type: 'square', gain: 0.05, at: i * 0.045 });
        return;
      case 'blackout':
        this.tone(420, 0.7, { type: 'sawtooth', gain: 0.12, to: 30, filter: 900 });
        return this.noise(0.25, { freq: 200, gain: 0.25, type: 'lowpass' });
      case 'boom':
        this.tone(110, 1.2, { gain: 0.8, to: 28 });
        return this.noise(0.9, { freq: 600, to: 80, gain: 0.5, type: 'lowpass' });
      case 'shatter':
        this.noise(0.6, { freq: 6000, to: 2000, gain: 0.4, type: 'highpass' });
        for (let i = 0; i < 8; i++) this.tone(2000 + Math.random() * 3000, 0.15, { type: 'sine', gain: 0.05, at: Math.random() * 0.3 });
        return;
      case 'fanfare3':
        this.chord([392, 494, 587, 784], 0.9, { stagger: 0.07, gain: 0.13 });
        return this.chord([784, 988, 1175], 1.1, { at: 0.3, gain: 0.08, type: 'sine' });
      case 'fanfare4':
        this.chord([330, 415, 494, 659, 831], 1.4, { stagger: 0.06, gain: 0.12, type: 'sawtooth', filter: 2400 });
        this.chord([1319, 1661, 1976], 1.4, { at: 0.35, gain: 0.06, type: 'sine', stagger: 0.05 });
        return this.noise(1.2, { at: 0.2, freq: 9000, gain: 0.05, type: 'highpass' });
      case 'fanfare5':
        [0, 7, -5, 12].forEach((d, i) => this.tone(261.6, 2.4, { type: 'sawtooth', gain: 0.06, detune: d + i * 1200 - 1200, attack: 0.25, filter: 2000 }));
        this.chord([523, 659, 784, 1047, 1319, 1568], 2.2, { at: 0.1, stagger: 0.09, gain: 0.07, type: 'sine' });
        return this.noise(2, { at: 0.2, freq: 10000, gain: 0.05, type: 'highpass', attack: 0.4 });
      case 'hit':
        this.noise(0.08, { freq: 1500, gain: 0.25 });
        return this.tone(220, 0.1, { gain: 0.18, to: 110 });
      case 'crit':
        this.noise(0.15, { freq: 2500, gain: 0.35 });
        this.tone(330, 0.2, { type: 'square', gain: 0.1, to: 120, filter: 2000 });
        return this.tone(1200, 0.15, { type: 'triangle', gain: 0.08, at: 0.02 });
      case 'miss':
        return this.noise(0.18, { freq: 800, to: 3000, gain: 0.12, q: 3 });
      case 'ko':
        this.tone(200, 0.6, { type: 'sawtooth', gain: 0.15, to: 40, filter: 1200 });
        return this.noise(0.4, { freq: 400, gain: 0.3, type: 'lowpass' });
      case 'heal':
        return this.chord([660, 880, 1320], 0.5, { stagger: 0.05, gain: 0.07, type: 'sine' });
      case 'chime':
        return this.chord([1047, 1319, 1568], 0.5, { stagger: 0.05, gain: 0.07, type: 'sine' });
      case 'trophy':
        // golpe metálico + arpegio brillante (insignia)
        this.tone(2093, 0.9, { type: 'sine', gain: 0.06, attack: 0.002 });
        this.tone(3136, 0.6, { type: 'sine', gain: 0.03, attack: 0.002 });
        this.chord([784, 988, 1175, 1568], 0.7, { at: 0.06, stagger: 0.07, gain: 0.07, type: 'triangle' });
        return this.noise(0.5, { at: 0.1, freq: 9000, gain: 0.04, type: 'highpass' });
      case 'toggle':
        this.tone(1800, 0.03, { type: 'square', gain: 0.04 });
        return this.tone(900, 0.05, { type: 'square', gain: 0.03, at: 0.035 });
      case 'error':
        this.tone(220, 0.12, { type: 'square', gain: 0.06 });
        return this.tone(180, 0.18, { type: 'square', gain: 0.06, at: 0.13 });
      case 'victory':
        return this.chord([523, 659, 784, 1047], 1, { stagger: 0.1, gain: 0.12 });
      case 'defeat':
        return this.chord([392, 330, 262], 1, { stagger: 0.18, gain: 0.1, type: 'sine' });
    }
  }
}

export const sfx = new Synth();

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sin soporte */
  }
}
