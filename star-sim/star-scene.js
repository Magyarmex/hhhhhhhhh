import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { starColor } from './star-physics.js';

// ── SIMPLEX NOISE GLSL ────────────────────────────────────────────────────────
const NOISE_GLSL = `
vec3 mod289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289v4((x*34.+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  vec4 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-.5;
  i=mod289v3(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  vec4 j=p-49.*floor(p*(1./7.)*(1./7.));
  vec4 x_=floor(j*(1./7.));
  vec4 y_=floor(j-7.*x_);
  vec4 x=x_*(1./7.)+0.071428571428571;
  vec4 y=y_*(1./7.)+0.071428571428571;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;
  vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

// ── STAR SHADERS ──────────────────────────────────────────────────────────────
const STAR_VERT = `
${NOISE_GLSL}
uniform float uTime;
uniform float uRadius;
varying vec3 vNormal;
varying vec3 vPos;
varying float vNoise;

void main(){
  vNormal=normalize(normalMatrix*normal);
  float n1=snoise(position*2.0+uTime*0.25);
  float n2=snoise(position*5.5+uTime*0.5)*0.4;
  float disp=(n1+n2)*0.06*clamp(uRadius,0.5,4.0);
  vec3 pos=position+normal*disp;
  vPos=pos; vNoise=n1;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.0);
}`;

const STAR_FRAG = `
${NOISE_GLSL}
uniform float uTime;
uniform vec3  uColor;
varying vec3 vNormal;
varying vec3 vPos;
varying float vNoise;

void main(){
  float limb=clamp(dot(normalize(vNormal),vec3(0,0,1)),0.,1.);
  float limb2=mix(0.55,1.0,pow(limb,0.4));
  float spot=smoothstep(0.25,0.55,vNoise);
  float flare=max(0.,snoise(vNormal*9.+uTime*0.9))*0.35;
  vec3 col=uColor*(mix(0.65,1.0,spot)+flare);
  col*=limb2;
  gl_FragColor=vec4(col,1.0);
}`;

// ── PLANET DATA ───────────────────────────────────────────────────────────────
const PLANETS = [
  { name:'Mercurio', r:3.8,  size:0.10, color:0x9e9e9e, speed:2.2 },
  { name:'Venus',    r:5.5,  size:0.18, color:0xf5deb3, speed:1.7 },
  { name:'Tierra',   r:7.5,  size:0.19, color:0x4fa3e3, speed:1.35 },
  { name:'Marte',    r:10.0, size:0.12, color:0xc1440e, speed:1.05 },
  { name:'Júpiter',  r:15.0, size:0.60, color:0xc88b3a, speed:0.72 },
  { name:'Saturno',  r:21.0, size:0.50, color:0xead6a3, speed:0.52, ring:true },
  { name:'Urano',    r:27.0, size:0.32, color:0x7de8e8, speed:0.36 },
  { name:'Neptuno',  r:33.0, size:0.30, color:0x3f54ba, speed:0.26 },
];

// ── LAYER DATA (interior) ─────────────────────────────────────────────────────
const LAYERS = [
  { name:'Fotosfera',        ratio:1.00, color:0xffcc44, emissive:0.3, opacity:0.5,
    tip:'La superficie visible. Lo que vemos como "el sol". ~5,778 K.' },
  { name:'Zona Convectiva',  ratio:0.85, color:0xff6600, emissive:0.4, opacity:0.6,
    tip:'El plasma sube y baja como agua hirviendo, a escala solar.' },
  { name:'Zona Radiativa',   ratio:0.60, color:0xff3300, emissive:0.5, opacity:0.7,
    tip:'Los fotones tardan ~100,000 años en cruzar esta capa.' },
  { name:'Núcleo',           ratio:0.25, color:0xffffff, emissive:1.0, opacity:0.9,
    tip:'Aquí ocurre la fusión nuclear. T > 15 millones K.' },
];

export class StarScene {
  constructor(container, css2dContainer) {
    this.container      = container;
    this.css2dContainer = css2dContainer;
    this.clock          = new THREE.Clock();
    this.state = { mass:1, radius:1, temperature:5778, hRemaining:75, interiorMode:false, sunGhost:false };
    this.planets        = [];
    this.fusionParticles= null;
    this.clippingPlane  = new THREE.Plane(new THREE.Vector3(-1,0,0), 500);
    this.interiorGroup  = new THREE.Group();
    this.solarGroup     = new THREE.Group();
    this.bloomStrength  = 1.2;
    this.onLayerClick   = null; // callback(layerName, tip)

    this._init();
  }

  _init() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.container.appendChild(this.renderer.domElement);

    // CSS2D Renderer
    this.css2d = new CSS2DRenderer();
    this.css2d.setSize(w, h);
    this.css2d.domElement.style.position = 'absolute';
    this.css2d.domElement.style.top = '0';
    this.css2d.domElement.style.pointerEvents = 'none';
    this.css2dContainer.appendChild(this.css2d.domElement);

    // Scene & Camera
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w/h, 0.1, 2000);
    this.camera.position.set(0, 8, 25);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 200;
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0.3;

    // Camera distance → particle mode switch
    this.controls.addEventListener('change', () => this._updateParticleMode());

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w,h), this.bloomStrength, 0.4, 0.1);
    this.composer.addPass(this.bloomPass);

    // Gravitational lens pass (initially disabled, used for black hole)
    this.lensPass = new ShaderPass({
      uniforms: { tDiffuse:{value:null}, uStrength:{value:0.0}, uCenter:{value:new THREE.Vector2(0.5,0.5)} },
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform sampler2D tDiffuse;uniform float uStrength;uniform vec2 uCenter;varying vec2 vUv;
      void main(){vec2 d=vUv-uCenter;float dist=length(d);vec2 uv=vUv+normalize(d)*uStrength*smoothstep(0.4,0.0,dist);gl_FragColor=texture2D(tDiffuse,uv);}`
    });
    this.lensPass.enabled = false;
    this.composer.addPass(this.lensPass);

    // Build scene
    this._buildBackground();
    this._buildGrid();
    this._buildStar();
    this._buildSolarSystem();
    this._buildInterior();
    this._buildFusionParticles();

    // Resize
    window.addEventListener('resize', () => this._onResize());

    // Raycaster for layer clicks
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this.renderer.domElement.addEventListener('click', e => this._onCanvasClick(e));

    // Animation loop
    this._animate();
  }

  // ── BACKGROUND STARS ────────────────────────────────────────────────────────
  _buildBackground() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(5000 * 3);
    const col = new Float32Array(5000 * 3);
    for (let i = 0; i < 5000; i++) {
      const r = 400 + Math.random()*400;
      const theta = Math.random()*Math.PI*2;
      const phi = Math.acos(2*Math.random()-1);
      pos[i*3]   = r*Math.sin(phi)*Math.cos(theta);
      pos[i*3+1] = r*Math.sin(phi)*Math.sin(theta);
      pos[i*3+2] = r*Math.cos(phi);
      const t = Math.random();
      col[i*3]   = 0.7+t*0.3; col[i*3+1]=0.8+t*0.2; col[i*3+2]=0.9+t*0.1;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geo.setAttribute('color', new THREE.BufferAttribute(col,3));
    const mat = new THREE.PointsMaterial({ size:0.6, vertexColors:true, sizeAttenuation:true });
    this.scene.add(new THREE.Points(geo, mat));
  }

  // ── GRID (3D CARTESIAN AXES) ─────────────────────────────────────────────────
  _buildGrid() {
    this.gridGroup = new THREE.Group();
    const opts = { color:0x1a1a3a };
    this.gridGroup.add(new THREE.GridHelper(80, 20, 0x1e1e3a, 0x1e1e3a));
    const axes = new THREE.AxesHelper(12);
    axes.material.opacity = 0.3; axes.material.transparent = true;
    this.gridGroup.add(axes);
    this.scene.add(this.gridGroup);
  }

  // ── STAR ────────────────────────────────────────────────────────────────────
  _buildStar() {
    const geo = new THREE.SphereGeometry(1, 64, 64);
    const c = starColor(5778);
    this.starMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:   { value: 0 },
        uRadius: { value: 1 },
        uColor:  { value: new THREE.Color(c[0], c[1], c[2]) },
      },
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      clippingPlanes: [this.clippingPlane],
      clipShadows: true,
    });
    this.starMesh = new THREE.Mesh(geo, this.starMat);
    this.solarGroup.add(this.starMesh);

    // Point light from star
    this.starLight = new THREE.PointLight(0xffeedd, 3, 200);
    this.solarGroup.add(this.starLight);

    // Sun ghost (comparison)
    const ghostMat = new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.12, wireframe:false, depthWrite:false });
    this.sunGhostMesh = new THREE.Mesh(new THREE.SphereGeometry(1,32,32), ghostMat);
    this.sunGhostMesh.visible = false;
    this.solarGroup.add(this.sunGhostMesh);
    // Label
    const ghostLabel = document.createElement('div');
    ghostLabel.className = 'planet-label';
    ghostLabel.textContent = '☀ Nuestro Sol';
    ghostLabel.style.color = '#ffcc44';
    this.sunGhostLabel = new CSS2DObject(ghostLabel);
    this.sunGhostLabel.position.set(0, 1.2, 0);
    this.sunGhostMesh.add(this.sunGhostLabel);

    this.scene.add(this.solarGroup);
  }

  // ── SOLAR SYSTEM ─────────────────────────────────────────────────────────────
  _buildSolarSystem() {
    this.planets = PLANETS.map(pd => {
      const mat = new THREE.MeshStandardMaterial({ color:pd.color, roughness:0.8, metalness:0.1 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(pd.size, 32, 32), mat);
      mesh.userData = { orbitRadius:pd.r, speed:pd.speed, angle:Math.random()*Math.PI*2 };
      this.solarGroup.add(mesh);

      // Orbit ring
      const orbitGeo = new THREE.RingGeometry(pd.r-0.02, pd.r+0.02, 128);
      const orbitMat = new THREE.MeshBasicMaterial({ color:0x2a2a4a, side:THREE.DoubleSide, transparent:true, opacity:0.3 });
      const orbitRing = new THREE.Mesh(orbitGeo, orbitMat);
      orbitRing.rotation.x = -Math.PI/2;
      orbitRing.userData.isPlanetOrbit = true;
      this.solarGroup.add(orbitRing);

      // Saturn ring
      if (pd.ring) {
        const ringGeo = new THREE.RingGeometry(pd.size*1.4, pd.size*2.2, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color:0xc0a060, side:THREE.DoubleSide, transparent:true, opacity:0.7 });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI/4;
        mesh.add(ringMesh);
      }

      // CSS2D Label
      const div = document.createElement('div');
      div.className = 'planet-label';
      div.textContent = pd.name;
      const label = new CSS2DObject(div);
      label.position.set(0, pd.size+0.2, 0);
      label.userData.labelDiv = div;
      mesh.add(label);
      mesh.userData.label = label;

      return mesh;
    });
  }

  // ── INTERIOR LAYERS ─────────────────────────────────────────────────────────
  _buildInterior() {
    this.layerMeshes = [];
    LAYERS.forEach((l, i) => {
      const geo = new THREE.SphereGeometry(l.ratio, 48, 48);
      const mat = new THREE.MeshStandardMaterial({
        color: l.color, emissive: new THREE.Color(l.color),
        emissiveIntensity: l.emissive,
        transparent: true, opacity: l.opacity,
        side: THREE.BackSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { layerName: l.name, layerTip: l.tip };
      this.layerMeshes.push(mesh);
      this.interiorGroup.add(mesh);
    });

    // Animate convective zone with pulsing
    this.interiorGroup.visible = false;
    this.scene.add(this.interiorGroup);
  }

  // ── FUSION PARTICLES ─────────────────────────────────────────────────────────
  _buildFusionParticles() {
    // MACRO: colored cloud
    const macroGeo = new THREE.BufferGeometry();
    const mPos = new Float32Array(300*3), mCol = new Float32Array(300*3);
    for (let i=0;i<300;i++){
      const r=Math.random()*0.85, t=Math.random()*Math.PI*2, p=Math.acos(2*Math.random()-1);
      mPos[i*3]=r*Math.sin(p)*Math.cos(t); mPos[i*3+1]=r*Math.sin(p)*Math.sin(t); mPos[i*3+2]=r*Math.cos(p);
      const c=Math.random(); mCol[i*3]=1; mCol[i*3+1]=0.4+c*0.5; mCol[i*3+2]=c*0.3;
    }
    macroGeo.setAttribute('position', new THREE.BufferAttribute(mPos,3));
    macroGeo.setAttribute('color', new THREE.BufferAttribute(mCol,3));
    this.macroParticles = new THREE.Points(macroGeo, new THREE.PointsMaterial({size:0.06,vertexColors:true,transparent:true,opacity:0.7}));

    // MICRO: H atoms (blue) + He atoms (green)
    this.microH = []; this.microHe = [];
    const microGroup = new THREE.Group();
    const hMat = new THREE.MeshBasicMaterial({ color:0x4488ff });
    const heMat= new THREE.MeshBasicMaterial({ color:0x44ff88 });
    const microGeo = new THREE.SphereGeometry(0.012, 8, 8);
    for (let i=0;i<80;i++){
      const m=new THREE.Mesh(microGeo, hMat); this._randomizeInSphere(m, 0.22);
      m.userData = { vel:new THREE.Vector3((Math.random()-0.5)*0.003,(Math.random()-0.5)*0.003,(Math.random()-0.5)*0.003), state:'free' };
      microGroup.add(m); this.microH.push(m);
    }
    for (let i=0;i<20;i++){
      const m=new THREE.Mesh(microGeo, heMat); this._randomizeInSphere(m, 0.22);
      m.userData = { vel:new THREE.Vector3((Math.random()-0.5)*0.002,(Math.random()-0.5)*0.002,(Math.random()-0.5)*0.002) };
      microGroup.add(m); this.microHe.push(m);
    }
    this.microGroup = microGroup;
    this.macroParticles.visible = false;
    this.microGroup.visible = false;
    this.interiorGroup.add(this.macroParticles);
    this.interiorGroup.add(this.microGroup);

    this._fusionTimer = 0;
  }

  _randomizeInSphere(obj, r) {
    const t=Math.random()*Math.PI*2, p=Math.acos(2*Math.random()-1), rad=Math.random()*r;
    obj.position.set(rad*Math.sin(p)*Math.cos(t), rad*Math.sin(p)*Math.sin(t), rad*Math.cos(p));
  }

  _updateParticleMode() {
    if (!this.state.interiorMode) return;
    const d = this.camera.position.length();
    const micro = d < 3.5;
    this.macroParticles.visible = !micro;
    this.microGroup.visible = micro;
  }

  // ── UPDATE STAR APPEARANCE ───────────────────────────────────────────────────
  updateStar(state) {
    Object.assign(this.state, state);
    const { radius, temperature, hRemaining } = state;
    const c = starColor(temperature);
    this.starMat.uniforms.uColor.value.setRGB(c[0], c[1], c[2]);
    this.starMat.uniforms.uRadius.value = radius;
    this.starMesh.scale.setScalar(Math.max(0.1, radius));
    this.starLight.color.setRGB(c[0], c[1], c[2]);
    this.starLight.intensity = Math.min(radius*2, 8);

    // Update layer emissive intensity based on H remaining
    const fusionRate = hRemaining / 100;
    this.layerMeshes.forEach((m,i) => {
      m.material.emissiveIntensity = LAYERS[i].emissive * (0.4 + fusionRate * 0.6);
    });
  }

  toggleSunGhost(visible) {
    this.sunGhostMesh.visible = visible;
    this.state.sunGhost = visible;
  }

  // ── INTERIOR TOGGLE ──────────────────────────────────────────────────────────
  async toggleInterior(toInterior) {
    if (typeof gsap === 'undefined') return;
    this.state.interiorMode = toInterior;

    if (toInterior) {
      this.interiorGroup.visible = true;
      await new Promise(r => gsap.to(this.clippingPlane, { constant: 0, duration:1.2, ease:'power2.inOut', onComplete:r }));
      this.macroParticles.visible = true;
      this._updateParticleMode();
      this.gridGroup.visible = false;
    } else {
      this.macroParticles.visible = false;
      this.microGroup.visible = false;
      await new Promise(r => gsap.to(this.clippingPlane, { constant: 500, duration:1.0, ease:'power2.inOut', onComplete:r }));
      this.interiorGroup.visible = false;
      this.gridGroup.visible = true;
    }
  }

  // ── CANVAS CLICK (layer labels) ──────────────────────────────────────────────
  _onCanvasClick(e) {
    if (!this.state.interiorMode) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
    this._mouse.y = ((e.clientY - rect.top)  / rect.height) * -2 + 1;
    this._raycaster.setFromCamera(this._mouse, this.camera);
    const hits = this._raycaster.intersectObjects(this.layerMeshes);
    if (hits.length && this.onLayerClick) {
      const { layerName, layerTip } = hits[0].object.userData;
      this.onLayerClick(layerName, layerTip, e.clientX, e.clientY);
    }
  }

  // ── ANCHOR PROJECTION (for narration bubbles) ────────────────────────────────
  project(worldPos) {
    const v = worldPos.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return {
      x: (v.x+1)/2 * rect.width  + rect.left,
      y: (1-v.y)/2 * rect.height + rect.top,
    };
  }

  getAnchorWorld(name) {
    const r = this.state.radius;
    switch(name) {
      case 'nucleo':    return new THREE.Vector3(0, r*0.25, 0);
      case 'particulas':return new THREE.Vector3(r*0.15, r*0.3, 0);
      case 'estrella':  return new THREE.Vector3(0, r*1.1, 0);
      case 'planetas':  return new THREE.Vector3(8, 2, 0);
      case 'explosion': return new THREE.Vector3(0, 6, 0);
      default:          return new THREE.Vector3(0, r, 0);
    }
  }

  // ── ANIMATE ─────────────────────────────────────────────────────────────────
  _animate() {
    requestAnimationFrame(() => this._animate());
    const t = this.clock.getElapsedTime();
    this.starMat.uniforms.uTime.value = t;

    // Orbit planets
    const camDist = this.camera.position.length();
    this.planets.forEach(p => {
      const { orbitRadius, speed } = p.userData;
      p.userData.angle += speed * 0.001;
      p.position.x = orbitRadius * Math.cos(p.userData.angle);
      p.position.z = orbitRadius * Math.sin(p.userData.angle);
      p.rotation.y += 0.005;

      // Occlusion check for label
      const label = p.userData.label;
      if (label) {
        const toCamera = this.camera.position.clone().sub(p.position).normalize();
        const toCamFromOrigin = this.camera.position.clone().normalize();
        const visible = camDist > 20 && toCamera.dot(toCamFromOrigin) > -0.2;
        label.userData.labelDiv.style.display = visible ? '' : 'none';
      }
    });

    // Pulsing convective layer
    if (this.state.interiorMode && this.layerMeshes[1]) {
      this.layerMeshes[1].material.opacity = 0.55 + Math.sin(t*1.5)*0.08;
    }

    // Fusion particle animation
    if (this.microGroup.visible) this._animateFusion(t);

    this.controls.update();
    this.composer.render();
    this.css2d.render(this.scene, this.camera);
  }

  _animateFusion(t) {
    this._fusionTimer -= 0.016;
    const rate = this.state.hRemaining / 100;

    // Move H atoms
    this.microH.forEach(h => {
      if (h.userData.state === 'free') {
        h.position.add(h.userData.vel);
        if (h.position.length() > 0.22) {
          h.userData.vel.negate();
          h.position.add(h.userData.vel);
        }
      }
    });

    // Move He atoms
    this.microHe.forEach(he => {
      he.position.add(he.userData.vel);
      if (he.position.length() > 0.22) he.userData.vel.negate();
    });

    // Trigger fusion event
    if (this._fusionTimer <= 0 && rate > 0.05) {
      this._fusionTimer = 1.5 + Math.random()*1.5;
      this._doFusionEvent();
    }
  }

  _doFusionEvent() {
    const h1 = this.microH.find(h => h.userData.state==='free');
    const h2 = this.microH.find(h => h!==h1 && h.userData.state==='free');
    if (!h1 || !h2) return;

    const target = new THREE.Vector3().randomDirection().multiplyScalar(0.04);
    h1.userData.state = 'fusing'; h2.userData.state = 'fusing';

    if (typeof gsap === 'undefined') return;
    gsap.to(h1.position, { x:target.x, y:target.y, z:target.z, duration:0.4, ease:'power2.in',
      onComplete: () => {
        h1.userData.state = 'free'; h2.userData.state = 'free';
        this._randomizeInSphere(h1, 0.22); this._randomizeInSphere(h2, 0.22);
        // Flash on one He atom
        const he = this.microHe[Math.floor(Math.random()*this.microHe.length)];
        he.position.copy(target);
      }
    });
    gsap.to(h2.position, { x:target.x, y:target.y, z:target.z, duration:0.4, ease:'power2.in' });
  }

  // ── PUBLIC: get renderer domElement for bubbles positioning ──────────────────
  get canvas() { return this.renderer.domElement; }

  // ── RESIZE ─────────────────────────────────────────────────────────────────
  _onResize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w/h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w,h);
    this.composer.setSize(w,h);
    this.css2d.setSize(w,h);
  }

  // ── EXPOSE FOR CINEMA ────────────────────────────────────────────────────────
  get three() { return { THREE, gsap }; }
  get camTarget() { return this.controls.target; }
}
