import * as THREE from 'three';

// ── BUBBLE SYSTEM ─────────────────────────────────────────────────────────────
class BubbleSystem {
  constructor(layer) { this.layer = layer; this._current = null; }

  show(text, screenX, screenY) {
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

  hide() { if (this._current) { this._current.remove(); this._current = null; } }
}

// ── LAYER TOOLTIP ─────────────────────────────────────────────────────────────
let _tooltipEl = null;
export function showLayerTooltip(name, tip, x, y) {
  if (_tooltipEl) _tooltipEl.remove();
  _tooltipEl = document.createElement('div');
  _tooltipEl.className = 'layer-tooltip';
  _tooltipEl.innerHTML = `<strong>${name}</strong><br>${tip}`;
  Object.assign(_tooltipEl.style, { position:'fixed', left:x+14+'px', top:y-44+'px', zIndex:'100' });
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
    this._skipReq  = false;
    this.accretionDisk = null;
    this._cinematicObjs = [];

    this.skipBtn.addEventListener('click', () => {
      this._skipReq = true;
      window.speechSynthesis?.cancel();
    });
  }

  async run(fate, sliderState, physics) {
    this._skipReq = false;
    this.skipBtn.style.display = 'block';
    this.audio?.startDramatic();
    this.scene.controls.autoRotate = false;
    this.scene._cinemaPaused = true;

    const narrationData = await Promise.race([
      this.narration.generate(fate, sliderState, physics),
      new Promise(r => setTimeout(() => r(null), 8000))
    ]) || this.narration.getFallback(fate);

    await this._stage1(narrationData.etapa1 || []);
    await this._stage2(fate, narrationData.etapa2 || []);

    this.scene._cinemaPaused = false;
    this.skipBtn.style.display = 'none';
    this.bubbles.hide();
    document.getElementById('btn-retry').style.display = 'block';
  }

  async _stage1(segments) {
    if (!this.scene.state.interiorMode) await this.scene.toggleInterior(true);
    // Adaptive camera: stays outside the star regardless of its radius
    const r = Math.max(this.scene.state.radius, 1);
    await this._moveCam({ x: r * 0.8, y: r * 1.0, z: Math.max(4.5, r * 5.5) }, 2.2);

    for (const seg of segments) {
      if (this._skipReq) break;
      const anchor = this.scene.getAnchorWorld(seg.ancla || 'nucleo');
      const sc = this.scene.project(anchor);
      this.bubbles.show(seg.texto, sc.x, sc.y);
      await this.narration.speak(seg.texto);
      await this._wait(250);
    }
    this.bubbles.hide();
  }

  async _stage2(fate, segments) {
    await this._moveCam({ x:0, y:5, z:24 }, 2.0);
    if (this.scene.state.interiorMode) await this.scene.toggleInterior(false);

    if (segments[0] && !this._skipReq) {
      const anchor = this.scene.getAnchorWorld(segments[0].ancla || 'estrella');
      const sc = this.scene.project(anchor);
      this.bubbles.show(segments[0].texto, sc.x, sc.y);
      await this.narration.speak(segments[0].texto);
    }
    this.bubbles.hide();

    await this._runFateAnim(fate);

    for (let i=1; i<segments.length; i++) {
      if (this._skipReq) break;
      const seg = segments[i];
      const anchor = this.scene.getAnchorWorld(seg.ancla || 'estrella');
      const sc = this.scene.project(anchor);
      this.bubbles.show(seg.texto, sc.x, sc.y);
      await this.narration.speak(seg.texto);
      await this._wait(300);
    }
    this.bubbles.hide();
    this.scene.controls.autoRotate = true;
  }

  async _runFateAnim(fate) {
    switch(fate) {
      case 'stable':      return this._animStable();
      case 'whiteDwarf':  return this._animWhiteDwarf();
      case 'supernova':   return this._animSupernova();
      case 'neutronStar': return this._animNeutronStar();
      case 'blackHole':   return this._animBlackHole();
      case 'brownDwarf':  return this._animBrownDwarf();
      default:            return this._animStable();
    }
  }

  // ── FATE ANIMATIONS ───────────────────────────────────────────────────────────

  async _animStable() {
    const base = this.scene.bloomStrength;
    this.scene.controls.autoRotate = true;
    this.scene.controls.autoRotateSpeed = 1.2;

    for (let i = 0; i < 3; i++) {
      await this._tween(this.scene.bloomPass, { strength: base * 2.2 }, 1.0);
      if (i === 1) for (let j = 0; j < 5; j++) this.scene._spawnFlare();
      await this._tween(this.scene.bloomPass, { strength: base * 0.75 }, 1.3);
    }

    this.scene.controls.autoRotateSpeed = 0.4;
    this.scene.bloomPass.strength = base;
    this.audio?.returnToAmbient();
  }

  async _animWhiteDwarf() {
    const s  = this.scene.starMesh.scale.x;
    const cs = this.scene.coronaMesh.scale.x;
    const targetScale = Math.min(s * 4.5, 10);

    // Phase 1: red giant expansion — star, corona and haze all grow together
    const expandTargets = [
      this._tweenColor(this.scene.starMat.uniforms.uColor.value, 1.0, 0.18, 0.04, 2.5),
      this._tweenColor(this.scene.coronaMesh.material.color,     1.0, 0.18, 0.04, 2.5),
      this._tween(this.scene.bloomPass,       { strength: 2.8 }, 1.5),
      this._tween(this.scene.starMesh.scale,   { x: targetScale,        y: targetScale,        z: targetScale        }, 4.0),
      this._tween(this.scene.coronaMesh.scale, { x: targetScale * 1.08, y: targetScale * 1.08, z: targetScale * 1.08 }, 4.0),
    ];
    if (this.scene.hazeMesh) expandTargets.push(
      this._tween(this.scene.hazeMesh.scale, { x: targetScale * 1.6, y: targetScale * 1.6, z: targetScale * 1.6 }, 4.0)
    );
    await Promise.all(expandTargets);

    const camZ = Math.max(55, targetScale * 9 + 12);
    await this._moveCam({ x: 0, y: targetScale * 1.4, z: camZ }, 1.8);
    await this._wait(800);

    // Phase 2: planetary nebula shell ejected
    this._makePlanetaryNebula(targetScale);
    await this._wait(700);

    // Core collapses to white dwarf — corona fades, haze disappears
    await Promise.all([
      this._tween(this.scene.starMesh.scale,      { x: 0.12, y: 0.12, z: 0.12 }, 3.0),
      this._tween(this.scene.coronaMesh.scale,    { x: 0.13, y: 0.13, z: 0.13 }, 2.5),
      this._tween(this.scene.coronaMesh.material, { opacity: 0 }, 2.0),
    ]);
    if (this.scene.hazeMesh) this.scene.hazeMesh.visible = false;

    // Phase 3: brilliant blue-white dwarf revealed
    await Promise.all([
      this._tweenColor(this.scene.starMat.uniforms.uColor.value, 0.85, 0.92, 1.0, 1.5),
      this._tween(this.scene.bloomPass, { strength: 3.8 }, 1.5),
    ]);

    await this._moveCam({ x: 4, y: 6, z: camZ * 0.5 }, 2.5);
    await this._wait(3500);

    this.scene.bloomPass.strength = this.scene.bloomStrength;
    this.audio?.returnToAmbient();
  }

  async _animSupernova() {
    const s  = this.scene.starMesh.scale.x;
    const cs = this.scene.coronaMesh.scale.x;

    // Pre-collapse instability flicker
    await this._flickerStar(5, 200);

    // Expand pre-collapse — corona follows the star
    await Promise.all([
      this._tweenColor(this.scene.starMat.uniforms.uColor.value, 1.0, 0.38, 0.04, 1.2),
      this._tween(this.scene.starMesh.scale,   { x: s * 3,  y: s * 3,  z: s * 3  }, 1.8),
      this._tween(this.scene.coronaMesh.scale, { x: cs * 3, y: cs * 3, z: cs * 3 }, 1.8),
    ]);
    if (this.scene.hazeMesh) this.scene.hazeMesh.visible = false;

    // DETONATION — white flash
    this.scene.bloomPass.strength = 9.0;
    this._screenShake(1.4, 18);
    await this._wait(100);
    this.scene.bloomPass.strength = 0.8;
    await this._wait(60);
    this.scene.bloomPass.strength = 7.5;
    await this._wait(130);
    this.scene.bloomPass.strength = 2.8;

    // Original star and corona vanish — only the explosion remains
    this.scene.starMesh.visible   = false;
    this.scene.coronaMesh.visible = false;

    // Staggered ring shockwaves
    const w1 = this._makeRingWave(0xff8833, 0.95,  0);
    const w2 = this._makeRingWave(0xffcc44, 0.75, 28);
    const w3 = this._makeRingWave(0xffe8aa, 0.50, 55);

    await this._moveCam({ x: 0, y: 28, z: 85 }, 2.5);
    await Promise.all([
      this._tween(w1.mesh.scale, { x: 65, y: 65, z: 65 }, 5.0),
      this._tween(w1.mat, { opacity: 0 }, 5.0),
      this._tween(w2.mesh.scale, { x: 50, y: 50, z: 50 }, 4.5),
      this._tween(w2.mat, { opacity: 0 }, 4.5),
      this._tween(w3.mesh.scale, { x: 38, y: 38, z: 38 }, 4.0),
      this._tween(w3.mat, { opacity: 0 }, 4.0),
    ]);
    [w1, w2, w3].forEach(w => this._removeCinematic(w.mesh));

    await this._evaporatePlanets([0, 1, 2, 3]);
    this._spawnNebulaCloud(0xff4400, 350, 32);
    this._spawnNebulaCloud(0x4488ff, 220, 28);
    this._spawnNebulaCloud(0xffcc44, 160, 25);
    this._spawnNebulaCloud(0x88ffcc, 100, 22);
    await this._wait(1800);

    // Neutron star emerges — tiny blue dot, no corona
    this.scene.starMesh.visible = true;
    this.scene.starMesh.scale.setScalar(0.07);
    await Promise.all([
      this._tweenColor(this.scene.starMat.uniforms.uColor.value, 0.5, 0.75, 1.0, 1.0),
      this._tween(this.scene.bloomPass, { strength: 3.2 }, 1.0),
    ]);
    await this._moveCam({ x: 0, y: 6, z: 22 }, 2.0);

    const beam = this._makePulsarBeam();
    await this._wait(4500);
    this._removeCinematic(beam);

    await this._wait(800);
    if (window.gsap) gsap.killTweensOf(this.scene.bloomPass);
    this.scene.bloomPass.strength = this.scene.bloomStrength;
    this.audio?.returnToAmbient();
  }

  async _animNeutronStar() {
    const s  = this.scene.starMesh.scale.x;
    const cs = this.scene.coronaMesh.scale.x;

    // Pre-collapse instability
    await this._flickerStar(3, 180);

    // Rapid collapse — corona fades simultaneously
    this.scene.bloomPass.strength = 5.5;
    this._screenShake(1.0, 14);
    await Promise.all([
      this._tween(this.scene.starMesh.scale,      { x: 0.07, y: 0.07, z: 0.07 }, 0.55),
      this._tween(this.scene.coronaMesh.material, { opacity: 0 }, 0.40),
    ]);
    this.scene.coronaMesh.visible = false;
    if (this.scene.hazeMesh) this.scene.hazeMesh.visible = false;
    await this._wait(80);
    this.scene.bloomPass.strength = 1.0;

    // Shockwave
    const w1 = this._makeRingWave(0xffaa44, 0.90,  0);
    const w2 = this._makeRingWave(0xffdd88, 0.65, 42);
    await this._moveCam({ x: 0, y: 22, z: 65 }, 2.0);
    await Promise.all([
      this._tween(w1.mesh.scale, { x: 45, y: 45, z: 45 }, 3.5),
      this._tween(w1.mat, { opacity: 0 }, 3.5),
      this._tween(w2.mesh.scale, { x: 33, y: 33, z: 33 }, 3.0),
      this._tween(w2.mat, { opacity: 0 }, 3.0),
    ]);
    [w1, w2].forEach(w => this._removeCinematic(w.mesh));

    await this._evaporatePlanets([0, 1, 2, 3]);
    this._spawnNebulaCloud(0xff8844, 280, 28);
    this._spawnNebulaCloud(0x4488ff, 180, 24);
    this._spawnNebulaCloud(0xffaa44, 120, 20);

    // Neutron star colors in
    await Promise.all([
      this._tweenColor(this.scene.starMat.uniforms.uColor.value, 0.5, 0.75, 1.0, 0.8),
      this._tween(this.scene.bloomPass, { strength: 3.2 }, 0.8),
    ]);
    await this._moveCam({ x: 0, y: 4, z: 16 }, 1.8);

    const beam = this._makePulsarBeam();
    await this._wait(4200);
    this._removeCinematic(beam);

    await this._wait(800);
    if (window.gsap) gsap.killTweensOf(this.scene.bloomPass);
    this.scene.bloomPass.strength = this.scene.bloomStrength;
    this.audio?.returnToAmbient();
  }

  async _animBlackHole() {
    const s  = this.scene.starMesh.scale.x;
    const cs = this.scene.coronaMesh.scale.x;

    // Pre-collapse: intense instability
    await this._flickerStar(8, 130);

    // Brief pre-collapse expansion — corona follows
    await Promise.all([
      this._tweenColor(this.scene.starMat.uniforms.uColor.value, 1.0, 0.3, 0.02, 1.0),
      this._tween(this.scene.starMesh.scale,   { x: s * 2.5,  y: s * 2.5,  z: s * 2.5  }, 1.2),
      this._tween(this.scene.coronaMesh.scale, { x: cs * 2.5, y: cs * 2.5, z: cs * 2.5 }, 1.2),
    ]);
    if (this.scene.hazeMesh) this.scene.hazeMesh.visible = false;

    // HYPERNOVA — more extreme than supernova
    this.scene.bloomPass.strength = 11.0;
    this._screenShake(2.0, 24);
    await this._wait(140);
    this.scene.bloomPass.strength = 0.4;
    await this._wait(70);
    this.scene.bloomPass.strength = 9.5;
    await this._wait(150);
    this.scene.bloomPass.strength = 3.5;

    // Hide original star and corona
    this.scene.starMesh.visible   = false;
    this.scene.coronaMesh.visible = false;

    // Four expanding ring shockwaves
    const w1 = this._makeRingWave(0xff6600, 1.00,  0);
    const w2 = this._makeRingWave(0xffaa00, 0.82, 25);
    const w3 = this._makeRingWave(0xffdd66, 0.60, 50);
    const w4 = this._makeRingWave(0xffffff, 0.38, 75);

    await this._moveCam({ x: 0, y: 40, z: 115 }, 3.0);
    await Promise.all([
      this._tween(w1.mesh.scale, { x: 95, y: 95, z: 95 }, 6.0),
      this._tween(w1.mat, { opacity: 0 }, 6.0),
      this._tween(w2.mesh.scale, { x: 75, y: 75, z: 75 }, 5.5),
      this._tween(w2.mat, { opacity: 0 }, 5.5),
      this._tween(w3.mesh.scale, { x: 58, y: 58, z: 58 }, 5.0),
      this._tween(w3.mat, { opacity: 0 }, 5.0),
      this._tween(w4.mesh.scale, { x: 44, y: 44, z: 44 }, 4.5),
      this._tween(w4.mat, { opacity: 0 }, 4.5),
    ]);
    [w1, w2, w3, w4].forEach(w => this._removeCinematic(w.mesh));

    await this._evaporatePlanets([0, 1, 2, 3, 4, 5, 6, 7]);
    this._spawnNebulaCloud(0xff4400, 550, 45);
    this._spawnNebulaCloud(0x4488ff, 380, 40);
    this._spawnNebulaCloud(0xffcc44, 280, 37);
    this._spawnNebulaCloud(0xff00aa, 200, 33);
    this._spawnNebulaCloud(0x88ffcc, 150, 30);

    await this._wait(1200);
    await this._moveCam({ x: 0, y: 14, z: 40 }, 2.5);

    // Black hole — no visible star, just the gravitational remnant
    // (starMesh stays hidden; accretion disk is the visual anchor)
    const photonRing = this._makePhotonRing();
    this.accretionDisk = this._makeAccretionDisk();
    this._makeMatterJets();

    await this._tween(this.scene.bloomPass, { strength: 3.8 }, 1.5);

    this.scene.lensPass.enabled = true;
    await this._tween(this.scene.lensPass.uniforms.uStrength, { value: 0.1 }, 3.0);

    await this._moveCam({ x: 6, y: 9, z: 30 }, 2.0);
    await this._wait(3500);

    this.audio?.returnToAmbient();
  }

  async _animBrownDwarf() {
    const s  = this.scene.starMesh.scale.x;
    const cs = this.scene.coronaMesh.scale.x;

    // Close-up camera
    await this._moveCam({ x: 0.8, y: 0.5, z: 5 }, 2.0);

    // Gradual cooling, shrinking, dimming — corona and haze follow
    const shrinkTargets = [
      this._tweenColor(this.scene.starMat.uniforms.uColor.value, 0.28, 0.09, 0.02, 3.5),
      this._tweenColor(this.scene.coronaMesh.material.color,     0.28, 0.09, 0.02, 3.5),
      this._tween(this.scene.starMesh.scale,   { x: s * 0.32,  y: s * 0.32,  z: s * 0.32  }, 4.0),
      this._tween(this.scene.coronaMesh.scale, { x: cs * 0.32, y: cs * 0.32, z: cs * 0.32 }, 4.0),
      this._tween(this.scene.bloomPass, { strength: 0.18 }, 3.5),
    ];
    if (this.scene.hazeMesh) shrinkTargets.push(
      this._tween(this.scene.hazeMesh.material, { opacity: 0 }, 2.5)
    );
    await Promise.all(shrinkTargets);

    // Dying flickers — star barely clinging to any glow
    for (let i = 0; i < 4; i++) {
      await this._tween(this.scene.bloomPass, { strength: 0.5  }, 0.35);
      await this._tween(this.scene.bloomPass, { strength: 0.06 }, 0.50);
    }

    // Star has died — leave bloom near zero (do NOT reset to bloomStrength)
    await this._wait(2000);
    this.audio?.returnToAmbient();
  }

  // ── TWEEN HELPERS ─────────────────────────────────────────────────────────────
  _moveCam(pos, dur) {
    return new Promise(r => {
      if (!window.gsap) { setTimeout(r, dur*1000); return; }
      this.scene.controls.autoRotate = false;
      gsap.to(this.scene.camera.position, { ...pos, duration:dur, ease:'power2.inOut', onComplete:r });
    });
  }

  _tween(obj, props, dur) {
    return new Promise(r => {
      if (!window.gsap) { Object.assign(obj, props); setTimeout(r, dur*1000); return; }
      gsap.to(obj, { ...props, duration:dur, ease:'power2.inOut', onComplete:r });
    });
  }

  _tweenColor(colorObj, r, g, b, dur) {
    return this._tween(colorObj, { r, g, b }, dur);
  }

  async _flickerStar(count, ms) {
    const base = this.scene.bloomPass.strength;
    for (let i = 0; i < count; i++) {
      this.scene.bloomPass.strength = base * (1.6 + Math.random() * 2.2);
      await this._wait(ms * (0.4 + Math.random() * 0.6));
      this.scene.bloomPass.strength = base * (0.2 + Math.random() * 0.3);
      await this._wait(ms * (0.3 + Math.random() * 0.5));
    }
    this.scene.bloomPass.strength = base;
  }

  _screenShake(intensity, frames) {
    if (!window.gsap) return;
    const cam = this.scene.camera;
    const ox = cam.position.x, oy = cam.position.y;
    let f = 0;
    const tick = () => {
      if (f++ >= frames) { cam.position.x = ox; cam.position.y = oy; return; }
      cam.position.x = ox + (Math.random() - 0.5) * intensity * 0.35;
      cam.position.y = oy + (Math.random() - 0.5) * intensity * 0.25;
      requestAnimationFrame(tick);
    };
    tick();
  }

  _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  _track(obj) {
    obj.userData.isCinematic = true;
    this._cinematicObjs.push(obj);
    return obj;
  }

  _removeCinematic(obj) {
    if (window.gsap) {
      gsap.killTweensOf(obj);
      gsap.killTweensOf(obj.rotation);
      if (obj.material) gsap.killTweensOf(obj.material);
    }
    this.scene.scene.remove(obj);
    this._cinematicObjs = this._cinematicObjs.filter(o => o !== obj);
  }

  cleanupCinematicObjects() {
    if (window.gsap) {
      [...this._cinematicObjs].forEach(o => {
        gsap.killTweensOf(o);
        gsap.killTweensOf(o.rotation);
        if (o.material) gsap.killTweensOf(o.material);
      });
    }
    if (this.accretionDisk) {
      if (window.gsap) { gsap.killTweensOf(this.accretionDisk); gsap.killTweensOf(this.accretionDisk.rotation); }
      this.scene.scene.remove(this.accretionDisk);
      this.accretionDisk = null;
    }
    [...this._cinematicObjs].forEach(o => this.scene.scene.remove(o));
    this._cinematicObjs = [];
    this.scene.scene.children
      .filter(c => c.userData?.isCinematic)
      .forEach(c => this.scene.scene.remove(c));
  }

  // ── CINEMATIC OBJECT BUILDERS ─────────────────────────────────────────────────

  _makeRingWave(color, opacity, delayMs) {
    const geo  = new THREE.TorusGeometry(1, 0.12, 8, 64);
    const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.userData.isCinematic = true;
    this._cinematicObjs.push(mesh);
    if (delayMs > 0) {
      setTimeout(() => this.scene.scene.add(mesh), delayMs);
    } else {
      this.scene.scene.add(mesh);
    }
    return { mesh, mat };
  }

  _makePulsarBeam() {
    const geo  = new THREE.CylinderGeometry(0.04, 0.04, 70, 6);
    const mat  = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(geo, mat);
    // Lie flat on X-axis, spin around world Y — creates the pulsar sweep
    beam.rotation.z = Math.PI / 2;
    beam.userData.isCinematic = true;
    this.scene.scene.add(beam);
    this._cinematicObjs.push(beam);
    // Relative rotation so repeat:-1 never snaps back to origin
    if (window.gsap) gsap.to(beam.rotation, { y: '+=' + (Math.PI * 2 * 100), duration: 220, repeat: -1, ease: 'none' });
    return beam;
  }

  _makePhotonRing() {
    const geo  = new THREE.TorusGeometry(0.5, 0.04, 8, 64);
    const mat  = new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(geo, mat);
    ring.userData.isCinematic = true;
    this.scene.scene.add(ring);
    this._cinematicObjs.push(ring);
    if (window.gsap) gsap.to(ring.rotation, { y: '+=' + (Math.PI * 2 * 100), duration: 180, repeat: -1, ease: 'none' });
    return ring;
  }

  _makeAccretionDisk() {
    const group = new THREE.Group();
    group.userData.isCinematic = true;

    // Gradient rings from outer (cool, dim) to inner (hot, bright)
    const rings = [
      { r: 2.8,  t: 0.50, color: 0xff5500 },
      { r: 1.9,  t: 0.35, color: 0xff8800 },
      { r: 1.2,  t: 0.22, color: 0xffcc44 },
      { r: 0.75, t: 0.12, color: 0xffffff },
    ];
    rings.forEach(({ r, t, color }) => {
      const geo = new THREE.TorusGeometry(r, t, 10, 128);
      const mat = new THREE.MeshBasicMaterial({ color, depthWrite: false, blending: THREE.AdditiveBlending });
      group.add(new THREE.Mesh(geo, mat));
    });

    this.scene.scene.add(group);
    this._cinematicObjs.push(group);
    if (window.gsap) gsap.to(group.rotation, { y: '+=' + (Math.PI * 2 * 100), duration: 120, repeat: -1, ease: 'none' });
    return group;
  }

  _makeMatterJets() {
    [-1, 1].forEach(dir => {
      const geo = new THREE.CylinderGeometry(0.0, 0.35, 22, 8, 1, true);
      const mat = new THREE.MeshBasicMaterial({ color: 0x55aaff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
      const jet = new THREE.Mesh(geo, mat);
      jet.position.y = dir * 11;
      if (dir < 0) jet.rotation.x = Math.PI;
      jet.userData.isCinematic = true;
      this.scene.scene.add(jet);
      this._cinematicObjs.push(jet);
      if (window.gsap) gsap.to(mat, { opacity: 0.12, duration: 1.8 + Math.random() * 0.8, repeat: -1, yoyo: true, ease: 'power1.inOut' });
    });
  }

  _makePlanetaryNebula(scale) {
    const colors = [0xff6622, 0x4466ff, 0xffaa44, 0x22ffcc, 0xff44aa];
    const spreadBase = Math.max(scale * 2.2, 10);
    colors.forEach(color => {
      const count = 90 + Math.floor(Math.random() * 40);
      for (let j = 0; j < count; j++) {
        const size = 0.08 + Math.random() * 0.14;
        const geo  = new THREE.SphereGeometry(size, 4, 4);
        const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 + Math.random() * 0.25, depthWrite: false, blending: THREE.AdditiveBlending });
        const p    = new THREE.Mesh(geo, mat);
        const dist = spreadBase * (0.35 + Math.random() * 0.65);
        const dir  = new THREE.Vector3().randomDirection().multiplyScalar(dist);
        p.userData.isCinematic = true;
        this.scene.scene.add(p);
        this._cinematicObjs.push(p);
        if (window.gsap) {
          gsap.to(p.position, { x: dir.x, y: dir.y, z: dir.z, duration: 4.5 + Math.random() * 2.5, ease: 'power1.out' });
          gsap.to(mat, { opacity: 0, duration: 6 + Math.random() * 3, delay: 0.3 + Math.random() * 1.5, ease: 'power1.in',
            onComplete: () => this._removeCinematic(p) });
        }
      }
    });
  }

  _spawnNebulaCloud(color, count, spread) {
    for (let i = 0; i < count; i++) {
      const size = 0.07 + Math.random() * 0.14;
      const geo  = new THREE.SphereGeometry(size, 4, 4);
      const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 + Math.random() * 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
      const p    = new THREE.Mesh(geo, mat);
      const dir  = new THREE.Vector3().randomDirection().multiplyScalar(spread * (0.3 + Math.random() * 0.7));
      p.userData.isCinematic = true;
      this.scene.scene.add(p);
      this._cinematicObjs.push(p);
      if (window.gsap) {
        gsap.to(p.position, { x: dir.x, y: dir.y, z: dir.z, duration: 3.5 + Math.random() * 2.5, ease: 'power2.out' });
        gsap.to(mat, { opacity: 0, duration: 5 + Math.random() * 4, delay: 0.3 + Math.random(), ease: 'power1.in',
          onComplete: () => this._removeCinematic(p) });
      }
    }
  }

  async _evaporatePlanets(indices) {
    const jobs = indices.map(i => {
      const p = this.scene.planets[i];
      if (!p || !p.visible) return Promise.resolve();
      return new Promise(r => {
        p.material.transparent = true;
        if (window.gsap) {
          gsap.to(p.material, { opacity: 0, duration: 1.8, ease: 'power2.in',
            onComplete: () => { p.visible = false; p.material.opacity = 1; r(); } });
          gsap.to(p.scale, { x: 3, y: 3, z: 3, duration: 1.5, ease: 'power1.in' });
        } else { p.visible = false; r(); }
      });
    });
    await Promise.all(jobs);
  }

  // Kept for backwards compatibility
  _makeShockwave(color = 0xffaa44, opacity = 0.25) {
    const geo  = new THREE.SphereGeometry(1, 32, 32);
    const mat  = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, wireframe: true, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isCinematic = true;
    this.scene.scene.add(mesh);
    this._cinematicObjs.push(mesh);
    return mesh;
  }

  _spawnEjecta(color, count, spread) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.04 + Math.random() * 0.06, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
      const p   = new THREE.Mesh(geo, mat);
      const dir = new THREE.Vector3().randomDirection().multiplyScalar(spread * (0.5 + Math.random() * 0.5));
      p.userData.isCinematic = true;
      this.scene.scene.add(p);
      this._cinematicObjs.push(p);
      if (window.gsap) {
        gsap.to(p.position, { x: dir.x, y: dir.y, z: dir.z, duration: 3 + Math.random(), ease: 'power1.out' });
        gsap.to(mat, { opacity: 0, duration: 3 + Math.random(), ease: 'power1.in',
          onComplete: () => this._removeCinematic(p) });
      }
    }
  }
}
