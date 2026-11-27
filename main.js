/* =========================================================
   BMW M4 — main.js
   Three.js procedural G82 · GSAP ScrollTrigger choreography
   Local-only configurator / enquiry flow
   ========================================================= */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const { gsap, ScrollTrigger } = window;
gsap.registerPlugin(ScrollTrigger);

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

const mqMobile  = window.matchMedia('(max-width: 860px)');
const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

const isMobile  = () => mqMobile.matches;
const REDUCED   = mqReduced.matches;

const fmtINR = n => '₹' + Math.round(n).toLocaleString('en-IN');

function toast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------------------------------------------------------
   DATA
   --------------------------------------------------------- */
const PAINTS = [
  { id: 'alpine', name: 'Alpine White',      hex: '#f2f4f7' },
  { id: 'yellow', name: 'Sao Paulo Yellow',  hex: '#f5c518' },
  { id: 'green',  name: 'Isle of Man Green', hex: '#1e4b36' },
  { id: 'red',    name: 'Toronto Red',       hex: '#9d1220' },
  { id: 'grey',   name: 'Brooklyn Grey',     hex: '#6d747c' }
];

const MODELS = [
  {
    id: 'm4',
    name: 'BMW M4 Competition',
    tag: 'G82 · Coupé',
    price: 15300000,
    specs: [
      ['Engine', '3.0L I6 Twin-Turbo'],
      ['Power', '510 hp'],
      ['0–100 km/h', '3.5 s'],
      ['Drive', 'M xDrive AWD']
    ],
    variants: [
      { name: 'Competition', add: 0 },
      { name: 'Competition xDrive', add: 450000 }
    ],
    colours: ['alpine', 'yellow', 'green', 'red', 'grey']
  },
  {
    id: 'm3',
    name: 'BMW M3 Competition',
    tag: 'G80 · Sedan',
    price: 15000000,
    specs: [
      ['Engine', '3.0L I6 Twin-Turbo'],
      ['Power', '510 hp'],
      ['0–100 km/h', '3.9 s'],
      ['Drive', 'RWD']
    ],
    variants: [
      { name: 'Competition', add: 0 },
      { name: 'Competition xDrive', add: 400000 }
    ],
    colours: ['alpine', 'green', 'red', 'grey']
  },
  {
    id: 'x5',
    name: 'BMW X5 xDrive40i',
    tag: 'G05 · SAV',
    price: 10000000,
    specs: [
      ['Engine', '3.0L I6 Turbo'],
      ['Power', '381 hp'],
      ['0–100 km/h', '5.3 s'],
      ['Drive', 'xDrive AWD']
    ],
    variants: [
      { name: 'xLine', add: 0 },
      { name: 'M Sport', add: 600000 }
    ],
    colours: ['alpine', 'grey', 'green']
  },
  {
    id: 'i4',
    name: 'BMW i4 eDrive40',
    tag: 'G26 · Gran Coupé',
    price: 7750000,
    specs: [
      ['Powertrain', 'Electric · 83.9 kWh'],
      ['Power', '340 hp'],
      ['0–100 km/h', '5.7 s'],
      ['Range', '590 km (WLTP)']
    ],
    variants: [
      { name: 'eDrive40', add: 0 },
      { name: 'eDrive40 M Sport', add: 500000 }
    ],
    colours: ['alpine', 'grey', 'red']
  },
  {
    id: '330i',
    name: 'BMW 330i M Sport',
    tag: 'G20 · Sedan',
    price: 6800000,
    specs: [
      ['Engine', '2.0L I4 Turbo'],
      ['Power', '258 hp'],
      ['0–100 km/h', '5.8 s'],
      ['Drive', 'RWD']
    ],
    variants: [
      { name: 'M Sport', add: 0 },
      { name: 'M Sport Pro', add: 350000 }
    ],
    colours: ['alpine', 'grey', 'red', 'green']
  }
];

const paintById = id => PAINTS.find(p => p.id === id) || PAINTS[0];

/* ---------------------------------------------------------
   EMI
   --------------------------------------------------------- */
function emiFor(price, add) {
  const loan = (price + add) * 0.85;
  const r = 0.095 / 12;
  const n = 60;
  const pow = Math.pow(1 + r, n);
  return loan * r * pow / (pow - 1);
}

/* ---------------------------------------------------------
   WEBGL SUPPORT CHECK
   --------------------------------------------------------- */
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

/* =========================================================
   3D SCENE
   ========================================================= */
const canvas = $('#scene');
const loaderEl = $('#loader');

let renderer = null;
let scene = null;
let camera = null;
let carGroup = null;
let paintMat = null;
let shadowMesh = null;

const LOW = isMobile();
let renderEnabled = false;
let carInView = false;

/* Camera rig — tweened by GSAP */
const rig = {
  carRotY: 0,
  cam:    new THREE.Vector3(4.60, 2.30, 6.40),
  target: new THREE.Vector3(0.00, 0.62, 0.00)
};

/* ---------------------------------------------------------
   CAR BUILDER
   --------------------------------------------------------- */
function buildCar(low) {
  const g = new THREE.Group();

  const seg = low ? 8 : 20;

  /* ---- Materials ---- */
  paintMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2f4f7,
    metalness: 0.42,
    roughness: 0.26,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.6
  });

  const glossBlack = new THREE.MeshPhysicalMaterial({
    color: 0x0a0c10, metalness: 0.85, roughness: 0.12,
    clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 1.3
  });

  const matteBlack = new THREE.MeshStandardMaterial({
    color: 0x0d1015, metalness: 0.35, roughness: 0.78, envMapIntensity: 0.9
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x060910, metalness: 0.95, roughness: 0.06,
    clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 2.0
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xc9d0d8, metalness: 1.0, roughness: 0.16, envMapIntensity: 1.6
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xb8c0c9, metalness: 1.0, roughness: 0.24, envMapIntensity: 1.5
  });

  const rimDarkMat = new THREE.MeshStandardMaterial({
    color: 0x2a2f36, metalness: 0.9, roughness: 0.35, envMapIntensity: 1.2
  });

  const tyreMat = new THREE.MeshStandardMaterial({
    color: 0x0b0d10, metalness: 0.10, roughness: 0.96, envMapIntensity: 0.5
  });

  const headMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, emissive: 0xbcd6ff, emissiveIntensity: 2.6,
    metalness: 0.25, roughness: 0.12, transparent: true, opacity: 0.97
  });

  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xdce9ff, emissiveIntensity: 3.2, roughness: 0.2
  });

  const laserMat = new THREE.MeshStandardMaterial({
    color: 0x1c69d4, emissive: 0x2f7fff, emissiveIntensity: 2.4, roughness: 0.2
  });

  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x3a0206, emissive: 0xff1a2a, emissiveIntensity: 1.7, roughness: 0.28
  });

  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0x1c69d4, metalness: 0.55, roughness: 0.30,
    emissive: 0x1c69d4, emissiveIntensity: 1.1
  });

  /* ---- Helper: rounded box ---- */
  const rbox = (w, h, d, r, mat, x, y, z) => {
    const mesh = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, low ? 2 : 3, r),
      mat
    );
    mesh.position.set(x, y, z);
    return mesh;
  };

  /* ---- Helper: extrude a side silhouette (shape x = car length z,
         shape y = height) into a body of the given width.
         rotateY(-PI/2) maps shape-x -> world +z (front) and
         extrusion -> world x (width). ---- */
  const extrudeSide = (pts, width, bevelT, bevelS, mat) => {
    const s = new THREE.Shape();
    s.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      if (p.length === 5 && p[4] === 'q') {
        s.quadraticCurveTo(p[0], p[1], p[2], p[3]);
      } else {
        s.lineTo(p[0], p[1]);
      }
    }
    s.closePath();
    const depth = width - bevelT * 2;
    const geo = new THREE.ExtrudeGeometry(s, {
      depth,
      steps: 1,
      bevelEnabled: true,
      bevelThickness: bevelT,
      bevelSize: bevelS,
      bevelSegments: low ? 2 : 4,
      curveSegments: low ? 8 : 16
    });
    geo.translate(0, 0, -depth / 2);
    geo.rotateY(-Math.PI / 2);
    return new THREE.Mesh(geo, mat);
  };

  /* ---------------- BODY — one extruded G82 side silhouette --------
     Long, low coupe: ~4.95 m long, beltline ~1.03 m, nose tapering
     down, short deck at the rear. Flat sides + bevel = sheet-metal
     look instead of a puffy rounded box. --------------------------- */
  g.add(extrudeSide([
    [-2.32, 0.32],
    [-2.46, 0.38, -2.46, 0.62, 'q'],   // rear face, lower
    [-2.46, 0.86, -2.36, 0.94, 'q'],   // rear face, upper / tail edge
    [-2.05, 1.00, -1.70, 1.01, 'q'],   // boot deck
    [-0.55, 1.03],                      // beltline, rear door
    [0.45, 1.03],                       // cowl
    [1.05, 1.00, 1.55, 0.95, 'q'],      // bonnet
    [2.05, 0.90, 2.32, 0.84, 'q'],      // nose top
    [2.45, 0.84, 2.45, 0.64, 'q'],      // nose face, upper
    [2.45, 0.38, 2.32, 0.32, 'q']       // nose face, lower
  ], 1.78, 0.07, 0.04, paintMat));

  /* ---- Lower body / front & rear valances (paint, tucked under) ---- */
  g.add(rbox(1.70, 0.30, 0.34, 0.08, paintMat, 0, 0.52, 2.28));   // front bumper
  g.add(rbox(1.72, 0.30, 0.32, 0.08, paintMat, 0, 0.52, -2.28));  // rear bumper

  /* ---------------- GLASSHOUSE — sloped windscreen + rear window ----
     Narrower than the body (1.40 m vs 1.78 m) so the paint beltline
     and roof rails read as pillars around the glass. ---------------- */
  g.add(extrudeSide([
    [-1.38, 1.00],
    [-1.22, 1.28, -0.95, 1.345, 'q'],  // rear window slope
    [-0.20, 1.375],                    // roof
    [0.28, 1.37, 0.42, 1.30, 'q'],     // roof front
    [0.58, 1.12, 0.72, 1.00, 'q']      // windscreen slope (longer, more raked)
  ], 1.40, 0.05, 0.03, glassMat));

  // Paint roof panel — covers only the middle of the glass roof, so the
  // roof reads body-coloured with glass visible at the sides (side
  // windows) and at the front/rear (windscreen / rear window). A black
  // roof here merged with the glass into one flat black slab.
  const roof = rbox(1.02, 0.035, 1.05, 0.015, paintMat, 0, 1.392, -0.32);
  g.add(roof);

  // B-pillar strips — divide the side glass into front/rear windows
  [-1, 1].forEach(side => {
    g.add(rbox(0.03, 0.32, 0.08, 0.01, paintMat, side * 0.715, 1.19, -0.28));
  });

  /* ---------------- KIDNEY GRILLE — proportionate, not giant -------
     Two vertical kidneys, chrome surround, dark vertical slats.
     Total ~0.84 m wide, 0.48 m tall — centred on the nose. --------- */
  const grilleBarMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c10, metalness: 0.3, roughness: 0.6
  });

  function makeGrille(side) {
    const grp = new THREE.Group();
    // chrome surround (slightly larger, shows as a thin frame)
    grp.add(rbox(0.40, 0.44, 0.05, 0.04, chromeMat, 0, 0, -0.015));
    // black kidney
    grp.add(rbox(0.36, 0.40, 0.08, 0.035, glossBlack, 0, 0, 0.01));
    // vertical slats
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.32, 0.05),
        grilleBarMat
      );
      bar.position.set(-0.12 + i * 0.08, 0, 0.055);
      grp.add(bar);
    }
    grp.position.set(side * 0.215, 0.61, 2.50);
    grp.rotation.x = -0.04;
    return grp;
  }
  g.add(makeGrille(-1), makeGrille(1));
  // centre divider between the kidneys
  g.add(rbox(0.045, 0.42, 0.06, 0.02, paintMat, 0, 0.61, 2.50));

  /* ---------------- FRONT BUMPER INTAKES + SPLITTER ---------------- */
  [-1, 1].forEach(side => {
    const intake = rbox(0.40, 0.15, 0.10, 0.03, matteBlack, side * 0.68, 0.45, 2.40);
    intake.rotation.y = -side * 0.10;
    g.add(intake);
  });
  g.add(rbox(0.76, 0.10, 0.08, 0.03, matteBlack, 0, 0.37, 2.42)); // centre lower intake
  g.add(rbox(1.66, 0.045, 0.22, 0.02, matteBlack, 0, 0.27, 2.30)); // front splitter

  /* ---------------- HEADLIGHTS — slim LED, angel-eye rings --------- */
  function makeHeadlight(side) {
    const grp = new THREE.Group();
    // slim dark housing
    grp.add(rbox(0.50, 0.085, 0.09, 0.03, glossBlack, 0, 0, 0));
    // LED strip (bright, at the front face)
    grp.add(rbox(0.44, 0.032, 0.02, 0.01, headMat, 0, 0.008, 0.05));
    // angel-eye rings
    const ringGeo = new THREE.TorusGeometry(0.036, 0.008, low ? 4 : 8, low ? 10 : 18);
    const r1 = new THREE.Mesh(ringGeo, ringMat);
    r1.position.set(-0.11, 0, 0.058);
    grp.add(r1);
    const r2 = new THREE.Mesh(ringGeo, ringMat);
    r2.position.set(0.11, 0, 0.058);
    grp.add(r2);
    // blue laser accent at the inner end
    grp.add(rbox(0.055, 0.018, 0.015, 0.006, laserMat, -side * 0.19, 0, 0.055));

    grp.position.set(side * 0.60, 0.80, 2.44);
    grp.rotation.y = -side * 0.14;
    grp.rotation.x = -0.03;
    return grp;
  }
  g.add(makeHeadlight(-1), makeHeadlight(1));

  /* ---------------- TAIL LIGHTS — slim L-shaped -------------------- */
  [-1, 1].forEach(side => {
    g.add(rbox(0.46, 0.075, 0.06, 0.025, tailMat, side * 0.57, 0.90, -2.46));
    g.add(rbox(0.07, 0.17, 0.06, 0.025, tailMat, side * 0.815, 0.85, -2.45));
  });

  /* ---------------- MIRRORS — slim, at the A-pillar --------------- */
  [-1, 1].forEach(side => {
    g.add(rbox(0.15, 0.04, 0.05, 0.015, matteBlack, side * 0.88, 1.04, 0.48));
    const housing = rbox(0.15, 0.10, 0.13, 0.04, glossBlack, side * 0.96, 1.07, 0.46);
    g.add(housing);
    g.add(rbox(0.155, 0.03, 0.135, 0.012, glossBlack, side * 0.96, 1.125, 0.46));
  });

  /* ---------------- DOOR HANDLES (flush, chrome) ------------------- */
  [-1, 1].forEach(side => {
    g.add(rbox(0.015, 0.028, 0.17, 0.007, chromeMat, side * 0.895, 0.93, -0.35));
    g.add(rbox(0.015, 0.028, 0.17, 0.007, chromeMat, side * 0.895, 0.93, 0.55));
  });

  /* ---------------- SKIRTS / DIFFUSER / SPOILER -------------------- */
  [-1, 1].forEach(side => {
    g.add(rbox(0.07, 0.10, 2.45, 0.03, matteBlack, side * 0.885, 0.32, 0.0));
  });
  g.add(rbox(1.48, 0.15, 0.20, 0.04, matteBlack, 0, 0.32, -2.36)); // rear diffuser
  const spoiler = rbox(1.30, 0.03, 0.24, 0.012, paintMat, 0, 1.015, -2.16);
  spoiler.rotation.x = 0.06;
  g.add(spoiler);

  /* ---------------- QUAD EXHAUSTS ---------------------------------- */
  [-1, 1].forEach(side => {
    [0, 1].forEach(i => {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.052, 0.052, 0.12, low ? 8 : 14, 1, true),
        chromeMat
      );
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(side * (0.38 + i * 0.17), 0.35, -2.44);
      g.add(pipe);
      const inner = new THREE.Mesh(
        new THREE.CircleGeometry(0.044, low ? 8 : 14),
        matteBlack
      );
      inner.position.set(side * (0.38 + i * 0.17), 0.35, -2.505);
      inner.rotation.y = Math.PI;
      g.add(inner);
    });
  });

  /* ---------------- WHEELS — larger, 10-spoke forged -------------- */
  function makeWheel(outward) {
    const grp = new THREE.Group();
    const R = 0.37;
    const W = 0.27;

    // tyre
    const tyre = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, W, low ? 16 : 28, 1, false),
      tyreMat
    );
    tyre.rotation.z = Math.PI / 2;
    grp.add(tyre);

    // sidewall ring (outer face)
    const sidewall = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.86, 0.018, low ? 4 : 8, low ? 12 : 24),
      rimDarkMat
    );
    sidewall.rotation.y = Math.PI / 2;
    sidewall.position.x = outward * (W / 2 - 0.01);
    grp.add(sidewall);

    // brake disc (bright, visible through spokes)
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.60, R * 0.60, 0.03, low ? 12 : 22),
      new THREE.MeshStandardMaterial({ color: 0x9aa2ac, metalness: 0.9, roughness: 0.38, envMapIntensity: 1.0 })
    );
    disc.rotation.z = Math.PI / 2;
    disc.position.x = outward * 0.075;
    grp.add(disc);

    // rim barrel / face
    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.52, R * 0.52, 0.05, low ? 12 : 24),
      rimDarkMat
    );
    face.rotation.z = Math.PI / 2;
    face.position.x = outward * 0.105;
    grp.add(face);

    // outer rim lip
    const lip = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.72, 0.016, low ? 4 : 8, low ? 12 : 28),
      rimMat
    );
    lip.rotation.y = Math.PI / 2;
    lip.position.x = outward * 0.132;
    grp.add(lip);

    // 5 bars = 10 spokes, wider and brighter than before
    const spokeCount = 5;
    for (let i = 0; i < spokeCount; i++) {
      const sp = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, R * 1.44, 0.085),
        rimMat
      );
      sp.position.x = outward * 0.135;
      sp.rotation.x = (i / spokeCount) * Math.PI * 2;
      grp.add(sp);
    }

    // hub cap
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.05, low ? 8 : 14),
      chromeMat
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.x = outward * 0.15;
    grp.add(hub);

    // blue M caliper (behind the spokes, toward the rear of the car)
    const cal = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.22, 0.14),
      caliperMat
    );
    cal.position.set(outward * 0.115, 0.02, -0.19);
    grp.add(cal);

    return grp;
  }

  const wheelPositions = [
    [ 0.84, 0.37,  1.43,  1],
    [-0.84, 0.37,  1.43, -1],
    [ 0.84, 0.37, -1.43,  1],
    [-0.84, 0.37, -1.43, -1]
  ];

  wheelPositions.forEach(([x, y, z, out]) => {
    const w = makeWheel(out);
    w.position.set(x, y, z);
    g.add(w);

    // dark wheel-arch trim — upper half only, hugging the body side
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(0.425, 0.028, low ? 4 : 8, low ? 12 : 24, Math.PI),
      matteBlack
    );
    arch.rotation.y = Math.PI / 2;
    arch.position.set(x * 1.06, y, z);
    g.add(arch);
  });

  return g;
}

/* ---------------------------------------------------------
   FAKE CONTACT SHADOW
   --------------------------------------------------------- */
function makeShadowPlane() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
  grad.addColorStop(0.00, 'rgba(0,0,0,0.90)');
  grad.addColorStop(0.42, 'rgba(0,0,0,0.46)');
  grad.addColorStop(1.00, 'rgba(0,0,0,0.00)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.9
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 2.9), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.004;
  return mesh;
}

/* ---------------------------------------------------------
   INIT 3D
   --------------------------------------------------------- */
function initThree() {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile(),
    alpha: true,
    powerPreference: 'high-performance'
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    38,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );

  /* ---- Studio environment (reflections) ---- */
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const envScene = new RoomEnvironment();
    const envRT = pmrem.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();
    envScene.traverse(o => {
      if (o.isMesh) {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
          else o.material.dispose();
        }
      }
    });
  } catch (err) {
    console.warn('Environment map unavailable:', err);
  }

  /* ---- Cinematic studio lights ---- */
  const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x070a10, 0.60);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.3);
  key.position.set(5.5, 9.0, 6.0);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9cc2ff, 0.90);
  fill.position.set(-6.5, 4.0, -3.5);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 1.6);
  rim.position.set(0.0, 3.5, -8.5);
  scene.add(rim);

  const top = new THREE.DirectionalLight(0xffffff, 1.15);
  top.position.set(0.0, 11.0, 0.5);
  scene.add(top);

  /* ---- The car ---- */
  carGroup = buildCar(isMobile());
  scene.add(carGroup);

  /* ---- Contact shadow ---- */
  shadowMesh = makeShadowPlane();
  scene.add(shadowMesh);

  applyViewOffset();
  startLoop();
}

/* ---------------------------------------------------------
   CAMERA VIEW OFFSET (subject placement in frame)
   --------------------------------------------------------- */
function applyViewOffset() {
  if (!camera) return;
  const w = window.innerWidth;
  const h = window.innerHeight;

  const sx = isMobile() ? 0 : -0.13;
  const sy = isMobile() ? 0.075 : 0;

  if (Math.abs(sx) < 0.001 && Math.abs(sy) < 0.001) {
    camera.clearViewOffset();
  } else {
    camera.setViewOffset(w, h, sx * w, sy * h, w, h);
  }
}

/* ---------------------------------------------------------
   RENDER LOOP
   --------------------------------------------------------- */
let rafId = 0;

function startLoop() {
  const tick = () => {
    rafId = requestAnimationFrame(tick);

    if (!renderer || !scene || !camera) return;

    if (carGroup) {
      carGroup.rotation.y = rig.carRotY;

      const zf = isMobile() ? 1.24 : 1.0;
      const yb = isMobile() ? 0.14 : 0.0;

      camera.position.set(
        rig.cam.x * zf,
        rig.cam.y + yb,
        rig.cam.z * zf
      );
      camera.lookAt(rig.target.x, rig.target.y, rig.target.z);
    }

    if (carInView) renderer.render(scene, camera);
  };
  tick();
}

/* ---------------------------------------------------------
   RESIZE
   --------------------------------------------------------- */
let resizeTimer = 0;

function onResize() {
  if (renderer && camera) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2));
    renderer.setSize(w, h, false);
    applyViewOffset();
  }
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 180);
}
window.addEventListener('resize', onResize, { passive: true });
window.addEventListener('orientationchange', onResize, { passive: true });

/* =========================================================
   SCROLL CHOREOGRAPHY
   ========================================================= */
function initScrollChoreography() {
  /* ---------- HERO : 360° orbit + camera drift ---------- */
  if (!REDUCED) {
    const heroTl = gsap.timeline({
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
        invalidateOnRefresh: true
      }
    });

    heroTl.to(rig, {
      carRotY: Math.PI * 2,
      ease: 'none',
      duration: 1
    }, 0);

    heroTl.to(rig.cam, {
      x: 2.40, y: 2.05, z: 8.30,
      ease: 'none',
      duration: 1
    }, 0);

    heroTl.to('#heroCopy', {
      autoAlpha: 0, y: -55,
      ease: 'power2.in',
      duration: 0.30
    }, 0.60);

    heroTl.to('#heroMeta', {
      autoAlpha: 0, y: 45,
      ease: 'power2.in',
      duration: 0.30
    }, 0.60);

    heroTl.to('.scroll-hint', { autoAlpha: 0, duration: 0.08 }, 0.03);
  }

  /* ---------- DESIGN : three macro shots ---------- */
  const stepEls = $$('.design-step');

  if (REDUCED) {
    stepEls.forEach((el, i) => {
      gsap.set(el, { autoAlpha: i === 0 ? 1 : 0 });
    });
    rig.carRotY = 0.55;
    rig.cam.set(4.2, 2.0, 6.0);
    rig.target.set(0, 0.62, 0);
  } else if (stepEls.length === 3) {
    gsap.set(stepEls, { autoAlpha: 0, y: 34 });

    const dTl = gsap.timeline({
      scrollTrigger: {
        trigger: '#design',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.55,
        invalidateOnRefresh: true
      }
    });

    /* — Shot 1 : kidney grille — */
    dTl.to(stepEls[0], { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out' }, 0)
       .to(rig.cam,    { x: 0.95, y: 0.98, z: 3.25, duration: 0.62, ease: 'power2.inOut' }, 0)
       .to(rig.target, { x: 0.00, y: 0.68, z: 2.42, duration: 0.62, ease: 'power2.inOut' }, 0)
       .to({}, { duration: 0.50 });

    /* — Shot 2 : headlights — */
    dTl.to(stepEls[0], { autoAlpha: 0, y: -34, duration: 0.20, ease: 'power2.in' }, '+=0.02')
       .to(stepEls[1], { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out' }, '<')
       .to(rig.cam,    { x: 1.35, y: 1.24, z: 2.86, duration: 0.62, ease: 'power2.inOut' }, '<')
       .to(rig.target, { x: 0.58, y: 0.98, z: 2.26, duration: 0.62, ease: 'power2.inOut' }, '<')
       .to({}, { duration: 0.50 });

    /* — Shot 3 : forged wheel — */
    dTl.to(stepEls[1], { autoAlpha: 0, y: -34, duration: 0.20, ease: 'power2.in' }, '+=0.02')
       .to(stepEls[2], { autoAlpha: 1, y: 0, duration: 0.22, ease: 'power2.out' }, '<')
       .to(rig.cam,    { x: 2.22, y: 0.74, z: 1.92, duration: 0.62, ease: 'power2.inOut' }, '<')
       .to(rig.target, { x: 0.86, y: 0.36, z: 1.42, duration: 0.62, ease: 'power2.inOut' }, '<')
       .to({}, { duration: 0.55 });
  }

  /* ---------- COLOURS : pull back to a hero 3/4 ---------- */
  if (!REDUCED) {
    gsap.timeline({
      scrollTrigger: {
        trigger: '#colours',
        start: 'top 88%',
        end: 'top 22%',
        scrub: 0.6,
        invalidateOnRefresh: true
      }
    })
    .to(rig.cam,    { x: 4.05, y: 1.80, z: 6.05, ease: 'power2.inOut', duration: 1 }, 0)
    .to(rig.target, { x: 0.00, y: 0.64, z: 0.00, ease: 'power2.inOut', duration: 1 }, 0);
  }

  /* ---------- NAV state ---------- */
  ScrollTrigger.create({
    start: 'top -40',
    end: 99999,
    onUpdate: self => {
      $('#nav').classList.toggle('scrolled', self.scroll() > 40);
    }
  });

  /* ---------- Counters ---------- */
  $$('.stat-num').forEach(el => {
    const target = parseFloat(el.dataset.value || '0');
    const dec = parseInt(el.dataset.dec || '0', 10);

    if (REDUCED) {
      el.textContent = target.toFixed(dec);
      return;
    }

    const obj = { v: 0 };

    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => {
        gsap.to(obj, {
          v: target,
          duration: 1.7,
          ease: 'power3.out',
          onUpdate: () => { el.textContent = obj.v.toFixed(dec); }
        });
      }
    });
  });
}

/* =========================================================
   CAR VISIBILITY (render optimisation)
   ========================================================= */
function initVisibilityObserver() {
  const sections = ['#hero', '#design', '#colours']
    .map(s => document.querySelector(s))
    .filter(Boolean);

  if (!sections.length || !('IntersectionObserver' in window)) {
    carInView = true;
    return;
  }

  const state = new Map();

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => state.set(e.target, e.isIntersecting));
    carInView = sections.some(el => state.get(el) === true);
  }, { rootMargin: '12% 0px 12% 0px', threshold: 0 });

  sections.forEach(el => io.observe(el));
}

/* =========================================================
   COLOUR SWATCHES (3D repaint)
   ========================================================= */
function initColourSwatches() {
  const wrap = $('#colourSwatches');
  const label = $('#colourActive');
  if (!wrap) return;

  wrap.innerHTML = PAINTS.map((p, i) => `
    <button
      type="button"
      class="swatch${i === 0 ? ' is-active' : ''}"
      style="--sw:${p.hex}"
      data-paint="${p.id}"
      aria-label="${p.name}"
      title="${p.name}"
    ></button>
  `).join('');

  wrap.addEventListener('click', e => {
    const btn = e.target.closest('.swatch');
    if (!btn) return;

    $$('.swatch', wrap).forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');

    const paint = paintById(btn.dataset.paint);
    if (label) label.textContent = paint.name;

    if (paintMat) {
      const col = new THREE.Color(paint.hex);
      gsap.to(paintMat.color, {
        r: col.r, g: col.g, b: col.b,
        duration: 0.75,
        ease: 'power2.out'
      });
    }
  });
}

/* =========================================================
   MODELS / PURCHASE
   ========================================================= */
const store = {
  key: 'bmw_m4_enquiries_v1',
  read() {
    try {
      const raw = localStorage.getItem(this.key);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  },
  write(list) {
    try { localStorage.setItem(this.key, JSON.stringify(list)); }
    catch (e) { console.warn('Storage unavailable', e); }
  },
  add(entry) {
    const list = this.read();
    list.push(entry);
    this.write(list);
    return entry;
  }
};

function buildModels() {
  const grid = $('#modelsGrid');
  if (!grid) return;

  grid.innerHTML = MODELS.map(m => {
    const firstPaint = paintById(m.colours[0]);

    return `
    <article class="model-card glass" data-id="${m.id}">
      <div class="mc-top">
        <span class="mc-tag">${m.tag}</span>
        <h3>${m.name}</h3>
        <div class="mc-price">
          <em>INDICATIVE</em>
          <b data-price>${fmtINR(m.price)}</b>
          <span>ex-showroom India</span>
        </div>
      </div>

      <ul class="mc-specs">
        ${m.specs.map(s => `<li><span>${s[0]}</span><b>${s[1]}</b></li>`).join('')}
      </ul>

      <div class="mc-config">
        <div class="mc-row">
          <label>Exterior colour</label>
          <div class="mc-swatches" data-swatches>
            ${m.colours.map((cid, i) => {
              const p = paintById(cid);
              return `<button
                        type="button"
                        class="swatch${i === 0 ? ' is-active' : ''}"
                        style="--sw:${p.hex}"
                        data-paint="${cid}"
                        aria-label="${p.name}"
                        title="${p.name}"></button>`;
            }).join('')}
          </div>
        </div>

        <div class="mc-row">
          <label>Variant</label>
          <div class="mc-variants" data-variants>
            ${m.variants.map((v, i) => `
              <button type="button"
                      class="chip${i === 0 ? ' is-active' : ''}"
                      data-variant="${i}"
                      data-add="${v.add}">${v.name}</button>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="mc-emi">
        <div>
          <span>EMI from</span>
          <b data-emi>—</b>
        </div>
        <em>60 months · 9.5% p.a.<br>15% down payment</em>
      </div>

      <div class="mc-actions">
        <button type="button" class="btn btn-primary" data-reserve>
          Reserve / Book Test Drive
        </button>
        <button type="button" class="btn btn-ghost" data-save>
          Save configuration
        </button>
      </div>
    </article>
    `;
  }).join('');

  /* Per-card state */
  const state = new Map();
  MODELS.forEach(m => state.set(m.id, {
    paintId: m.colours[0],
    variantIndex: 0
  }));

  const updateCard = (card) => {
    const id = card.dataset.id;
    const m = MODELS.find(x => x.id === id);
    const s = state.get(id);
    if (!m || !s) return;

    const add = m.variants[s.variantIndex].add;
    const total = m.price + add;

    const priceEl = $('[data-price]', card);
    const emiEl = $('[data-emi]', card);

    if (priceEl) priceEl.textContent = fmtINR(total);
    if (emiEl) emiEl.textContent = fmtINR(emiFor(m.price, add)) + '/mo';
  };

  grid.addEventListener('click', e => {
    const card = e.target.closest('.model-card');
    if (!card) return;

    const id = card.dataset.id;
    const m = MODELS.find(x => x.id === id);
    const s = state.get(id);
    if (!m || !s) return;

    /* --- colour --- */
    const sw = e.target.closest('[data-swatches] .swatch');
    if (sw) {
      $$('[data-swatches] .swatch', card).forEach(b => b.classList.remove('is-active'));
      sw.classList.add('is-active');
      s.paintId = sw.dataset.paint;
      updateCard(card);
      return;
    }

    /* --- variant --- */
    const chip = e.target.closest('[data-variants] .chip');
    if (chip) {
      $$('[data-variants] .chip', card).forEach(b => b.classList.remove('is-active'));
      chip.classList.add('is-active');
      s.variantIndex = parseInt(chip.dataset.variant, 10) || 0;
      updateCard(card);
      return;
    }

    /* --- reserve --- */
    if (e.target.closest('[data-reserve]')) {
      openReserveModal(m, s);
      return;
    }

    /* --- save config --- */
    if (e.target.closest('[data-save]')) {
      const paint = paintById(s.paintId);
      const variant = m.variants[s.variantIndex];
      const total = m.price + variant.add;

      store.add({
        kind: 'config',
        modelId: m.id,
        model: m.name,
        paint: paint.name,
        variant: variant.name,
        total,
        emi: Math.round(emiFor(m.price, variant.add)),
        at: new Date().toISOString()
      });

      toast(`${m.name} · ${paint.name} saved to this browser`);
    }
  });

  /* initial EMI fill */
  $$('.model-card', grid).forEach(updateCard);
}

/* =========================================================
   MODAL / RESERVE FORM
   ========================================================= */
const modal = $('#modal');
const modalBody = $('#modalBody');
let lastFocused = null;

const CITIES = [
  'Mumbai', 'Delhi NCR', 'Bengaluru', 'Hyderabad', 'Chennai',
  'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Kochi', 'Chandigarh'
];

function openModal(html) {
  lastFocused = document.activeElement;
  modalBody.innerHTML = html;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  const firstInput = modalBody.querySelector('input, select, button');
  if (firstInput) setTimeout(() => firstInput.focus(), 80);
}

function closeModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (lastFocused && lastFocused.focus) lastFocused.focus();
}

function openReserveModal(model, state) {
  const paint = paintById(state.paintId);
  const variant = model.variants[state.variantIndex];
  const total = model.price + variant.add;

  const today = new Date();
  const iso = today.toISOString().split('T')[0];

  const html = `
    <div class="modal-head">
      <span class="eyebrow"><i class="dot"></i> Reserve / Test Drive</span>
      <h3>${model.name}</h3>
      <p class="modal-sub">${variant.name} · ${paint.name}</p>
    </div>

    <form class="modal-form" id="reserveForm" novalidate>
      <div class="field">
        <label for="f-name">Full name</label>
        <input id="f-name" name="name" type="text" autocomplete="name"
               placeholder="Your full name" maxlength="60" required>
        <span class="err"></span>
      </div>

      <div class="field">
        <label for="f-phone">Mobile number</label>
        <input id="f-phone" name="phone" type="tel" inputmode="numeric"
               autocomplete="tel" placeholder="10-digit mobile"
               maxlength="10" required>
        <span class="err"></span>
      </div>

      <div class="field">
        <label for="f-city">City</label>
        <select id="f-city" name="city" required>
          <option value="">Select city</option>
          ${CITIES.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <span class="err"></span>
      </div>

      <div class="field">
        <label for="f-date">Preferred date</label>
        <input id="f-date" name="date" type="date" min="${iso}" required>
        <span class="err"></span>
      </div>

      <div class="field field-full">
        <label for="f-notes">Notes (optional)</label>
        <textarea id="f-notes" name="notes" rows="2"
                  placeholder="Anything we should know?"></textarea>
        <span class="err"></span>
      </div>

      <div class="modal-summary">
        <span>Model: <b>${model.name}</b></span>
        <span>Variant: <b>${variant.name}</b></span>
        <span>Colour: <b>${paint.name}</b></span>
        <span>Indicative total: <b>${fmtINR(total)}</b></span>
        <span>EMI est.: <b>${fmtINR(emiFor(model.price, variant.add))}/mo</b></span>
      </div>

      <div class="modal-actions">
        <button type="submit" class="btn btn-primary">Confirm request</button>
        <button type="button" class="btn btn-ghost" data-close>Cancel</button>
      </div>

      <p class="modal-fine">
        No payment is taken. Your details are stored only in this browser and never leave your device.
      </p>
    </form>
  `;

  openModal(html);

  const form = $('#reserveForm');
  if (!form) return;

  /* numeric phone filter */
  const phone = $('#f-phone', form);
  phone.addEventListener('input', () => {
    phone.value = phone.value.replace(/\D/g, '').slice(0, 10);
  });

  form.addEventListener('submit', ev => {
    ev.preventDefault();
    if (!validateReserveForm(form)) return;

    const data = new FormData(form);
    const ref = 'BMW-' + Math.random().toString(36).slice(2, 8).toUpperCase();

    const entry = {
      kind: 'reserve',
      ref,
      modelId: model.id,
      model: model.name,
      variant: variant.name,
      paint: paint.name,
      total,
      emi: Math.round(emiFor(model.price, variant.add)),
      name: String(data.get('name') || '').trim(),
      phone: String(data.get('phone') || '').trim(),
      city: String(data.get('city') || '').trim(),
      date: String(data.get('date') || '').trim(),
      notes: String(data.get('notes') || '').trim(),
      at: new Date().toISOString()
    };

    store.add(entry);

    modalBody.innerHTML = `
      <div class="modal-success">
        <div class="check">✓</div>
        <h3>Request received</h3>
        <p>
          We've noted your interest in the <b>${model.name}</b> — ${variant.name}
          in <b>${paint.name}</b>. A BMW Genius will call you on
          <b>+91 ${entry.phone}</b> to confirm your ${entry.city} appointment.
        </p>
        <p class="ref">Reference ${ref}</p>
        <button type="button" class="btn btn-primary" data-close>Done</button>
      </div>
    `;
  });
}

function validateReserveForm(form) {
  let ok = true;

  const setErr = (input, msg) => {
    const field = input.closest('.field');
    const err = field ? field.querySelector('.err') : null;
    if (msg) {
      ok = false;
      if (field) field.classList.add('invalid');
      if (err) err.textContent = msg;
    } else {
      if (field) field.classList.remove('invalid');
      if (err) err.textContent = '';
    }
  };

  const name = form.querySelector('#f-name');
  const phone = form.querySelector('#f-phone');
  const city = form.querySelector('#f-city');
  const date = form.querySelector('#f-date');

  setErr(name, name.value.trim().length >= 2 ? '' : 'Please enter your name');
  setErr(phone, /^\d{10}$/.test(phone.value.trim()) ? '' : 'Enter a valid 10-digit number');
  setErr(city, city.value ? '' : 'Select your city');
  setErr(date, date.value ? '' : 'Choose a preferred date');

  return ok;
}

/* modal close wiring */
modal.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
});

/* =========================================================
   BOOT
   ========================================================= */
function hideLoader() {
  const el = document.getElementById('loader') || loaderEl;
  if (!el) return;
  el.classList.add('hidden');
  el.style.pointerEvents = 'none';
  setTimeout(() => {
    const cur = document.getElementById('loader');
    if (cur && cur.parentNode) cur.parentNode.removeChild(cur);
    else if (el.parentNode) el.parentNode.removeChild(el);
  }, 650);
}

function init() {
  window.__bmwBooted = true;
  /* footer year */
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* models + UI (works with or without WebGL) */
  buildModels();
  initColourSwatches();
  initScrollChoreography();
  initVisibilityObserver();

  /* Loader out FIRST, before the heavy 3D init. initThree() does
     synchronous PMREM/environment work that can block the main thread
     for seconds on a slow/software GPU — scheduling hideLoader after
     it meant the loader stayed in the DOM ~14s in headless tests
     (hidden at ~14s, removed at ~19s) instead of ~1s. */
  setTimeout(hideLoader, 420);

  /* 3D — deferred until after the loader is gone, so the splash
     never waits on shader/env compilation. */
  setTimeout(() => {
    if (webglAvailable()) {
      try {
        initThree();
        document.body.classList.remove('no-webgl');
      } catch (err) {
        console.error('3D initialisation failed:', err);
        document.body.classList.add('no-webgl');
        const fb = $('#webglFallback');
        if (fb) fb.classList.add('show');
      }
    } else {
      document.body.classList.add('no-webgl');
      const fb = $('#webglFallback');
      if (fb) fb.classList.add('show');
      carInView = false;
    }
  }, 1150);

  /* Hero copy must be fully bright at scroll 0. The old gsap.from()
     entrance fought the hero ScrollTrigger fade-out timeline and left
     #heroCopy / #heroMeta dim. Set them bright; the scroll timeline
     still fades them out on scroll. */
  gsap.set(['.hero-copy > *', '#heroCopy', '#heroMeta'], { autoAlpha: 1, y: 0 });
  gsap.set(['.hero-copy > *', '#heroCopy', '#heroMeta'], { clearProps: 'transform,opacity,visibility' });
  gsap.set(['#heroCopy', '#heroMeta'], { autoAlpha: 1 });

  /* refresh after fonts settle */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}

/* cleanup on unload */
window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(rafId);
  if (renderer) renderer.dispose();
}); 