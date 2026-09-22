/* ==========================================================================
   Umbral · escena 3D
   El logo de Umbral (un arco) se convierte en un umbral monumental.
   Las personas (partículas) cruzan el haz central: grises fuera, verdes dentro.
   La cámara viaja por la escena según la sección visible.
   ========================================================================== */

'use strict';

/* Script clásico con importaciones dinámicas: funciona abriendo index.html con
   doble clic (file://), desde un servidor y dentro de la vista previa publicada. */
(async () => {

const THREE = await import('three');
const { EffectComposer } = await import('three/addons/postprocessing/EffectComposer.js');
const { RenderPass } = await import('three/addons/postprocessing/RenderPass.js');
const { UnrealBloomPass } = await import('three/addons/postprocessing/UnrealBloomPass.js');
const { OutputPass } = await import('three/addons/postprocessing/OutputPass.js');
const { RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js');

const canvas = document.getElementById('scene');
const mqMobile = window.matchMedia('(max-width: 820px)');
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none)').matches;

const C = {
  bg: 0x0A0F12,
  gold: 0xE7B368,
  goldDeep: 0xC0821F,
  goldLight: 0xFFE4AE,
  live: 0x5FBE97,
  ice: 0xCFE6FF,
  muted: 0x8FA39C,
  line: 0x1E2B2C,
};

function ready() {
  window.dispatchEvent(new CustomEvent('umbral:ready'));
}

/* --------------------------------------------------------------------------
   Renderer, escena, cámara
   -------------------------------------------------------------------------- */

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  document.body.classList.add('no-webgl');
  ready();
  throw err;
}

const pixelRatio = () => Math.min(window.devicePixelRatio || 1, mqMobile.matches ? 1.5 : 2);
renderer.setPixelRatio(pixelRatio());
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;

const scene = new THREE.Scene();
scene.background = new THREE.Color(C.bg);
scene.fog = new THREE.FogExp2(C.bg, 0.05);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 140);
camera.position.set(-1.2, 1.7, 9.6);

scene.add(new THREE.AmbientLight(0x27373a, 1.4));
const keyLight = new THREE.PointLight(C.gold, 28, 18, 2);
keyLight.position.set(0, 4.4, 1.4);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(C.live, 1.1);
rimLight.position.set(-4, 6, -8);
scene.add(rimLight);

/* --------------------------------------------------------------------------
   Suelo: rejilla con desvanecimiento y charcos de luz bajo cada puerta
   -------------------------------------------------------------------------- */

const floorMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  fog: true,
  uniforms: THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uBg: { value: new THREE.Color(C.bg) },
      uLine: { value: new THREE.Color(C.line) },
      uCam: { value: new THREE.Vector3() },
      uPools: { value: [
        new THREE.Vector4(0, 0, 3.2, 0.26),
        new THREE.Vector4(-3.4, -9, 1.6, 0.16),
        new THREE.Vector4(0, -9, 1.6, 0.16),
        new THREE.Vector4(3.4, -9, 1.6, 0.16),
      ] },
      uPoolCols: { value: [
        new THREE.Color(C.gold),
        new THREE.Color(C.gold),
        new THREE.Color(C.live),
        new THREE.Color(C.ice),
      ] },
    },
  ]),
  vertexShader: /* glsl */`
    #include <fog_pars_vertex>
    varying vec3 vW;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vW = wp.xyz;
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
    }
  `,
  fragmentShader: /* glsl */`
    #include <fog_pars_fragment>
    uniform vec3 uBg;
    uniform vec3 uLine;
    uniform vec3 uCam;
    uniform vec4 uPools[4];
    uniform vec3 uPoolCols[4];
    varying vec3 vW;
    void main() {
      vec2 gp = vW.xz * 0.5;
      vec2 g = abs(fract(gp - 0.5) - 0.5) / fwidth(gp);
      float line = 1.0 - min(min(g.x, g.y), 1.0);
      float dc = distance(vW.xz, uCam.xz);
      float fade = exp(-dc * 0.07);
      vec3 col = uBg;
      col = mix(col, uLine, line * 0.75 * fade);
      for (int i = 0; i < 4; i++) {
        vec2 d = (vW.xz - uPools[i].xy) / uPools[i].z;
        float pool = exp(-dot(d, d) * 1.3) * uPools[i].w;
        col += uPoolCols[i] * pool;
      }
      gl_FragColor = vec4(col, 0.72);
      #include <fog_fragment>
    }
  `,
});
const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), floorMat);
floor.rotation.x = -Math.PI / 2;
floor.renderOrder = 2;
scene.add(floor);

/* --------------------------------------------------------------------------
   El arco (umbral)
   -------------------------------------------------------------------------- */

const ARCH = { w: 1.6, side: 3.2, top: 5.33 };

function archPath({ w, side, top }) {
  const p = new THREE.CurvePath();
  p.add(new THREE.LineCurve3(new THREE.Vector3(-w, 0, 0), new THREE.Vector3(-w, side, 0)));
  p.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(-w, side, 0), new THREE.Vector3(-w, top, 0), new THREE.Vector3(0, top, 0)));
  p.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, top, 0), new THREE.Vector3(w, top, 0), new THREE.Vector3(w, side, 0)));
  p.add(new THREE.LineCurve3(new THREE.Vector3(w, side, 0), new THREE.Vector3(w, 0, 0)));
  return p;
}

function archShape({ w, side, top }) {
  const s = new THREE.Shape();
  s.moveTo(-w, 0);
  s.lineTo(-w, side);
  s.quadraticCurveTo(-w, top, 0, top);
  s.quadraticCurveTo(w, top, w, side);
  s.lineTo(w, 0);
  s.closePath();
  return s;
}

const goldMat = new THREE.MeshStandardMaterial({
  color: C.gold,
  metalness: 0.85,
  roughness: 0.28,
  emissive: C.goldDeep,
  emissiveIntensity: 0.18,
  envMapIntensity: 0.9,
});

function glowColor(hex, k) {
  return new THREE.Color(hex).multiplyScalar(k);
}

const veilMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(C.gold) },
    uFogDensity: { value: 0.05 },
    uFade: { value: 1 },
  },
  vertexShader: /* glsl */`
    varying vec2 vP;
    varying float vDepth;
    void main() {
      vP = position.xy;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: /* glsl */`
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uFogDensity;
    uniform float uFade;
    varying vec2 vP;
    varying float vDepth;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    void main() {
      vec2 q = (vP - vec2(0.0, 2.6)) / vec2(1.6, 2.75);
      float r = length(q);
      float edge = smoothstep(0.3, 1.0, r);
      float n = noise(vP * 1.4 + vec2(0.0, uTime * 0.22)) * 0.6 + noise(vP * 3.1 - vec2(uTime * 0.1, uTime * 0.35)) * 0.4;
      float a = (0.04 + edge * 0.24) * (0.5 + 0.5 * n);
      float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
      a *= (1.0 - fogF) * uFade;
      gl_FragColor = vec4(uColor * a, a);
    }
  `,
});

const haloShader = {
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uColor;
    uniform float uAlpha;
    varying vec2 vUv;
    void main() {
      float x = (vUv.x - 0.5) * 2.0;
      float a = exp(-x * x * 5.0);
      a *= smoothstep(0.0, 0.12, vUv.y) * (1.0 - smoothstep(0.82, 1.0, vUv.y));
      gl_FragColor = vec4(uColor * a * uAlpha, a * uAlpha);
    }
  `,
};

function makeArch({ dims = ARCH, coreHex = C.goldLight, coreGlow = 1.35, tube = 0.1, beam = true, veil = true, veilHex = C.gold } = {}) {
  const g = new THREE.Group();
  const path = archPath(dims);

  const frame = new THREE.Mesh(new THREE.TubeGeometry(path, 180, tube, 24, false), goldMat);
  g.add(frame);

  const core = new THREE.Mesh(
    new THREE.TubeGeometry(path, 180, tube * 0.32, 10, false),
    new THREE.MeshBasicMaterial({ color: glowColor(coreHex, coreGlow), toneMapped: false })
  );
  g.add(core);

  const baseLen = dims.w * 2.9;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(tube * 0.6, tube * 0.6, baseLen, 14).rotateZ(Math.PI / 2), goldMat);
  base.position.y = tube * 0.3;
  g.add(base);
  const baseCore = new THREE.Mesh(
    new THREE.CylinderGeometry(tube * 0.18, tube * 0.18, baseLen, 8).rotateZ(Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: glowColor(coreHex, coreGlow * 0.8), toneMapped: false })
  );
  baseCore.position.y = tube * 0.3;
  g.add(baseCore);

  if (beam) {
    const h = dims.top * 0.86;
    const beamCore = new THREE.Mesh(
      new THREE.CylinderGeometry(tube * 0.2, tube * 0.2, h, 8),
      new THREE.MeshBasicMaterial({ color: glowColor(coreHex, 1.7), toneMapped: false, transparent: true, opacity: 0.95 })
    );
    beamCore.position.y = h / 2 + tube * 0.6;
    beamCore.name = 'beam';
    g.add(beamCore);

    const haloMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(coreHex) }, uAlpha: { value: 0.22 } },
      vertexShader: haloShader.vertexShader,
      fragmentShader: haloShader.fragmentShader,
    });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(dims.w * 0.5, h), haloMat);
    halo.position.copy(beamCore.position);
    const halo2 = halo.clone();
    halo2.rotation.y = Math.PI / 2;
    g.add(halo, halo2);
    g.userData.haloMat = haloMat;
  }

  if (veil) {
    const vm = veilMat.clone();
    vm.uniforms.uColor.value = new THREE.Color(veilHex);
    const v = new THREE.Mesh(new THREE.ShapeGeometry(archShape(dims), 24), vm);
    v.name = 'veil';
    g.add(v);
    g.userData.veilMat = vm;
  }

  return g;
}

const arch = makeArch();
scene.add(arch);

const doors = new THREE.Group();
const doorSpecs = [
  { x: -3.4, core: C.goldLight, veil: C.gold },
  { x: 0, core: 0xBFFFDF, veil: C.live },
  { x: 3.4, core: 0xE6F3FF, veil: C.ice },
];
const smallDims = { w: ARCH.w * 0.55, side: ARCH.side * 0.55, top: ARCH.top * 0.55 };
doorSpecs.forEach((d) => {
  const a = makeArch({ dims: smallDims, coreHex: d.core, coreGlow: 1.25, tube: 0.07, beam: false, veilHex: d.veil });
  a.position.set(d.x, 0, -9);
  doors.add(a);
});
scene.add(doors);

/* Reflejo en el suelo: copia invertida y atenuada */
function makeReflection(group) {
  const r = group.clone(true);
  r.scale.y = -1;
  r.traverse((o) => {
    if (!o.isMesh) return;
    const m = o.material.clone();
    if (m.uniforms) {
      m.uniforms.uColor.value = m.uniforms.uColor.value.clone().multiplyScalar(0.35);
    } else {
      if (m.color) m.color = m.color.clone().multiplyScalar(0.55);
      if (m.emissiveIntensity !== undefined) m.emissiveIntensity *= 0.5;
      m.transparent = true;
      m.opacity = (m.opacity ?? 1) * 0.75;
    }
    o.material = m;
    o.renderOrder = 1;
  });
  return r;
}
scene.add(makeReflection(arch));
scene.add(makeReflection(doors));

/* --------------------------------------------------------------------------
   Partículas: personas que cruzan el umbral
   -------------------------------------------------------------------------- */

const COUNT = mqMobile.matches ? 420 : 1100;
const seeds = new Float32Array(COUNT * 4);
const starts = new Float32Array(COUNT * 3);
const gates = new Float32Array(COUNT * 3);
const ends = new Float32Array(COUNT * 3);
const rand = (a, b) => a + Math.random() * (b - a);

for (let i = 0; i < COUNT; i++) {
  const side = Math.random() < 0.5 ? -1 : 1;
  seeds.set([side, Math.random(), rand(0.05, 0.11), rand(1.4, 3.2)], i * 4);
  starts.set([side * rand(2.4, 9.5), rand(0.2, 2.8), rand(0.5, 7.5)], i * 3);
  gates.set([rand(-1.25, 1.25), rand(0.25, 2.6), 0], i * 3);
  ends.set([rand(-7.5, 7.5), rand(0.2, 3.0), rand(-4, -15)], i * 3);
}

const partGeo = new THREE.BufferGeometry();
partGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
partGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
partGeo.setAttribute('aStart', new THREE.BufferAttribute(starts, 3));
partGeo.setAttribute('aGate', new THREE.BufferAttribute(gates, 3));
partGeo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 3));
partGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.5, -4), 30);

const partMat = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: {
    uTime: { value: 0 },
    uPix: { value: pixelRatio() },
    uOut: { value: new THREE.Color(C.muted) },
    uIn: { value: new THREE.Color(C.live) },
    uFlash: { value: new THREE.Color(0xFFF3D6) },
    uFogDensity: { value: 0.05 },
  },
  vertexShader: /* glsl */`
    attribute vec4 aSeed;
    attribute vec3 aStart;
    attribute vec3 aGate;
    attribute vec3 aEnd;
    uniform float uTime;
    uniform float uPix;
    varying float vZ;
    varying float vLife;
    varying float vFlash;
    varying float vDepth;
    void main() {
      float life = fract(uTime * aSeed.z + aSeed.y);
      vec3 p;
      if (life < 0.5) {
        float t = life * 2.0;
        t = mix(t, t * t * (3.0 - 2.0 * t), 0.5);
        p = mix(aStart, aGate, t);
      } else {
        float t = (life - 0.5) * 2.0;
        p = mix(aGate, aEnd, t);
      }
      p.y += sin(uTime * 1.6 + aSeed.y * 37.0) * 0.05;
      vZ = p.z;
      vLife = life;
      vFlash = exp(-abs(p.z) * 3.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vDepth = -mv.z;
      gl_Position = projectionMatrix * mv;
      gl_PointSize = min(aSeed.w * uPix * (26.0 / max(vDepth, 0.5)), 16.0 * uPix);
    }
  `,
  fragmentShader: /* glsl */`
    uniform vec3 uOut;
    uniform vec3 uIn;
    uniform vec3 uFlash;
    uniform float uFogDensity;
    varying float vZ;
    varying float vLife;
    varying float vFlash;
    varying float vDepth;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      float a = smoothstep(0.5, 0.06, d);
      vec3 col = mix(uOut, uIn, step(vZ, 0.0));
      col = mix(col, uFlash, vFlash);
      float ends = smoothstep(0.0, 0.08, vLife) * (1.0 - smoothstep(0.9, 1.0, vLife));
      float fogF = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
      float near = smoothstep(0.7, 2.4, vDepth);
      float alpha = a * ends * 0.85 * (1.0 - fogF) * near;
      gl_FragColor = vec4(col * alpha, alpha);
    }
  `,
});
const particles = new THREE.Points(partGeo, partMat);
particles.frustumCulled = false;
scene.add(particles);

/* --------------------------------------------------------------------------
   QR 3D con láser de escaneo
   -------------------------------------------------------------------------- */

function qrMatrix(n = 21, seed = 7) {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const m = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) m[i][j] = rnd() > 0.5 ? 1 : 0;
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { m[i][j] = 0; m[i][n - 1 - j] = 0; m[n - 1 - i][j] = 0; }
  const finder = (r, c) => {
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const ring = Math.max(Math.abs(i - 3), Math.abs(j - 3));
      m[r + i][c + j] = (ring === 3 || ring <= 1) ? 1 : 0;
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let k = 8; k < n - 8; k++) { m[6][k] = k % 2 === 0 ? 1 : 0; m[k][6] = k % 2 === 0 ? 1 : 0; }
  return m;
}

const qr = new THREE.Group();
qr.position.set(2.3, 1.95, -15);
qr.rotation.y = -0.42;
{
  const N = 21;
  const cell = 0.092;
  const size = N * cell;
  const m = qrMatrix(N, 11);

  const rim = new THREE.Mesh(
    new THREE.PlaneGeometry(size + 0.36, size + 0.36),
    new THREE.MeshBasicMaterial({ color: glowColor(C.gold, 0.55), toneMapped: false })
  );
  rim.position.z = -0.035;
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(size + 0.3, size + 0.3),
    new THREE.MeshStandardMaterial({ color: 0x0C1316, roughness: 0.45, metalness: 0.35, envMapIntensity: 0.6 })
  );
  plate.position.z = -0.02;
  qr.add(rim, plate);

  let count = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (m[i][j]) count++;
  const modules = new THREE.InstancedMesh(
    new THREE.BoxGeometry(cell * 0.86, cell * 0.86, 0.06),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    count
  );
  const dummy = new THREE.Object3D();
  const ys = new Float32Array(count);
  let k = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    if (!m[i][j]) continue;
    const x = (j - (N - 1) / 2) * cell;
    const y = ((N - 1) / 2 - i) * cell;
    dummy.position.set(x, y, 0.03);
    dummy.updateMatrix();
    modules.setMatrixAt(k, dummy.matrix);
    modules.setColorAt(k, new THREE.Color(C.gold));
    ys[k] = y;
    k++;
  }
  modules.userData.ys = ys;
  modules.userData.half = size / 2;
  modules.name = 'modules';
  qr.add(modules);

  const scan = new THREE.Mesh(
    new THREE.PlaneGeometry(size + 0.2, 0.028),
    new THREE.MeshBasicMaterial({ color: glowColor(C.goldLight, 2.4), toneMapped: false, transparent: true })
  );
  scan.position.z = 0.09;
  scan.name = 'scan';
  const scanGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(size + 0.2, 0.42),
    new THREE.MeshBasicMaterial({ color: C.gold, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  scanGlow.position.z = 0.085;
  scanGlow.name = 'scanGlow';
  qr.add(scan, scanGlow);
}
scene.add(qr);

/* --------------------------------------------------------------------------
   Postproceso: bloom
   -------------------------------------------------------------------------- */

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.45, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

/* --------------------------------------------------------------------------
   Cámara por sección
   -------------------------------------------------------------------------- */

const CAMS = {
  hero: {
    pos: [-2.6, 1.7, 10.6], look: [-2.9, 2.4, 0], drift: [0.4, 0, -2.4],
    mobile: { pos: [0, 1.5, 16], look: [0, 2.9, 0], drift: [0, 0, -2.5] },
  },
  problema: {
    pos: [3.6, 2.0, 5.4], look: [0.4, 2.2, 0], drift: [-0.6, 0, -1.2],
    mobile: { pos: [3.2, 2.0, 8.0], look: [0, 2.2, 0], drift: [-0.6, 0, -1.2] },
  },
  solucion: {
    pos: [0, 1.7, -2.2], look: [0, 1.4, -9], drift: [0, 0, -1.6],
    mobile: { pos: [0, 1.7, 1.2], look: [0, 1.4, -9], drift: [0, 0, -1.6] },
  },
  'tiempo-real': {
    pos: [-1.6, 1.9, -10.4], look: [-0.1, 1.9, -15], drift: [0.6, 0, -0.6],
    mobile: { pos: [-0.6, 1.9, -8.4], look: [1.4, 2.6, -15], drift: [0.4, 0, -0.6] },
  },
  porque: {
    pos: [0.8, 2.2, -6.4], look: [0, 2.5, 0], drift: [-0.4, 0.2, 0.8],
    mobile: { pos: [0.6, 2.2, -8.6], look: [0, 2.3, 0], drift: [-0.4, 0.2, 0.8] },
  },
  como: {
    pos: [-3.8, 3.6, 4.6], look: [0.2, 1.4, -5], drift: [0.8, -0.3, -1.0],
    mobile: { pos: [-2.8, 3.4, 8.4], look: [0, 1.4, -5], drift: [0.6, -0.3, -1.0] },
  },
  faq: {
    pos: [0, 1.8, 7.2], look: [0, 2.6, 0], drift: [0, 0, -1.0],
    mobile: { pos: [0, 1.8, 11], look: [0, 2.4, 0], drift: [0, 0, -1.0] },
  },
  contacto: {
    pos: [0, 1.6, 7.0], look: [0, 2.6, 0], drift: [0, 0.1, -1.2],
    mobile: { pos: [0, 1.6, 10.5], look: [0, 2.6, 0], drift: [0, 0.1, -1.2] },
  },
};

const sections = Array.from(document.querySelectorAll('[data-cam]'));
let camName = 'hero';
let camProgress = 0;

const goalPos = new THREE.Vector3(-1.3, 1.7, 9.8);
const goalLook = new THREE.Vector3(-1.5, 2.4, 0);
const curPos = goalPos.clone();
const curLook = goalLook.clone();
const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

function keyframe(name) {
  const k = CAMS[name] || CAMS.hero;
  return (mqMobile.matches && k.mobile) ? k.mobile : k;
}

function updateGoal() {
  const k = keyframe(camName);
  goalPos.fromArray(k.pos).addScaledVector(tmpPos.fromArray(k.drift), camProgress);
  goalLook.fromArray(k.look);
}

function onScroll() {
  const vh = window.innerHeight;
  let active = sections[0];
  for (const s of sections) {
    if (s.getBoundingClientRect().top < vh * 0.62) active = s;
  }
  if (active) {
    const r = active.getBoundingClientRect();
    camName = active.dataset.cam;
    camProgress = Math.min(1, Math.max(0, (vh * 0.62 - r.top) / Math.max(r.height, 1)));
    updateGoal();
  }
}

let scrollQueued = false;
window.addEventListener('scroll', () => {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(() => { scrollQueued = false; onScroll(); });
}, { passive: true });

/* Paralaje con el puntero */
const pointer = new THREE.Vector2();
const pointerSmooth = new THREE.Vector2();
if (!isTouch) {
  window.addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  }, { passive: true });
}

/* --------------------------------------------------------------------------
   Bucle
   -------------------------------------------------------------------------- */

const modules = qr.getObjectByName('modules');
const scan = qr.getObjectByName('scan');
const scanGlow = qr.getObjectByName('scanGlow');
const beam = arch.getObjectByName('beam');
const veils = [];
scene.traverse((o) => { if (o.name === 'veil') veils.push(o); });
const baseColor = new THREE.Color(C.gold);
const tmpColor = new THREE.Color();

let t = 0;
let last = performance.now();
let firstFrame = true;
let raf = 0;

function updateQr(dt) {
  const period = 3.6;
  const phase = (t % period) / period;
  const half = modules.userData.half;
  const active = phase < 0.66;
  const y = active ? half - (phase / 0.66) * half * 2 : -half - 1;
  scan.position.y = y;
  scanGlow.position.y = y;
  scan.visible = active;
  scanGlow.visible = active;

  const ys = modules.userData.ys;
  for (let i = 0; i < ys.length; i++) {
    const d = (ys[i] - y) / 0.16;
    const g = active ? Math.exp(-d * d) : 0;
    tmpColor.copy(baseColor).multiplyScalar(0.9 + g * 1.9);
    modules.setColorAt(i, tmpColor);
  }
  modules.instanceColor.needsUpdate = true;

  qr.position.y = 1.95 + Math.sin(t * 0.7) * 0.08;
  qr.rotation.y = -0.42 + Math.sin(t * 0.35) * 0.06;
}

const archHalo = arch.userData.haloMat;
const archVeil = arch.userData.veilMat;

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  if (!reduced) t += dt;

  const k = 1 - Math.exp(-dt * 2.1);
  curPos.lerp(goalPos, k);
  curLook.lerp(goalLook, k);

  pointerSmooth.lerp(pointer, 1 - Math.exp(-dt * 3));
  tmpPos.copy(curPos);
  tmpPos.x += pointerSmooth.x * 0.45;
  tmpPos.y += pointerSmooth.y * 0.25 + Math.sin(t * 0.5) * 0.03;
  tmpLook.copy(curLook);
  tmpLook.x += pointerSmooth.x * 0.25;
  tmpLook.y += pointerSmooth.y * 0.12;
  camera.position.copy(tmpPos);
  camera.lookAt(tmpLook);

  floorMat.uniforms.uCam.value.copy(camera.position);
  partMat.uniforms.uTime.value = t;
  for (const v of veils) v.material.uniforms.uTime.value = t;
  if (beam) beam.material.opacity = 0.8 + Math.sin(t * 6.0) * 0.12;
  keyLight.intensity = 28 + Math.sin(t * 2.1) * 2;

  /* Al cruzar el umbral, el halo y el velo se desvanecen para no tapar la vista */
  const dz = Math.abs(camera.position.z);
  const nearFade = THREE.MathUtils.smoothstep(dz, 0.5, 3.0);
  if (archHalo) archHalo.uniforms.uAlpha.value = 0.22 * nearFade;
  if (archVeil) archVeil.uniforms.uFade.value = nearFade;
  updateQr(dt);

  composer.render();

  if (firstFrame) {
    firstFrame = false;
    ready();
  }
  raf = requestAnimationFrame(tick);
}

function start() {
  if (raf) return;
  last = performance.now();
  raf = requestAnimationFrame(tick);
}
function stop() {
  cancelAnimationFrame(raf);
  raf = 0;
}

document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

let resizeTimer = 0;
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  partMat.uniforms.uPix.value = pixelRatio();
  onScroll();
}
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(onResize, 120);
});

canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); stop(); });
canvas.addEventListener('webglcontextrestored', () => start());

onScroll();
curPos.copy(goalPos);
curLook.copy(goalLook);
start();

})().catch((err) => {
  console.error('[umbral] La escena 3D no pudo iniciarse:', err);
  document.body.classList.add('no-webgl');
  window.dispatchEvent(new CustomEvent('umbral:ready'));
});
