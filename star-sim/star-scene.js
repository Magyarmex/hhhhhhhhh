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

// ── STAR SHADERS (fixed: clipping plane includes added) ───────────────────────
const STAR_VERT = `
${NOISE_GLSL}
uniform float uTime;
uniform float uRadius;
varying vec3 vNormal;
varying vec3 vPos;
varying float vNoise;
varying float vNoise2;

void main(){
  vNormal = normalize(normalMatrix * normal);
  float n1 = snoise(position * 1.8 + uTime * 0.22);
  float n2 = snoise(position * 4.5 + uTime * 0.45) * 0.5;
  float n3 = snoise(position * 10.0 + uTime * 0.8) * 0.2;
  float disp = (n1 + n2) * 0.07 * clamp(uRadius, 0.3, 5.0);
  vec3 pos = position + normal * disp;
  vPos = pos;
  vNoise = n1;
  vNoise2 = n3;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`;

const STAR_FRAG = `
${NOISE_GLSL}
uniform float uTime;
uniform vec3  uColor;
varying vec3 vNormal;
varying vec3 vPos;
varying float vNoise;
varying float vNoise2;

#include <clipping_planes_pars_fragment>

void main(){
  #include <clipping_planes_fragment>

  // Limb darkening (stars are darker at edges)
  float limb = clamp(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0, 1.0);
  float limbDark = mix(0.45, 1.0, pow(limb, 0.3));

  // Sunspots (darker patches based on noise)
  float spot = smoothstep(0.15, 0.50, vNoise);
  // Fine granulation detail
  float granule = smoothstep(-0.3, 0.3, vNoise2) * 0.15;

  // Hot plasma flares (bright patches)
  float flare = max(0.0, snoise(vNormal * 8.0 + uTime * 0.85)) * 0.45;
  float flare2 = max(0.0, snoise(vNormal * 15.0 + uTime * 1.2)) * 0.2;

  vec3 col = uColor * (mix(0.55, 1.0, spot) + flare + flare2 + granule);
  col *= limbDark;

  // Slight color temperature variation: hotter spots are slightly bluer
  col += vec3(0.0, 0.0, flare * 0.1);

  gl_FragColor = vec4(col, 1.0);
}`;

// ── PLANET DATA ───────────────────────────────────────────────────────────────
const PLANETS = [
  { name:'Mercurio', r:4.2,  size:0.11, color:0xb0a090, speed:2.2 },
  { name:'Venus',    r:6.0,  size:0.20, color:0xf5deb3, speed:1.7 },
  { name:'Tierra',   r:8.0,  size:0.21, color:0x4488cc, speed:1.35 },
  { name:'Marte',    r:11.0, size:0.14, color:0xcc4422, speed:1.05 },
  { name:'Júpiter',  r:16.5, size:0.65, color:0xc8a060, speed:0.72 },
  { name:'Saturno',  r:23.0, size:0.55, color:0xe8d090, speed:0.52, ring:true },
  { name:'Urano',    r:30.0, size:0.36, color:0x88ddee, speed:0.36 },
  { name:'Neptuno',  r:38.0, size:0.34, color:0x4466cc, speed:0.26 },
];

// ── LAYER DATA (interior) ─────────────────────────────────────────────────────
const LAYERS = [
  { name:'Fotosfera',        ratio:1.00, color:0xffcc44, emissive:0.3, opacity:0.45,
    tip:'La superficie visible. Lo que vemos como "el sol". ~5,778 K.' },
  { name:'Zona Convectiva',  ratio:0.85, color:0xff6600, emissive:0.4, opacity:0.55,
    tip:'El plasma sube y baja como agua hirviendo, a escala solar.' },
  { name:'Zona Radiativa',   ratio:0.60, color:0xff2200, emissive:0.5, opacity:0.65,
    tip:'Los fotones tardan ~100,000 años en cruzar esta capa.' },
  { name:'Núcleo',           ratio:0.25, color:0xffffff, emissive:1.0, opacity:0.90,
    tip:'Aquí ocurre la fusión nuclear. T > 15 millones K.' },
];

const KM_PER_UNIT = 696000; // 1 scene unit = 1 R☉ = 696,000 km

export class StarScene {
  constructor(container, css2dContainer) {
    this.container      = container;
    this.css2dContainer = css2dContainer;
    this.clock          = new THREE.Clock();
    this.state = { mass:1, radius:1, temperature:5778, hRemaining:75, interiorMode:false, sunGhost:false };
    this.planets        = [];
    this.clippingPlane  = new THREE.Plane(new THREE.Vector3(-1,0,0), 500);
    this.interiorGroup  = new THREE.Group();
    this.solarGroup     = new THREE.Group();
    this.bloomStrength  = 1.4;
    this.onLayerClick   = null;
    this._gridLabels    = [];
    this._flareTimer    = 0;

    this._init();
  }

  _init() {
    const w = this.container.clientWidth  || window.innerWidth - 300;
    const h = this.container.clientHeight || window.innerHeight - 57;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias:true, alpha:false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
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
    this.camera = new THREE.PerspectiveCamera(45, w/h, 0.05, 2000);
    this.camera.position.set(0, 8, 25);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 250;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.4;
    this.controls.addEventListener('change', () => this._updateParticleMode());

    // Post-processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w,h), this.bloomStrength, 0.5, 0.08);
    this.composer.addPass(this.bloomPass);

    // Gravitational lens (black hole)
    this.lensPass = new ShaderPass({
      uniforms: { tDiffuse:{value:null}, uStrength:{value:0.0}, uCenter:{value:new THREE.Vector2(0.5,0.5)} },
      vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`uniform sampler2D tDiffuse;uniform float uStrength;uniform vec2 uCenter;varying vec2 vUv;
        void main(){vec2 d=vUv-uCenter;float dist=length(d);vec2 uv=vUv+normalize(d)*uStrength*smoothstep(0.45,0.,dist);gl_FragColor=texture2D(tDiffuse,uv);}`
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
    this._buildSolarFlares();

    window.addEventListener('resize', () => this._onResize());

    // Raycaster for layer clicks
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this.renderer.domElement.addEventListener('click', e => this._onCanvasClick(e));

    this._animate();
  }

  // ── BACKGROUND STARS ─────────────────────────────────────────────────────────
  _buildBackground() {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(6000 * 3);
    const col = new Float32Array(6000 * 3);
    for (let i = 0; i < 6000; i++) {
      const r = 400 + Math.random()*400;
      const theta = Math.random()*Math.PI*2;
      const phi = Math.acos(2*Math.random()-1);
      pos[i*3]   = r*Math.sin(phi)*Math.cos(theta);
      pos[i*3+1] = r*Math.sin(phi)*Math.sin(theta);
      pos[i*3+2] = r*Math.cos(phi);
      const t = Math.random();
      // Varied star colors: white, blue-white, yellow, orange-red
      const hue = Math.random();
      if (hue < 0.6) { col[i*3]=0.9+t*0.1; col[i*3+1]=0.9+t*0.1; col[i*3+2]=0.95+t*0.05; }
      else if (hue < 0.8) { col[i*3]=0.7; col[i*3+1]=0.8; col[i*3+2]=1.0; }
      else { col[i*3]=1.0; col[i*3+1]=0.7+t*0.2; col[i*3+2]=0.4+t*0.2; }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos,3));
    geo.setAttribute('color', new THREE.BufferAttribute(col,3));
    this.scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size:0.55, vertexColors:true, sizeAttenuation:true })));
  }

  // ── GRID WITH KM LABELS ───────────────────────────────────────────────────────
  _buildGrid() {
    this.gridGroup = new THREE.Group();
    this.gridGroup.add(new THREE.GridHelper(100, 25, 0x1a1a3a, 0x1a1a3a));
    const axes = new THREE.AxesHelper(15);
    axes.material.opacity = 0.25; axes.material.transparent = true;
    this.gridGroup.add(axes);
    this.scene.add(this.gridGroup);

    // Distance labels along X and Z axes
    this._gridLabelDivs = [];
    const positions = [5, 10, 20, 40];
    positions.forEach(u => {
      ['x','z'].forEach(axis => {
        const div = document.createElement('div');
        div.className = 'planet-label';
        div.style.color = 'rgba(100,120,180,0.7)';
        div.style.fontSize = '0.6rem';
        const obj = new CSS2DObject(div);
        obj.position.set(axis==='x' ? u : 0, 0.1, axis==='z' ? u : 0);
        obj.userData.units = u;
        this.gridGroup.add(obj);
        this._gridLabelDivs.push({ div, obj, units:u });
      });
    });
    this._updateGridLabels();
  }

  _updateGridLabels() {
    const dist = this.camera.position.length();
    this._gridLabelDivs?.forEach(({ div, units }) => {
      const km = units * KM_PER_UNIT;
      let label;
      if (km < 1e6) label = `${(km/1000).toFixed(0)}k km`;
      else if (km < 1e9) label = `${(km/1e6).toFixed(1)}M km`;
      else label = `${(km/1e9).toFixed(2)}B km`;
      div.textContent = label;
      div.style.display = dist > 8 ? '' : 'none';
    });
  }

  // ── STAR ──────────────────────────────────────────────────────────────────────
  _buildStar() {
    const geo = new THREE.SphereGeometry(1, 96, 96);
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

    // Lights
    this.starLight = new THREE.PointLight(0xfff0dd, 4, 300);
    this.solarGroup.add(this.starLight);

    // Ambient light so planets are visible even away from direct star light
    this.ambientLight = new THREE.AmbientLight(0x223366, 0.7);
    this.scene.add(this.ambientLight);

    // Corona glow (additive sphere slightly larger than star)
    const coronaMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(c[0], c[1], c[2]),
      transparent: true, opacity: 0.08,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide,
    });
    this.coronaMesh = new THREE.Mesh(new THREE.SphereGeometry(1.18, 32, 32), coronaMat);
    this.solarGroup.add(this.coronaMesh);

    // Sun ghost
    const ghostMat = new THREE.MeshBasicMaterial({ color:0xffee88, transparent:true, opacity:0.1, depthWrite:false });
    this.sunGhostMesh = new THREE.Mesh(new THREE.SphereGeometry(1,32,32), ghostMat);
    this.sunGhostMesh.visible = false;
    this.solarGroup.add(this.sunGhostMesh);
    const ghostLabel = document.createElement('div');
    ghostLabel.className = 'planet-label';
    ghostLabel.textContent = '☀ Nuestro Sol';
    ghostLabel.style.color = '#ffcc44';
    this.sunGhostLabel = new CSS2DObject(ghostLabel);
    this.sunGhostLabel.position.set(0, 1.3, 0);
    this.sunGhostMesh.add(this.sunGhostLabel);

    this.scene.add(this.solarGroup);
  }

  // ── SOLAR FLARES ─────────────────────────────────────────────────────────────
  _buildSolarFlares() {
    this.flaresGroup = new THREE.Group();
    this.solarGroup.add(this.flaresGroup);
  }

  _spawnFlare() {
    if (!window.gsap) return;
    const r = this.starMesh.scale.x;
    const dir = new THREE.Vector3().randomDirection();
    const len = 0.4 + Math.random() * 0.8;
    const geo = new THREE.PlaneGeometry(0.06 + Math.random()*0.08, len);
    const c = this.starMat.uniforms.uColor.value;
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(c.r+0.2, c.g+0.1, c.b),
      transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const flare = new THREE.Mesh(geo, mat);
    flare.position.copy(dir.clone().multiplyScalar(r * 0.98));
    flare.lookAt(new THREE.Vector3(0,0,0));
    flare.rotateX(Math.PI/2);
    flare.translateY(len * 0.5);
    this.flaresGroup.add(flare);
    gsap.fromTo(flare.scale, { y:0.1 }, { y:1, duration:0.5+Math.random()*0.3, ease:'power2.out' });
    gsap.to(mat, { opacity:0, duration:0.8+Math.random()*0.6, delay:0.4, ease:'power2.in',
      onComplete: () => { this.flaresGroup.remove(flare); geo.dispose(); mat.dispose(); }
    });
  }

  // ── SOLAR SYSTEM ─────────────────────────────────────────────────────────────
  _buildSolarSystem() {
    this.planets = PLANETS.map(pd => {
      const mat = new THREE.MeshStandardMaterial({ color:pd.color, roughness:0.75, metalness:0.05 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(pd.size, 32, 32), mat);
      mesh.userData = { orbitRadius:pd.r, speed:pd.speed, angle:Math.random()*Math.PI*2 };
      this.solarGroup.add(mesh);

      // Orbit ring
      const orbitGeo = new THREE.RingGeometry(pd.r-0.03, pd.r+0.03, 128);
      const orbitMat = new THREE.MeshBasicMaterial({ color:0x2a2a55, side:THREE.DoubleSide, transparent:true, opacity:0.35 });
      const orbitRing = new THREE.Mesh(orbitGeo, orbitMat);
      orbitRing.rotation.x = -Math.PI/2;
      this.solarGroup.add(orbitRing);

      if (pd.ring) {
        const ringGeo = new THREE.RingGeometry(pd.size*1.5, pd.size*2.4, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color:0xc8a855, side:THREE.DoubleSide, transparent:true, opacity:0.75 });
        mesh.add(new THREE.Mesh(ringGeo, ringMat));
      }

      // CSS2D Label
      const div = document.createElement('div');
      div.className = 'planet-label';
      div.textContent = pd.name;
      const label = new CSS2DObject(div);
      label.position.set(0, pd.size+0.25, 0);
      label.userData.labelDiv = div;
      mesh.add(label);
      mesh.userData.label = label;

      return mesh;
    });
  }

  // ── INTERIOR LAYERS ───────────────────────────────────────────────────────────
  _buildInterior() {
    this.layerMeshes = [];
    LAYERS.forEach(l => {
      const geo = new THREE.SphereGeometry(l.ratio, 48, 48);
      const mat = new THREE.MeshStandardMaterial({
        color: l.color, emissive: new THREE.Color(l.color),
        emissiveIntensity: l.emissive,
        transparent: true, opacity: l.opacity,
        side: THREE.BackSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { layerName: l.name, layerTip: l.tip };
      this.layerMeshes.push(mesh);
      this.interiorGroup.add(mesh);
    });
    this.interiorGroup.visible = false;
    this.scene.add(this.interiorGroup);
  }

  // ── FUSION PARTICLES ──────────────────────────────────────────────────────────
  _buildFusionParticles() {
    // Macro particles
    const mGeo = new THREE.BufferGeometry();
    const mPos = new Float32Array(300*3), mCol = new Float32Array(300*3);
    for (let i=0;i<300;i++){
      const r=Math.random()*0.85, t=Math.random()*Math.PI*2, p=Math.acos(2*Math.random()-1);
      mPos[i*3]=r*Math.sin(p)*Math.cos(t); mPos[i*3+1]=r*Math.sin(p)*Math.sin(t); mPos[i*3+2]=r*Math.cos(p);
      const c=Math.random(); mCol[i*3]=1; mCol[i*3+1]=0.4+c*0.5; mCol[i*3+2]=c*0.2;
    }
    mGeo.setAttribute('position', new THREE.BufferAttribute(mPos,3));
    mGeo.setAttribute('color', new THREE.BufferAttribute(mCol,3));
    this.macroParticles = new THREE.Points(mGeo, new THREE.PointsMaterial({size:0.07,vertexColors:true,transparent:true,opacity:0.75}));

    // Micro particles
    this.microH = []; this.microHe = [];
    const microGroup = new THREE.Group();
    const hGeo = new THREE.SphereGeometry(0.013, 8, 8);
    const hMat = new THREE.MeshBasicMaterial({ color:0x55aaff });
    const heMat = new THREE.MeshBasicMaterial({ color:0x55ffaa });
    for (let i=0;i<80;i++){
      const m=new THREE.Mesh(hGeo, hMat); this._rndSphere(m, 0.22);
      m.userData = { vel:new THREE.Vector3((Math.random()-.5)*.003,(Math.random()-.5)*.003,(Math.random()-.5)*.003), state:'free' };
      microGroup.add(m); this.microH.push(m);
    }
    for (let i=0;i<20;i++){
      const m=new THREE.Mesh(hGeo, heMat); this._rndSphere(m, 0.22);
      m.userData = { vel:new THREE.Vector3((Math.random()-.5)*.002,(Math.random()-.5)*.002,(Math.random()-.5)*.002) };
      microGroup.add(m); this.microHe.push(m);
    }
    this.microGroup = microGroup;
    this.macroParticles.visible = false;
    this.microGroup.visible = false;
    this.interiorGroup.add(this.macroParticles);
    this.interiorGroup.add(this.microGroup);
    this._fusionTimer = 0;
  }

  _rndSphere(obj, r) {
    const t=Math.random()*Math.PI*2, p=Math.acos(2*Math.random()-1), rad=Math.random()*r;
    obj.position.set(rad*Math.sin(p)*Math.cos(t), rad*Math.sin(p)*Math.sin(t), rad*Math.cos(p));
  }

  _updateParticleMode() {
    if (!this.state.interiorMode) return;
    const d = this.camera.position.length();
    this.macroParticles.visible = d >= 3.5;
    this.microGroup.visible = d < 3.5;
  }

  // ── UPDATE STAR ───────────────────────────────────────────────────────────────
  updateStar(state) {
    Object.assign(this.state, state);
    const { radius, temperature, hRemaining } = state;
    const c = starColor(temperature);
    const col = new THREE.Color(c[0], c[1], c[2]);
    this.starMat.uniforms.uColor.value.copy(col);
    this.starMat.uniforms.uRadius.value = radius;

    const sc = Math.max(0.08, radius);
    this.starMesh.scale.setScalar(sc);
    this.coronaMesh.scale.setScalar(sc * 1.08);

    this.starLight.color.copy(col);
    this.starLight.intensity = Math.min(radius * 2.5 + 1, 12);

    // Update corona opacity based on luminosity
    this.coronaMesh.material.color.copy(col);
    this.coronaMesh.material.opacity = Math.min(0.05 + Math.pow(radius, 0.5) * 0.04, 0.25);

    // Update layer emissive intensity
    const rate = Math.max(0, hRemaining) / 100;
    this.layerMeshes?.forEach((m,i) => {
      m.material.emissiveIntensity = LAYERS[i].emissive * (0.3 + rate * 0.7);
    });
  }

  toggleSunGhost(visible) {
    this.sunGhostMesh.visible = visible;
    this.state.sunGhost = visible;
  }

  // ── INTERIOR TOGGLE ───────────────────────────────────────────────────────────
  async toggleInterior(toInterior) {
    this.state.interiorMode = toInterior;
    if (toInterior) {
      this.interiorGroup.visible = true;
      await this._animatePlane(500, 0, 1.2);
      this.macroParticles.visible = true;
      this._updateParticleMode();
      this.gridGroup.visible = false;
    } else {
      this.macroParticles.visible = false;
      this.microGroup.visible = false;
      await this._animatePlane(0, 500, 1.0);
      this.interiorGroup.visible = false;
      this.gridGroup.visible = true;
    }
  }

  _animatePlane(from, to, dur) {
    return new Promise(r => {
      if (!window.gsap) { this.clippingPlane.constant = to; r(); return; }
      gsap.to({ val:from }, { val:to, duration:dur, ease:'power2.inOut',
        onUpdate: function() { }, // can't access `this` easily, use a wrapper
        onComplete: r
      });
      // Use a ticker approach instead
      const start = performance.now();
      const tick = () => {
        const p = Math.min((performance.now()-start)/(dur*1000), 1);
        const eased = p < 0.5 ? 2*p*p : -1+(4-2*p)*p;
        this.clippingPlane.constant = from + (to-from)*eased;
        if (p < 1) requestAnimationFrame(tick); else r();
      };
      tick();
    });
  }

  // ── CANVAS CLICK ─────────────────────────────────────────────────────────────
  _onCanvasClick(e) {
    if (!this.state.interiorMode) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((e.clientX-rect.left)/rect.width)*2-1;
    this._mouse.y = -((e.clientY-rect.top)/rect.height)*2+1;
    this._raycaster.setFromCamera(this._mouse, this.camera);
    const hits = this._raycaster.intersectObjects(this.layerMeshes);
    if (hits.length && this.onLayerClick) {
      const { layerName, layerTip } = hits[0].object.userData;
      this.onLayerClick(layerName, layerTip, e.clientX, e.clientY);
    }
  }

  // ── 3D→SCREEN PROJECTION ─────────────────────────────────────────────────────
  project(worldPos) {
    const v = worldPos.clone().project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x:(v.x+1)/2*rect.width+rect.left, y:(1-v.y)/2*rect.height+rect.top };
  }

  getAnchorWorld(name) {
    const r = Math.max(this.state.radius, 1);
    switch(name) {
      case 'nucleo':     return new THREE.Vector3(0, r*0.25, 0);
      case 'particulas': return new THREE.Vector3(r*0.2, r*0.35, 0);
      case 'estrella':   return new THREE.Vector3(0, r*1.15, 0);
      case 'planetas':   return new THREE.Vector3(9, 2, 0);
      case 'explosion':  return new THREE.Vector3(0, 8, 0);
      default:           return new THREE.Vector3(0, r, 0);
    }
  }

  // ── ANIMATE LOOP ──────────────────────────────────────────────────────────────
  _animate() {
    requestAnimationFrame(() => this._animate());
    const t = this.clock.getElapsedTime();
    this.starMat.uniforms.uTime.value = t;

    // Orbit planets
    const camDist = this.camera.position.length();
    this.planets.forEach(p => {
      p.userData.angle += p.userData.speed * 0.001;
      p.position.x = p.userData.orbitRadius * Math.cos(p.userData.angle);
      p.position.z = p.userData.orbitRadius * Math.sin(p.userData.angle);
      p.rotation.y += 0.004;
      // Label occlusion
      const label = p.userData.label;
      if (label?.userData.labelDiv) {
        const toCamera = this.camera.position.clone().sub(p.position).normalize();
        label.userData.labelDiv.style.display = camDist > 18 && toCamera.dot(this.camera.position.clone().normalize()) > -0.3 ? '' : 'none';
      }
    });

    // Pulsing convective layer
    if (this.state.interiorMode && this.layerMeshes[1]) {
      this.layerMeshes[1].material.opacity = 0.5 + Math.sin(t*1.8)*0.1;
    }

    // Solar flares
    this._flareTimer -= 0.016;
    if (this._flareTimer <= 0 && !this.state.interiorMode) {
      this._flareTimer = 1.5 + Math.random()*2.5;
      this._spawnFlare();
    }

    // Fusion particles
    if (this.microGroup.visible) this._animateFusion();

    // Grid label update
    this._updateGridLabels();

    this.controls.update();
    this.composer.render();
    this.css2d.render(this.scene, this.camera);
  }

  _animateFusion() {
    this._fusionTimer -= 0.016;
    this.microH.forEach(h => {
      if (h.userData.state === 'free') {
        h.position.add(h.userData.vel);
        if (h.position.length() > 0.22) h.userData.vel.negate();
      }
    });
    this.microHe.forEach(he => {
      he.position.add(he.userData.vel);
      if (he.position.length() > 0.22) he.userData.vel.negate();
    });
    const rate = this.state.hRemaining / 100;
    if (this._fusionTimer <= 0 && rate > 0.05) {
      this._fusionTimer = 1.2 + Math.random() * 1.8;
      this._doFusionEvent();
    }
  }

  _doFusionEvent() {
    const h1 = this.microH.find(h => h.userData.state==='free');
    const h2 = this.microH.find(h => h!==h1 && h.userData.state==='free');
    if (!h1 || !h2 || !window.gsap) return;
    const target = new THREE.Vector3().randomDirection().multiplyScalar(0.04);
    h1.userData.state = 'fusing'; h2.userData.state = 'fusing';
    gsap.to(h1.position, { x:target.x, y:target.y, z:target.z, duration:0.35, ease:'power2.in',
      onComplete: () => {
        h1.userData.state = 'free'; h2.userData.state = 'free';
        this._rndSphere(h1, 0.22); this._rndSphere(h2, 0.22);
        const he = this.microHe[Math.floor(Math.random()*this.microHe.length)];
        he.position.copy(target);
      }
    });
    gsap.to(h2.position, { x:target.x, y:target.y, z:target.z, duration:0.35, ease:'power2.in' });
  }

  // ── RESIZE ────────────────────────────────────────────────────────────────────
  _onResize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w/h; this.camera.updateProjectionMatrix();
    this.renderer.setSize(w,h);
    this.composer.setSize(w,h);
    this.css2d.setSize(w,h);
  }

  get canvas() { return this.renderer.domElement; }
  get camTarget() { return this.controls.target; }
}
