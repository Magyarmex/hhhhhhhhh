// ── PROCEDURAL AMBIENT via Web Audio API ─────────────────────────────────────
// No external files required. Generates a spacey ambient drone in-browser.
export class StarAudio {
  constructor() {
    this._ctx       = null;
    this._master    = null;
    this._ambient   = null;
    this._dramatic  = null;
    this._started   = false;
    this._isDramatic= false;
  }

  _ensureContext() {
    if (this._ctx) return;
    this._ctx    = new (window.AudioContext || window.webkitAudioContext)();
    this._master = this._ctx.createGain();
    this._master.gain.value = 0.28;
    this._master.connect(this._ctx.destination);
    this._buildAmbient();
    this._buildDramatic();
  }

  // ── AMBIENT: low drone with slow harmonic shimmer ─────────────────────────
  _buildAmbient() {
    const ctx = this._ctx;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(this._master);
    this._ambientGain = g;

    const freqs = [55, 82.5, 110, 165, 220]; // A1 + harmonics
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i < 2 ? 'sine' : 'triangle';
      osc.frequency.value = f;

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.07 + i * 0.03;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = f * 0.004;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);

      const vol = ctx.createGain();
      vol.gain.value = 0.18 / (i + 1);
      osc.connect(vol); vol.connect(g);

      osc.start(); lfo.start();
    });

    this._ambient = g;
  }

  // ── DRAMATIC: tense low rumble + high dissonant note ─────────────────────
  _buildDramatic() {
    const ctx = this._ctx;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(this._master);
    this._dramaticGain = g;

    // Low rumble
    const rumble = ctx.createOscillator();
    rumble.type = 'sawtooth'; rumble.frequency.value = 36;
    const rumbleFilter = ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass'; rumbleFilter.frequency.value = 120;
    const rumbleVol = ctx.createGain(); rumbleVol.gain.value = 0.4;
    rumble.connect(rumbleFilter); rumbleFilter.connect(rumbleVol); rumbleVol.connect(g);

    // High tension note
    const tension = ctx.createOscillator();
    tension.type = 'sine'; tension.frequency.value = 880;
    const tremolo = ctx.createOscillator();
    tremolo.type = 'sine'; tremolo.frequency.value = 4.5;
    const tremoloGain = ctx.createGain(); tremoloGain.gain.value = 0.08;
    tremolo.connect(tremoloGain); tremoloGain.connect(tension.frequency);
    const tensionVol = ctx.createGain(); tensionVol.gain.value = 0.06;
    tension.connect(tensionVol); tensionVol.connect(g);

    rumble.start(); tension.start(); tremolo.start();
    this._dramatic = g;
  }

  // ── FIRST INTERACTION TRIGGER ─────────────────────────────────────────────
  start() {
    if (this._started) return;
    this._started = true;
    this._ensureContext();
    if (this._ctx.state === 'suspended') this._ctx.resume();
    this._ambientGain.gain.setTargetAtTime(1, this._ctx.currentTime, 1.5);
  }

  startDramatic() {
    if (!this._started) return;
    this._isDramatic = true;
    this._ambientGain.gain.setTargetAtTime(0.1, this._ctx.currentTime, 1.0);
    this._dramaticGain.gain.setTargetAtTime(1, this._ctx.currentTime, 1.0);
  }

  returnToAmbient() {
    if (!this._started) return;
    this._isDramatic = false;
    this._dramaticGain.gain.setTargetAtTime(0, this._ctx.currentTime, 1.5);
    this._ambientGain.gain.setTargetAtTime(1, this._ctx.currentTime, 2.0);
  }

  setVolume(v) {
    if (this._master) this._master.gain.setTargetAtTime(v, this._ctx.currentTime, 0.3);
  }
}
