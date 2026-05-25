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
  loadingText.textContent = STEPS[Math.min(loadStep, STEPS.length-1)];
  loadStep++;
}

// ── GSAP SHIM ─────────────────────────────────────────────────────────────────
if (!window.gsap) {
  window.gsap = {
    to: (obj, opts) => { setTimeout(() => opts.onComplete?.(), (opts.duration||1)*1000); },
    fromTo: (obj, from, opts) => { setTimeout(() => opts.onComplete?.(), (opts.duration||1)*1000); },
  };
}

// ── STATE ─────────────────────────────────────────────────────────────────────
let isAnimating = false;
let scene, ui, cinema, narration, audio;

// ── NAV TAB SWITCH (body class for full-width layout) ─────────────────────────
function initTabSwitch() {
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const section = tab.dataset.section;
      if (section === 'star-sim') {
        document.body.classList.add('star-sim-mode');
        if (scene) setTimeout(() => scene._onResize(), 50);
      } else {
        document.body.classList.remove('star-sim-mode');
      }
    });
  });
}

// ── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  initTabSwitch();
  const section = document.getElementById('star-sim');

  const observer = new MutationObserver(() => {
    if (section.classList.contains('active') && !scene) startScene();
  });
  observer.observe(section, { attributes:true, attributeFilter:['class'] });

  if (section.classList.contains('active')) startScene();
}

function startScene() {
  loadingScreen.style.display = 'flex';
  loadingScreen.classList.remove('hidden');
  advanceLoad(10);

  const container = document.getElementById('three-canvas-container');
  const css2dCont = document.getElementById('css2d-container');

  audio     = new StarAudio();
  narration = new StarNarration();
  advanceLoad(35);

  scene = new StarScene(container, css2dCont);
  advanceLoad(70);

  scene.onLayerClick = showLayerTooltip;
  cinema = new CinematicController(scene, narration, audio);

  ui = new StarUI(
    ({ physics, sliders, viewToggle, sunCompare }) => {
      if (physics && sliders) scene.updateStar(physics);
      if (viewToggle !== undefined) scene.toggleInterior(viewToggle);
      if (sunCompare !== undefined) scene.toggleSunGhost(sunCompare);
    },
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

  // ── RETRY ────────────────────────────────────────────────────────────────────
  document.getElementById('btn-retry').addEventListener('click', () => {
    document.getElementById('btn-retry').style.display = 'none';
    narration.cancel();
    audio.returnToAmbient();

    // Kill any running GSAP tweens on scene objects before resetting state
    if (window.gsap) {
      gsap.killTweensOf(scene.starMesh.scale);
      gsap.killTweensOf(scene.starMat.uniforms.uColor.value);
      gsap.killTweensOf(scene.coronaMesh.scale);
      gsap.killTweensOf(scene.coronaMesh.material);
      gsap.killTweensOf(scene.bloomPass);
      gsap.killTweensOf(scene.camera.position);
      if (scene.lensPass.uniforms?.uStrength) gsap.killTweensOf(scene.lensPass.uniforms.uStrength);
      if (scene.hazeMesh) gsap.killTweensOf(scene.hazeMesh.material);
      scene.planets.forEach(p => { gsap.killTweensOf(p.scale); gsap.killTweensOf(p.material); });
    }

    // Clean up cinematic objects (kills their GSAP tweens internally)
    cinema.cleanupCinematicObjects();

    // Resume flare spawning
    scene._cinemaPaused = false;

    // Restore visibility of objects that animations may have hidden
    scene.starMesh.visible   = true;
    scene.coronaMesh.visible = true;
    if (scene.hazeMesh) scene.hazeMesh.visible = true;

    // Exit interior mode if it was active when skip was clicked
    if (scene.state.interiorMode) {
      scene.state.interiorMode  = false;
      scene.interiorGroup.visible = false;
      scene.macroParticles.visible = false;
      scene.microGroup.visible  = false;
      scene.clippingPlane.constant = 500;
      scene.gridGroup.visible   = true;
    }

    // Restore star physics (resets color, scale, corona opacity, haze opacity)
    const { sliders, computed } = ui.getState();
    scene.updateStar(computed);

    // Restore planets
    scene.planets.forEach(p => {
      p.visible = true;
      p.scale.setScalar(1);
      if (p.material) { p.material.opacity = 1; p.material.transparent = false; }
    });

    // Restore post-processing
    scene.bloomPass.strength = scene.bloomStrength;
    scene.lensPass.enabled = false;
    if (scene.lensPass.uniforms?.uStrength) scene.lensPass.uniforms.uStrength.value = 0;

    // Explicit scale reset (updateStar already does this, belt-and-suspenders)
    scene.starMesh.scale.setScalar(Math.max(0.08, computed.radius));
    scene.coronaMesh.scale.setScalar(Math.max(0.08, computed.radius) * 1.08);

    // Reset camera (started after kills so this tween runs cleanly)
    if (window.gsap) gsap.to(scene.camera.position, { x:0, y:8, z:25, duration:1.5, ease:'power2.inOut' });
    scene.controls.autoRotate = true;
  });

  // ── FIRST INTERACTION → AUDIO ─────────────────────────────────────────────
  document.getElementById('star-sim').addEventListener('click',  () => audio.start(), { capture:true });
  document.getElementById('star-sim').addEventListener('input',  () => audio.start(), { capture:true });

  advanceLoad(100);
  setTimeout(() => {
    loadingScreen.classList.add('hidden');
    setTimeout(() => { loadingScreen.style.display = 'none'; }, 700);
  }, 500);
}

document.addEventListener('DOMContentLoaded', init);
