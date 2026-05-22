import { compute, PRESETS, FATE_LABELS, formatTemp, formatLum, formatRad, formatLife } from './star-physics.js';

export class StarUI {
  constructor(onStateChange, onPrueba) {
    this.onStateChange = onStateChange;
    this.onPrueba      = onPrueba;
    this.state = { mass:1, age:4.6, hydrogen:75 };
    this._bind();
    this._update();
  }

  _bind() {
    this._sliders = {
      mass:    document.getElementById('slider-mass'),
      age:     document.getElementById('slider-age'),
      hydrogen:document.getElementById('slider-h'),
    };
    this._nums = {
      mass:    document.getElementById('val-mass'),
      age:     document.getElementById('val-age'),
      hydrogen:document.getElementById('val-h'),
    };

    // Sync slider ↔ number input
    ['mass','age','hydrogen'].forEach(k => {
      const slider = this._sliders[k], num = this._nums[k];
      slider.addEventListener('input', () => {
        num.value = slider.value;
        this.state[k] = parseFloat(slider.value);
        this._update();
      });
      num.addEventListener('input', () => {
        const v = parseFloat(num.value);
        if (isNaN(v)) return;
        this.state[k] = v;
        // Clamp slider to its visual range
        slider.value = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), v));
        this._update();
      });
    });

    // Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = PRESETS[btn.dataset.preset];
        if (!p) return;
        this.state.mass     = p.mass;
        this.state.age      = p.age;
        this.state.hydrogen = p.hydrogen;
        this._syncInputs();
        this._update();
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // View toggle
    const viewBtn = document.getElementById('btn-view-toggle');
    viewBtn.addEventListener('click', () => {
      viewBtn.classList.toggle('active');
      const interior = viewBtn.classList.contains('active');
      viewBtn.textContent = interior ? '👁 Vista: Interior' : '👁 Vista: Exterior';
      this.onStateChange({ viewToggle: interior });
    });

    // Sun compare
    const sunBtn = document.getElementById('btn-sun-compare');
    sunBtn.addEventListener('click', () => {
      sunBtn.classList.toggle('active');
      this.onStateChange({ sunCompare: sunBtn.classList.contains('active') });
    });

    // Poner a prueba
    document.getElementById('btn-prueba').addEventListener('click', () => {
      this.onPrueba(this.state, this._lastComputed);
    });
  }

  _syncInputs() {
    ['mass','age','hydrogen'].forEach(k => {
      const v = this.state[k];
      this._nums[k].value = v;
      this._sliders[k].value = Math.max(parseFloat(this._sliders[k].min), Math.min(parseFloat(this._sliders[k].max), v));
    });
  }

  _update() {
    const { mass, age, hydrogen } = this.state;
    const c = compute(mass, age, hydrogen);
    this._lastComputed = c;
    this._updateZone(c);
    this._updateStats(c);
    this._updateSliderGradients(c);
    this.onStateChange({ physics: c, sliders: this.state });
  }

  _updateZone(c) {
    const dot  = document.getElementById('zone-dot');
    const text = document.getElementById('zone-text');
    dot.className = `zone-dot ${c.zone}`;
    const msgs = {
      green:  '🟢 La estrella está en equilibrio estable. La fusión nuclear equilibra perfectamente la gravedad.',
      orange: '🟠 La estrella se acerca al fin de su combustible. Los procesos internos empiezan a desestabilizarse.',
      red:    '🔴 El núcleo ha agotado su hidrógeno. Lo que suceda depende de su masa.',
    };
    text.textContent = msgs[c.zone];
  }

  _updateStats(c) {
    document.getElementById('stat-temp').textContent = formatTemp(c.temperature);
    document.getElementById('stat-lum').textContent  = formatLum(c.luminosity);
    document.getElementById('stat-rad').textContent  = formatRad(c.radius);
    document.getElementById('stat-life').textContent = formatLife(c.lifeLeftGyr);
    document.getElementById('stat-fate').textContent = FATE_LABELS[c.fate] || '—';
  }

  _updateSliderGradients(c) {
    // Mass slider gradient: green → orange at 8 M☉, orange → red at 20 M☉
    const massMax = 150;
    const orangePct = (8/massMax)*100;
    const redPct    = (20/massMax)*100;
    this._sliders.mass.style.background =
      `linear-gradient(to right, #2ecc71 0%, #2ecc71 ${orangePct.toFixed(1)}%, #f39c12 ${orangePct.toFixed(1)}%, #f39c12 ${redPct.toFixed(1)}%, #e74c3c ${redPct.toFixed(1)}%, #e74c3c 100%)`;

    // H slider: green above 20%, orange 5-20%, red below 5%
    this._sliders.hydrogen.style.background =
      `linear-gradient(to right, #e74c3c 0%, #e74c3c 5%, #f39c12 5%, #f39c12 20%, #2ecc71 20%, #2ecc71 100%)`;

    // Age slider: color shifts based on fraction of star's lifetime consumed
    const lifeMax   = 13; // Gyr range
    const ageVal    = Math.min(this.state.age, lifeMax);
    const mainLife  = Math.min(c.lifeLeftGyr + this.state.age, lifeMax);
    const greenEnd  = Math.min((mainLife*0.7/lifeMax)*100, 100).toFixed(1);
    const orangeEnd = Math.min((mainLife*0.9/lifeMax)*100, 100).toFixed(1);
    this._sliders.age.style.background =
      `linear-gradient(to right, #2ecc71 0%, #2ecc71 ${greenEnd}%, #f39c12 ${greenEnd}%, #f39c12 ${orangeEnd}%, #e74c3c ${orangeEnd}%, #e74c3c 100%)`;
  }

  setLoading(loading) {
    const btn = document.getElementById('btn-prueba');
    btn.disabled = loading;
    btn.classList.toggle('loading', loading);
  }

  disableAll() {
    this.setLoading(true);
    document.querySelectorAll('.sim-slider, .slider-input-num, .preset-btn, .ctrl-btn').forEach(el => el.disabled = true);
  }

  enableAll() {
    this.setLoading(false);
    document.querySelectorAll('.sim-slider, .slider-input-num, .preset-btn, .ctrl-btn').forEach(el => el.disabled = false);
  }

  getState() { return { ...this.state, computed: this._lastComputed }; }
}
