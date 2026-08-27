export class Sfx {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = 0.32;
    this.musicTimer = 0;
    this.beat = 0;
    this.enabledMusic = true;
    this.noise = null;
    this.chargeOsc = null;
    this.chargeGain = null;
    this.windGain = null;
  }

  ensure() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();

    this.masterNode = this.ctx.createGain();
    this.masterNode.gain.value = this.master;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 12;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    this.masterNode.connect(comp);
    comp.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.masterNode);

    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = "lowpass";
    this.musicFilter.frequency.value = 1400;
    this.musicGain.connect(this.musicFilter);
    this.musicFilter.connect(this.masterNode);

    this.noise = this.makeNoise(2);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.028;
    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 420;
    windFilter.Q.value = 0.7;
    const wind = this.ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    wind.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.masterNode);
    wind.start();
  }

  makeNoise(seconds) {
    const rate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, rate * seconds, rate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = last * 0.7 + (Math.random() * 2 - 1) * 0.3;
      data[i] = last;
    }
    return buf;
  }

  setMuted(v) {
    this.muted = v;
    this.ensure();
    if (this.masterNode && this.ctx) {
      this.masterNode.gain.setTargetAtTime(v ? 0.0001 : this.master, this.ctx.currentTime, 0.04);
    }
  }

  resume() {
    this.ensure();
    if (this.ctx?.state === "suspended") this.ctx.resume();
  }

  tone(freq, dur, type, vol, slide = 0, dest = null) {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(30, freq), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noiseBurst(dur, vol, freq = 800, q = 1.2, type = "bandpass") {
    if (this.muted || !this.ctx || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  hit() {
    this.ensure();
    this.noiseBurst(0.06, 0.22, 900, 0.8, "highpass");
    this.tone(210, 0.06, "square", 0.07, 0.4);
  }

  bonk() {
    this.ensure();
    this.noiseBurst(0.1, 0.28, 180, 0.6, "lowpass");
    this.tone(92, 0.14, "sine", 0.22, 0.45);
    this.tone(160, 0.08, "triangle", 0.1, 0.5);
  }

  crit() {
    this.ensure();
    this.noiseBurst(0.08, 0.18, 2400, 0.5, "highpass");
    this.tone(523, 0.09, "square", 0.1, 1.5);
    this.tone(784, 0.12, "triangle", 0.08, 1.2);
  }

  xp() {
    this.ensure();
    this.tone(980, 0.05, "sine", 0.045, 1.35);
  }

  level() {
    this.ensure();
    [392, 494, 587, 784].forEach((f, i) => {
      setTimeout(() => {
        this.tone(f, 0.16, "triangle", 0.1);
        this.tone(f * 2, 0.12, "sine", 0.04);
      }, i * 70);
    });
  }

  dash() {
    this.ensure();
    this.noiseBurst(0.14, 0.2, 700, 0.7, "bandpass");
    this.tone(140, 0.12, "sawtooth", 0.06, 2.4);
  }

  hurt() {
    this.ensure();
    this.noiseBurst(0.16, 0.22, 220, 0.8, "lowpass");
    this.tone(98, 0.18, "sawtooth", 0.12, 0.45);
  }

  death() {
    this.ensure();
    this.noiseBurst(0.35, 0.2, 140, 0.5, "lowpass");
    this.tone(196, 0.28, "sawtooth", 0.1, 0.35);
    this.tone(73, 0.5, "sine", 0.14, 0.4);
  }

  pickup() {
    this.ensure();
    this.tone(660, 0.07, "sine", 0.08, 1.4);
    this.tone(880, 0.1, "triangle", 0.05, 1.2);
  }

  win() {
    this.ensure();
    [523, 659, 784, 1046, 1318].forEach((f, i) => {
      setTimeout(() => this.tone(f, 0.22, "triangle", 0.1), i * 95);
    });
  }

  chest() {
    this.ensure();
    this.tone(330, 0.08, "square", 0.08);
    this.tone(440, 0.1, "square", 0.08);
    this.tone(660, 0.16, "triangle", 0.09);
    this.noiseBurst(0.08, 0.08, 1800, 0.4, "highpass");
  }

  ui() {
    this.ensure();
    this.tone(740, 0.05, "square", 0.05);
  }

  shrine() {
    this.ensure();
    this.tone(220, 0.18, "sine", 0.1);
    this.tone(330, 0.22, "triangle", 0.08);
  }

  chargeHum(amount) {
    this.ensure();
    if (this.muted || !this.ctx) return;
    if (!this.chargeOsc) {
      this.chargeOsc = this.ctx.createOscillator();
      this.chargeGain = this.ctx.createGain();
      this.chargeOsc.type = "sawtooth";
      this.chargeGain.gain.value = 0.0001;
      const f = this.ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 900;
      this.chargeOsc.connect(f);
      f.connect(this.chargeGain);
      this.chargeGain.connect(this.sfxBus);
      this.chargeOsc.start();
    }
    const t = this.ctx.currentTime;
    this.chargeOsc.frequency.setTargetAtTime(90 + amount * 220, t, 0.05);
    this.chargeGain.gain.setTargetAtTime(amount > 0.05 ? 0.04 + amount * 0.06 : 0.0001, t, 0.05);
  }

  tickMusic(dt, intensity) {
    if (this.muted || !this.enabledMusic) return;
    this.ensure();
    if (!this.ctx) return;
    this.musicTimer -= dt;
    const bpm = 100 + intensity * 36;
    const step = 60 / bpm / 2;
    if (this.musicTimer > 0) return;
    this.musicTimer = step;
    this.beat = (this.beat + 1) % 16;
    const t = this.ctx.currentTime;
    const chords = [
      [130.81, 164.81, 196],
      [146.83, 174.61, 220],
      [110, 146.83, 164.81],
      [123.47, 155.56, 196],
    ];
    const chord = chords[Math.floor(this.beat / 4) % chords.length];

    if (this.beat % 4 === 0) {
      this.tone(58, 0.12, "sine", 0.55, 0.7, this.musicGain);
      this.noiseBurst(0.05, 0.12, 80, 0.4, "lowpass");
    }
    if (this.beat % 4 === 2) {
      this.tone(chord[0], 0.18, "triangle", 0.22, 0, this.musicGain);
    }
    if (this.beat % 2 === 1) {
      const n = chord[this.beat % chord.length] * 2;
      this.tone(n, 0.09, "triangle", 0.12 + intensity * 0.08, 0, this.musicGain);
    }
    if (intensity > 0.35 && this.beat % 2 === 0) {
      this.noiseBurst(0.03, 0.05 + intensity * 0.04, 6000, 0.4, "highpass");
    }
    this.musicFilter.frequency.setTargetAtTime(1100 + intensity * 1800, t, 0.2);
  }
}
