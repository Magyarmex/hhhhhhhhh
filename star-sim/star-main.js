import { StarScene } from './star-scene.js';
import { StarUI } from './star-ui.js';
import { CinematicController, showLayerTooltip } from './star-cinema.js';
import { StarNarration } from './star-narration.js';
import { StarAudio } from './star-audio.js';

// ── LOADING SCREEN ────────────────────────────────────────────────────────────
const loadingScreen = document.getElementById('loading-screen');
const loadingBar    = document.getElementById('loading-bar');
const loadingText   = document.getElementById('loading-text');
const STEPS = ['Encendiendo el núcleo…','Posicionando planetas…','Calibrando fusión nuclear…','Iniciando sistema solar…','Listo.'];
let loadStep = 0;
function advanceLoad(pct) {
  loadingBar.style.width = pct + '%';
  loadingText.textContent = STEPS[loadStep] || STEPS[STEPS.length-1];
  loadStep++;
}
advanceLoad(10);

// ── GSAP (loaded via CDN in HTML) ─────────────────────────────────────────────
// Polyfill: if GSAP isn't on window, provide a no-op shim so code doesn't break
if (!window.gsap) {
  window.gsap = {
    to: (obj, opts) => {
      const dur = (opts.duration||1)*1000;
      setTimeout(() => { opts.onComplete?.(); }, dur);
    }
  };
}

// ── INIT ─────────────────────────────────────────────────────────────────────
let isAnimating = false;
let scene, ui, cinema, narration, audio;

function init() {
  const section = document.getElementById('star-sim');

  // Only init when user navigates to star-sim tab
  const observer = new MutationObserver(() => {
    if (section.classList.contains('active') && !scene) {
      startScene();
    }
  });
  observer.observe(section, { attributes:true, attributeFilter:['class'] });

  // If already active on load
  if (section.classList.contains('active')) startScene();
}

function startScene() {
  // Show loading screen while Three.js initializes
  loadingScreen.style.display = 'flex';
  loadingScreen.classList.remove('hidden');
  advanceLoad(30);

  const container   = document.getElementById('three-canvas-container');
  const css2dCont   = document.getElementById('css2d-container');

  // Systems
  audio     = new StarAudio();
  narration = new StarNarration();
  advanceLoad(50);

  scene = new StarScene(container, css2dCont);
  advanceLoad(75);

  // Layer click → tooltip
  scene.onLayerClick = (name, tip, x, y) => showLayerTooltip(name, tip, x, y);

  cinema = new CinematicController(scene, narration, audio);

  ui = new StarUI(
    // onStateChange
    ({ physics, sliders, viewToggle, sunCompare }) => {
      if (physics && sliders) scene.updateStar(physics);
      if (viewToggle !== undefined) scene.toggleInterior(viewToggle);
      if (sunCompare !== undefined) scene.toggleSunGhost(sunCompare);
    },
    // onPrueba
    async (sliders, physics) => {
      if (isAnimating) return;
      isAnimating = true;
      ui.disableAll();
      document.getElementById('btn-retry').style.display = 'none';

      try {
        await cinema.run(physics.fate, sliders, physics);
      } finally {
        isAnimating = false;
        ui.enableAll();
      }
    }
  );

  // Retry button
  document.getElementById('btn-retry').addEventListener('click', () => {
    document.getElementById('btn-retry').style.display = 'none';
    narration.cancel();
    audio.returnToAmbient();

    // Restore star to healthy state
    const { sliders, computed } = ui.getState();
    scene.updateStar(computed);
    scene.planets.forEach(p => { p.visible = true; p.material.opacity = 1; p.scale.setScalar(1); });
    scene.bloomPass.strength = scene.bloomStrength;
    scene.lensPass.enabled = false;
    scene.camera.position.set(0, 8, 25);

    // Restore star scale
    const r = computed.radius;
    scene.starMesh.scale.setScalar(Math.max(0.1, r));
  });

  // First interaction → start audio
  const simSection = document.getElementById('star-sim');
  ['click','input'].forEach(evt => {
    simSection.addEventListener(evt, () => audio.start(), { capture:true });
  });

  advanceLoad(100);
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
    setTimeout(() => loadingScreen.style.display = 'none', 700);
  }, 400);
}

document.addEventListener('DOMContentLoaded', () => { init(); });
