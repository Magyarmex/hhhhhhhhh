// Music: Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 4.0
// "Mesmerize" (ambient) and "Impact Moderato" (dramatic)

export class StarAudio {
  constructor() {
    this._started   = false;
    this._ambient   = null;
    this._dramatic  = null;
    this._ambientId = null;
    this._dramaticId= null;
  }

  _load() {
    if (this._ambient) return;
    if (typeof Howl === 'undefined') return;

    this._ambient = new Howl({
      src: ['assets/music/ambient.mp3'],
      loop: true,
      volume: 0,
      preload: true,
      onloaderror: () => console.warn('Ambient music failed to load'),
    });

    this._dramatic = new Howl({
      src: ['assets/music/dramatic.mp3'],
      loop: true,
      volume: 0,
      preload: true,
      onloaderror: () => console.warn('Dramatic music failed to load'),
    });
  }

  start() {
    if (this._started) return;
    this._started = true;
    this._load();
    if (!this._ambient) return;

    this._ambientId = this._ambient.play();
    this._ambient.fade(0, 0.38, 2500, this._ambientId);
  }

  startDramatic() {
    if (!this._started || !this._ambient) return;

    // Fade ambient down (but keep it audible underneath)
    this._ambient.fade(0.38, 0.06, 1800, this._ambientId);

    // Bring in dramatic at low volume so TTS is clearly heard
    if (!this._dramaticId) {
      this._dramaticId = this._dramatic.play();
    }
    this._dramatic.fade(0, 0.14, 1800, this._dramaticId);
  }

  returnToAmbient() {
    if (!this._started || !this._ambient) return;

    // Fade out dramatic
    if (this._dramaticId) {
      this._dramatic.fade(0.14, 0, 2500, this._dramaticId);
      setTimeout(() => {
        this._dramatic.stop(this._dramaticId);
        this._dramaticId = null;
      }, 2600);
    }

    // Restore ambient
    this._ambient.fade(0.06, 0.38, 2500, this._ambientId);
  }

  setMasterVolume(v) {
    if (typeof Howler !== 'undefined') Howler.volume(v);
  }
}
