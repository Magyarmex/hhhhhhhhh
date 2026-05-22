import * as THREE from 'three';

// ── BUBBLE SYSTEM ─────────────────────────────────────────────────────────────
class BubbleSystem {
  constructor(layer) { this.layer = layer; this._current = null; }

  async show(text, screenX, screenY) {
    this.hide();
    const el = document.createElement('div');
    el.className = 'narration-bubble';
    el.textContent = text;
    el.style.left = screenX + 'px';
    el.style.top  = screenY + 'px';
    this.layer.appendChild(el);
    this._current = el;
    requestAnimationFrame(() => el.classList.add('visible'));
  }

  hide() {
    if (this._current) { this._current.remove(); this._current = null; }
  }

  updatePosition(x, y) {
    if (this._current) { this._current.style.left = x+'px'; this._current.style.top = y+'px'; }
  }
}

// ── LAYER TOOLTIP ─────────────────────────────────────────────────────────────
let _tooltipEl = null;
export function showLayerTooltip(name, tip, x, y) {
  if (_tooltipEl) _tooltipEl.remove();
  _tooltipEl = document.createElement('div');
  _tooltipEl.className = 'layer-tooltip';
  _tooltipEl.innerHTML = `<strong>${name}</strong><br>${tip}`;
  _tooltipEl.style.position = 'fixed';
  _tooltipEl.style.left = x + 12 + 'px';
  _tooltipEl.style.top  = y - 40 + 'px';
  _tooltipEl.style.zIndex = '100';
  document.body.appendChild(_tooltipEl);
  setTimeout(() => { if (_tooltipEl) { _tooltipEl.remove(); _tooltipEl = null; } }, 3500);
}

// ── CINEMATIC CONTROLLER ──────────────────────────────────────────────────────
export class CinematicController {
  constructor(scene, narration, audio) {
    this.scene     = scene;
    this.narration = narration;
    this.audio     = audio;
    this.bubbles   = new BubbleSystem(document.getElementById('bubbles-layer'));
    this.skipBtn   = document.getElementById('btn-skip');
    this.retryBtn  = document.getElementById('btn-retry');
    this._skipRequested = false;
    this.skipBtn.addEventListener('click', () => {
      this._skipRequested = true;
      window.speechSynthesis?.cancel();
    });
  }

  async run(fate, sliderState, physics) {
    this._skipRequested = false;
    this.skipBtn.style.display = 'block';

    // Trigger dramatic music
    this.audio?.startDramatic();

    // Generate narration (with 8s timeout fallback)
    const narrationData = await Promise.race([
      this.narration.generate(fate, sliderState, physics),
      new Promise(r => setTimeout(() => r(null), 8000))
    ]) || this.narration.getFallback(fate);

    // STAGE 1: Nucleus
    await this._stage1(narrationData.etapa1 || []);

    // STAGE 2: Fate animation
    await this._stage2(fate, narrationData.etapa2 || []);

    this.skipBtn.style.display = 'none';
    this.bubbles.hide();
    this.retryBtn.style.display = 'block';
  }

  async _stage1(segments) {
    // Ensure interior mode
    if (!this.scene.state.interiorMode) await this.scene.toggleInterior(true);

    // Zoom into nucleus
    await this._moveCam({ x:0, y:0, z:2.5 }, 2.0);

    for (const seg of segments) {
      if (this._skipRequested) break;
      const anchor = this.scene.getAnchorWorld(seg.ancla || 'nucleo');
      const sc = this.scene.project(anchor);
      await this.bubbles.show(seg.texto, sc.x, sc.y);
      await this.narration.speak(seg.texto);
      await this._wait(300);
    }
  }

  async _stage2(fate, segments) {
    // Zoom out to show full star
    await this._moveCam({ x:0, y:4, z:22 }, 2.0);
    if (this.scene.state.interiorMode) await this.scene.toggleInterior(false);

    // Show 1st stage2 segment
    const s0 = segments[0];
    if (s0 && !this._skipRequested) {
      const anchor = this.scene.getAnchorWorld(s0.ancla || 'estrella');
      const sc = this.scene.project(anchor);
      await this.bubbles.show(s0.texto, sc.x, sc.y);
      await this.narration.speak(s0.texto);
    }
    this.bubbles.hide();

    // Run fate-specific animation
    await this._runFateAnim(fate);

    // Remaining segments after animation
    for (let i = 1; i < segments.length; i++) {
      if (this._skipRequested) break;
      const seg = segments[i];
      const anchor = this.scene.getAnchorWorld(seg.ancla || 'estrella');
      const sc = this.scene.project(anchor);
      await this.bubbles.show(seg.texto, sc.x, sc.y);
      await this.narration.speak(seg.texto);
      await this._wait(300);
    }
  }

  async _runFateAnim(fate) {
    switch(fate) {
      case 'stable':      return this._animStable();
      case 'whiteDwarf':  return this._animWhiteDwarf();
      case 'neutronStar': return this._animNeutronStar();
      case 'blackHole':   return this._animBlackHole();
      case 'brownDwarf':  return this._animBrownDwarf();
    }
  }

  async _animStable() {
    const star = this.scene.starMesh;
    // Gentle glow pulse
    for (let i = 0; i < 3; i++) {
      await this._tween(this.scene.bloomPass, { strength:1.8 }, 1.5);
      await this._tween(this.scene.bloomPass, { strength:1.1 }, 1.5);
    }
    this.scene.bloomPass.strength = this.scene.bloomStrength;
    this.audio?.returnToAmbient();
  }

  async _animWhiteDwarf() {
    const star = this.scene.starMesh;
    const originalScale = star.scale.x;

    // Expand to red giant
    this.scene.starMat.uniforms.uColor.value.setRGB(1,0.2,0.05);
    await this._tween(star.scale, { x:originalScale*4, y:originalScale*4, z:originalScale*4 }, 3.5);
    await this._moveCam({ x:0, y:10, z:50 }, 2);

    // Shell ejection: particles explode outward
    this._spawnEjecta(0xff4400, 200, 18);
    await this._wait(1500);

    // Core shrinks to white dwarf
    await this._tween(star.scale, { x:0.15, y:0.15, z:0.15 }, 2.5);
    this.scene.starMat.uniforms.uColor.value.setRGB(0.85, 0.90, 1.0);
    this.scene.bloomPass.strength = 2.2;
    await this._moveCam({ x:0, y:1, z:5 }, 2);
    await this._wait(2000);
    this.scene.bloomPass.strength = this.scene.bloomStrength;
    this.audio?.returnToAmbient();
  }

  async _animNeutronStar() {
    const star = this.scene.starMesh;
    const originalScale = star.scale.x;

    // Rapid collapse flash
    this.scene.bloomPass.strength = 3.5;
    await this._tween(star.scale, { x:0.05, y:0.05, z:0.05 }, 0.8);
    await this._wait(200);

    // Shockwave
    const wave = this._makeShockwave();
    await this._tween(wave.scale, { x:30, y:30, z:30 }, 3.0);
    this.scene.scene.remove(wave);

    // Evaporate inner planets
    await this._evaporatePlanets([0,1,2,3]);
    await this._moveCam({ x:0, y:20, z:60 }, 1.5);

    // Pulsar spin
    this.scene.starMat.uniforms.uColor.value.setRGB(0.5, 0.7, 1.0);
    const beam = this._makePulsarBeam();
    for (let i=0; i<4; i++) {
      beam.rotation.z += Math.PI/2;
      await this._wait(800);
    }
    this.scene.scene.remove(beam);
    await this._wait(1000);
    this.audio?.returnToAmbient();
  }

  async _animBlackHole() {
    const star = this.scene.starMesh;

    // Hypernova flash
    this.scene.bloomPass.strength = 5.0;
    await this._wait(400);
    this.scene.bloomPass.strength = 0.5;

    // Massive shockwave
    const wave = this._makeShockwave(0xff6600);
    await this._moveCam({ x:0, y:30, z:100 }, 2.5);
    await this._tween(wave.scale, { x:80, y:80, z:80 }, 4.0);
    this.scene.scene.remove(wave);

    // Evaporate ALL planets
    await this._evaporatePlanets([0,1,2,3,4,5,6,7]);
    await this._wait(500);

    // Implosion
    await this._tween(star.scale, { x:0.02, y:0.02, z:0.02 }, 1.2);
    this.scene.starMat.uniforms.uColor.value.setRGB(0,0,0);

    // Accretion disk
    const disk = this._makeAccretionDisk();
    this.scene.scene.add(disk);
    await this._moveCam({ x:0, y:8, z:25 }, 2.5);

    // Gravitational lens
    this.scene.lensPass.enabled = true;
    await this._tween(this.scene.lensPass.uniforms.uStrength, { value: 0.06 }, 2.5);
    this.scene.bloomPass.strength = 2.5;
    await this._wait(3000);
    this.audio?.returnToAmbient();
  }

  async _animBrownDwarf() {
    // Dim the star - never ignited
    await this._tween(this.scene.starMesh.material.uniforms?.uColor?.value || {}, {}, 1.0);
    this.scene.starMat.uniforms.uColor.value.setRGB(0.35, 0.15, 0.05);
    this.scene.bloomPass.strength = 0.3;
    await this._tween(this.scene.starMesh.scale, { x:0.3, y:0.3, z:0.3 }, 2.0);
    await this._wait(3000);
    this.scene.bloomPass.strength = this.scene.bloomStrength;
    this.audio?.returnToAmbient();
  }

  // ── HELPERS ─────────────────────────────────────────────────────────────────
  _moveCam(pos, dur) {
    return new Promise(r => {
      if (typeof gsap === 'undefined') { setTimeout(r, dur*1000); return; }
      gsap.to(this.scene.camera.position, { ...pos, duration:dur, ease:'power2.inOut', onComplete:r });
    });
  }

  _tween(obj, props, dur) {
    return new Promise(r => {
      if (typeof gsap === 'undefined') { setTimeout(r, dur*1000); return; }
      gsap.to(obj, { ...props, duration:dur, ease:'power2.inOut', onComplete:r });
    });
  }

  _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  _makeShockwave(color=0xffaa44) {
    const geo = new THREE.SphereGeometry(1, 32, 32);
    const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.25, wireframe:true });
    const mesh = new THREE.Mesh(geo, mat);
    this.scene.scene.add(mesh);
    return mesh;
  }

  _makePulsarBeam() {
    const geo = new THREE.CylinderGeometry(0.04, 0.04, 50, 8);
    const mat = new THREE.MeshBasicMaterial({ color:0x88ccff, transparent:true, opacity:0.6 });
    const beam = new THREE.Mesh(geo, mat);
    beam.rotation.z = Math.PI/2;
    this.scene.scene.add(beam);
    return beam;
  }

  _makeAccretionDisk() {
    const geo = new THREE.TorusGeometry(1.8, 0.35, 16, 128);
    const mat = new THREE.MeshBasicMaterial({ color:0xff6600 });
    const disk = new THREE.Mesh(geo, mat);
    if (typeof gsap !== 'undefined') gsap.to(disk.rotation, { y: Math.PI*2*10, duration:20, repeat:-1, ease:'none' });
    return disk;
  }

  async _evaporatePlanets(indices) {
    const planet = this.scene.planets;
    const jobs = indices.map(i => {
      if (!planet[i]) return Promise.resolve();
      return new Promise(r => {
        if (typeof gsap === 'undefined') { planet[i].visible=false; r(); return; }
        gsap.to(planet[i].material, { opacity:0, duration:1.5, ease:'power2.in',
          onStart: () => planet[i].material.transparent = true,
          onComplete: () => { planet[i].visible = false; planet[i].material.opacity=1; r(); }
        });
        gsap.to(planet[i].scale, { x:2.5, y:2.5, z:2.5, duration:1.2, ease:'power1.in' });
      });
    });
    await Promise.all(jobs);
  }

  _spawnEjecta(color, count, spread) {
    for (let i=0; i<count; i++) {
      const geo = new THREE.SphereGeometry(0.05, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.8 });
      const p = new THREE.Mesh(geo, mat);
      const dir = new THREE.Vector3().randomDirection().multiplyScalar(spread);
      this.scene.scene.add(p);
      if (typeof gsap !== 'undefined') {
        gsap.to(p.position, { x:dir.x, y:dir.y, z:dir.z, duration:3, ease:'power1.out' });
        gsap.to(p.material, { opacity:0, duration:3, ease:'power1.in', onComplete:() => this.scene.scene.remove(p) });
      }
    }
  }
}
