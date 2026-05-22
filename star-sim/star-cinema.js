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
    // Tracked cinematic objects (cleared on retry)
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

    // Generate narration with 8s timeout
    const narrationData = await Promise.race([
      this.narration.generate(fate, sliderState, physics),
      new Promise(r => setTimeout(() => r(null), 8000))
    ]) || this.narration.getFallback(fate);

    await this._stage1(narrationData.etapa1 || []);
    await this._stage2(fate, narrationData.etapa2 || []);

    this.skipBtn.style.display = 'none';
    this.bubbles.hide();
    document.getElementById('btn-retry').style.display = 'block';
  }

  async _stage1(segments) {
    if (!this.scene.state.interiorMode) await this.scene.toggleInterior(true);
    await this._moveCam({ x:0.8, y:1.0, z:4.5 }, 2.2);

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
    for (let i=0; i<4; i++) {
      await this._tween(this.scene.bloomPass, { strength:2.2 }, 1.2);
      await this._tween(this.scene.bloomPass, { strength:1.2 }, 1.2);
    }
    this.scene.bloomPass.strength = this.scene.bloomStrength;
    this.audio?.returnToAmbient();
  }

  async _animWhiteDwarf() {
    const s = this.scene.starMesh.scale.x;
    // Expand to red giant
    this.scene.starMat.uniforms.uColor.value.setRGB(1, 0.18, 0.04);
    this.scene.coronaMesh.material.color.setRGB(1, 0.18, 0.04);
    this.scene.bloomPass.strength = 3.0;
    await this._tween(this.scene.starMesh.scale, { x:s*4.5, y:s*4.5, z:s*4.5 }, 3.0);
    await this._moveCam({ x:0, y:12, z:55 }, 1.5);
    await this._wait(600);

    // Ejecta nebula
    this._spawnEjecta(0xff6622, 180, 22);
    await this._wait(1000);

    // Core contracts to white dwarf
    await this._tween(this.scene.starMesh.scale, { x:0.12, y:0.12, z:0.12 }, 2.5);
    this.scene.starMat.uniforms.uColor.value.setRGB(0.85, 0.92, 1.0);
    this.scene.bloomPass.strength = 2.8;
    await this._moveCam({ x:0, y:0.5, z:4.5 }, 2.0);
    await this._wait(2000);
    this.scene.bloomPass.strength = this.scene.bloomStrength;
    this.audio?.returnToAmbient();
  }

  async _animSupernova() {
    // PRE-SUPERNOVA: expand rapidly
    const s = this.scene.starMesh.scale.x;
    this.scene.starMat.uniforms.uColor.value.setRGB(1, 0.4, 0.05);
    await this._tween(this.scene.starMesh.scale, { x:s*3.5, y:s*3.5, z:s*3.5 }, 1.5);

    // DETONATION FLASH
    this.scene.bloomPass.strength = 6.0;
    await this._wait(150);
    this.scene.bloomPass.strength = 1.0;
    await this._wait(80);
    this.scene.bloomPass.strength = 5.0;
    await this._wait(150);

    // Massive shockwave expanding
    const wave1 = this._makeShockwave(0xff8833, 1.2);
    const wave2 = this._makeShockwave(0xffcc44, 0.7);
    await this._moveCam({ x:0, y:30, z:90 }, 2.5);
    await Promise.all([
      this._tween(wave1.scale, { x:70, y:70, z:70 }, 5.0),
      this._tween(wave2.scale, { x:45, y:45, z:45 }, 4.0),
    ]);
    this._removeCinematic(wave1);
    this._removeCinematic(wave2);

    // Evaporate inner planets
    await this._evaporatePlanets([0,1,2,3]);

    // Colorful debris nebula (red, orange, blue tendrils)
    this._spawnEjecta(0xff4400, 120, 30);
    this._spawnEjecta(0x4488ff, 80, 28);
    this._spawnEjecta(0xffcc44, 60, 25);
    await this._wait(1500);

    // Neutron star emerges at center
    await this._tween(this.scene.starMesh.scale, { x:0.06, y:0.06, z:0.06 }, 1.5);
    this.scene.starMat.uniforms.uColor.value.setRGB(0.5, 0.75, 1.0);
    this.scene.bloomPass.strength = 2.5;
    await this._moveCam({ x:0, y:5, z:22 }, 2.0);

    // Pulsar beam
    const beam = this._makePulsarBeam();
    for (let i=0; i<5; i++) {
      beam.rotation.z += Math.PI*0.4;
      await this._wait(600);
    }
    this._removeCinematic(beam);
    await this._wait(800);
    this.scene.bloomPass.strength = this.scene.bloomStrength;
    this.audio?.returnToAmbient();
  }

  async _animNeutronStar() {
    const s = this.scene.starMesh.scale.x;
    // Rapid collapse flash
    this.scene.bloomPass.strength = 4.5;
    await this._tween(this.scene.starMesh.scale, { x:0.06, y:0.06, z:0.06 }, 0.7);
    await this._wait(150);
    this.scene.bloomPass.strength = 1.0;

    const wave = this._makeShockwave(0xffaa44, 1.0);
    await this._moveCam({ x:0, y:25, z:65 }, 2.0);
    await this._tween(wave.scale, { x:40, y:40, z:40 }, 3.0);
    this._removeCinematic(wave);

    await this._evaporatePlanets([0,1,2,3]);
    this.scene.starMat.uniforms.uColor.value.setRGB(0.5, 0.75, 1.0);
    this.scene.bloomPass.strength = 2.5;
    await this._moveCam({ x:0, y:4, z:15 }, 1.8);

    const beam = this._makePulsarBeam();
    for (let i=0; i<5; i++) { beam.rotation.z += Math.PI*0.4; await this._wait(600); }
    this._removeCinematic(beam);
    await this._wait(800);
    this.scene.bloomPass.strength = this.scene.bloomStrength;
    this.audio?.returnToAmbient();
  }

  async _animBlackHole() {
    // Hypernova flash
    this.scene.bloomPass.strength = 6.5;
    await this._wait(300);
    this.scene.bloomPass.strength = 0.3;
    await this._wait(100);
    this.scene.bloomPass.strength = 5.5;

    const wave = this._makeShockwave(0xff6600, 1.2);
    await this._moveCam({ x:0, y:35, z:110 }, 3.0);
    await this._tween(wave.scale, { x:90, y:90, z:90 }, 4.5);
    this._removeCinematic(wave);

    await this._evaporatePlanets([0,1,2,3,4,5,6,7]);
    await this._wait(300);

    // Implosion
    await this._tween(this.scene.starMesh.scale, { x:0.02, y:0.02, z:0.02 }, 1.0);
    this.scene.starMat.uniforms.uColor.value.setRGB(0, 0, 0);

    // Accretion disk
    this.accretionDisk = this._makeAccretionDisk();
    await this._moveCam({ x:0, y:10, z:30 }, 2.5);
    this.scene.bloomPass.strength = 3.0;

    // Gravitational lens
    this.scene.lensPass.enabled = true;
    await this._tween(this.scene.lensPass.uniforms.uStrength, { value:0.07 }, 3.0);
    await this._wait(2500);
    this.audio?.returnToAmbient();
  }

  async _animBrownDwarf() {
    this.scene.starMat.uniforms.uColor.value.setRGB(0.35, 0.12, 0.03);
    await this._tween(this.scene.starMesh.scale, { x:0.3, y:0.3, z:0.3 }, 2.0);
    this.scene.bloomPass.strength = 0.25;
    await this._wait(3000);
    this.scene.bloomPass.strength = this.scene.bloomStrength;
    this.audio?.returnToAmbient();
  }

  // ── HELPERS ──────────────────────────────────────────────────────────────────
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

  _wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  _track(obj) {
    obj.userData.isCinematic = true;
    this._cinematicObjs.push(obj);
    return obj;
  }

  _removeCinematic(obj) {
    this.scene.scene.remove(obj);
    this._cinematicObjs = this._cinematicObjs.filter(o => o !== obj);
  }

  cleanupCinematicObjects() {
    // Remove accretion disk
    if (this.accretionDisk) {
      this.scene.scene.remove(this.accretionDisk);
      this.accretionDisk = null;
    }
    // Remove any remaining cinematic objects
    [...this._cinematicObjs].forEach(o => this.scene.scene.remove(o));
    this._cinematicObjs = [];
    // Remove any remaining tagged objects in scene
    this.scene.scene.children
      .filter(c => c.userData?.isCinematic)
      .forEach(c => this.scene.scene.remove(c));
  }

  _makeShockwave(color=0xffaa44, opacity=0.25) {
    const geo = new THREE.SphereGeometry(1, 32, 32);
    const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity, wireframe:true, depthWrite:false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.isCinematic = true;
    this.scene.scene.add(mesh);
    this._cinematicObjs.push(mesh);
    return mesh;
  }

  _makePulsarBeam() {
    const geo = new THREE.CylinderGeometry(0.03, 0.03, 60, 6);
    const mat = new THREE.MeshBasicMaterial({ color:0x88ccff, transparent:true, opacity:0.7, depthWrite:false });
    const beam = new THREE.Mesh(geo, mat);
    beam.rotation.z = Math.PI/2;
    beam.userData.isCinematic = true;
    this.scene.scene.add(beam);
    this._cinematicObjs.push(beam);
    if (window.gsap) gsap.to(beam.rotation, { y: Math.PI*2*10, duration:8, repeat:-1, ease:'none' });
    return beam;
  }

  _makeAccretionDisk() {
    const geo = new THREE.TorusGeometry(2.2, 0.4, 16, 128);
    const mat = new THREE.MeshBasicMaterial({ color:0xff7700, depthWrite:false });
    const disk = new THREE.Mesh(geo, mat);
    disk.userData.isCinematic = true;
    this.scene.scene.add(disk);
    // Inner hot ring (brighter)
    const innerGeo = new THREE.TorusGeometry(1.4, 0.2, 8, 64);
    const innerMat = new THREE.MeshBasicMaterial({ color:0xffcc44, depthWrite:false });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    disk.add(inner);
    if (window.gsap) gsap.to(disk.rotation, { y:Math.PI*2*10, duration:18, repeat:-1, ease:'none' });
    return disk;
  }

  async _evaporatePlanets(indices) {
    const jobs = indices.map(i => {
      const p = this.scene.planets[i];
      if (!p || !p.visible) return Promise.resolve();
      return new Promise(r => {
        p.material.transparent = true;
        if (window.gsap) {
          gsap.to(p.material, { opacity:0, duration:1.8, ease:'power2.in', onComplete:() => { p.visible=false; p.material.opacity=1; r(); } });
          gsap.to(p.scale, { x:3, y:3, z:3, duration:1.5, ease:'power1.in' });
        } else { p.visible = false; r(); }
      });
    });
    await Promise.all(jobs);
  }

  _spawnEjecta(color, count, spread) {
    for (let i=0; i<count; i++) {
      const geo = new THREE.SphereGeometry(0.04+Math.random()*0.06, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.9, depthWrite:false });
      const p = new THREE.Mesh(geo, mat);
      const dir = new THREE.Vector3().randomDirection().multiplyScalar(spread*(0.5+Math.random()*0.5));
      p.userData.isCinematic = true;
      this.scene.scene.add(p);
      this._cinematicObjs.push(p);
      if (window.gsap) {
        gsap.to(p.position, { x:dir.x, y:dir.y, z:dir.z, duration:3+Math.random(), ease:'power1.out' });
        gsap.to(mat, { opacity:0, duration:3+Math.random(), ease:'power1.in', onComplete:() => this._removeCinematic(p) });
      }
    }
  }
}
