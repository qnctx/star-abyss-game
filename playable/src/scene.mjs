import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WORLD, POINTS, WALLS, GATE, ROCK_FIELD, TERRAIN_SEGMENTS, terrainHeight, insideWreck } from './layout.mjs';
import { resolveCamera } from './camera.mjs';
import { createAvatar } from './avatar.mjs';
import {createPulseEffects} from './expedition-runtime/effects.mjs';
import {createSkillVisual} from './combat-skills/visual.mjs';
import {createInstructor} from './combat-skills/instructor.mjs';
import {pulsePhase} from './combat-pose.mjs';
import { createSkimmer } from './vehicle-model.mjs';
import {applyMountedVehicleView} from './vehicle-rig.mjs';
import { createMeteorDetails } from './meteor-scene.mjs';
import { createSurveyScene } from './survey-scene.mjs';
import { dustCoverage } from './ground-cover.mjs';
import { phase1Surface } from './phase1-terrain.mjs';
import { enhanceTerrainMaterial } from './phase1-geology.mjs';
import { createScanEffect } from './scan-effect.mjs';
import { createDashEffect } from './dash-effect.mjs';
import {createYuanYingFlightVfx} from './yuan-ying-flight-vfx.mjs';
import {createAscensionEffects} from './ascension-effects.mjs';
import {createAerialSparringVisual} from './aerial-sparring-visual.mjs';
import { createEquipmentViewmodel } from './equipment-viewmodel.mjs';
import { createRenderBudget, sampleRenderBudget, recordRenderWork } from './render-budget.mjs';
import { createDynamicShadowScheduler } from './dynamic-shadow-scheduler.mjs';
import { createRockRenderChunks } from './rock-render-chunks.mjs';
import { createTerrainRenderChunks } from './terrain-render-chunks.mjs';

// Geometry is expressed in world metres. The image of a ship is never used as a backdrop.
export function createScene(canvas) {
  // Use an explicitly opaque buffer for this opaque scene and request the
  // browser's low-latency presentation path; unsupported browsers may ignore it.
  const context = canvas.getContext('webgl2', { alpha:false, depth:true, stencil:false,
    antialias:true, premultipliedAlpha:true, preserveDrawingBuffer:false,
    powerPreference:'high-performance', desynchronized:true });
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, powerPreference: 'high-performance' });
  const renderBudget=createRenderBudget(window.devicePixelRatio||1);
  renderer.setPixelRatio(renderBudget.ratio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#171123');
  scene.fog = new THREE.FogExp2('#302638', .00032);
  const camera = new THREE.PerspectiveCamera(72, 1, .08, 11000);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  const lightSources = [];
  let seed = 18041;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const materials = [], signTextures = [];
  const material = (color, roughness = .75, metalness = .4, extra = {}) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    materials.push(result); return result;
  };
  const hull = material('#68717c', .81, .42);
  const darkHull = material('#33414d', .85, .40);
  const edge = material('#89909a', .72, .45);
  const inner = material('#64757d', .9, .28);
  const dark = material('#070d12', .88, .35);
  const rust = material('#56453e', .94, .45);
  const glass = material('#032c34', .3, .6, { emissive: '#0b7685', emissiveIntensity: .75 });
  const cyan = material('#68e4ea', .3, .35, { emissive: '#24c7dd', emissiveIntensity: 2.6 });
  const amber = material('#f3af54', .4, .25, { emissive: '#eb7330', emissiveIntensity: 2.3 });
  const muted = material('#728e9b', .55, .55);
  const crimson = material('#993c32', .5, .25, { emissive: '#bb301b', emissiveIntensity: 1.6 });
  const panelCanvas = document.createElement('canvas'); panelCanvas.width = panelCanvas.height = 512;
  const panelContext = panelCanvas.getContext('2d');
  panelContext.fillStyle = '#d0d0d0'; panelContext.fillRect(0, 0, 512, 512);
  panelContext.strokeStyle = '#888888'; panelContext.lineWidth = 4; panelContext.strokeRect(4, 4, 504, 504);
  panelContext.strokeStyle = '#ededed'; panelContext.lineWidth = 1; panelContext.strokeRect(8, 8, 496, 496);
  for (const x of [18, 494]) for (const y of [18, 494]) { panelContext.fillStyle = '#606060'; panelContext.beginPath(); panelContext.arc(x, y, 3, 0, Math.PI * 2); panelContext.fill(); }
  for (let i = 0; i < 800; i++) {
    const shade = 160 + Math.floor(random() * 80); panelContext.strokeStyle = `rgb(${shade},${shade},${shade})`; panelContext.lineWidth = .3 + random();
    const x = random() * 512, y = random() * 512; panelContext.beginPath(); panelContext.moveTo(x, y); panelContext.lineTo(x + random() * 14, y + random() * 3); panelContext.stroke();
  }
  const panelTexture = new THREE.CanvasTexture(panelCanvas); panelTexture.colorSpace = THREE.SRGBColorSpace;
  panelTexture.wrapS = panelTexture.wrapT = THREE.RepeatWrapping; panelTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  for (const mat of [hull, darkHull, inner, rust]) { mat.map = panelTexture; mat.bumpMap = panelTexture; mat.bumpScale = .018; }
  const mesh = (geometry, mat, x, y, z, parent = scene, shadow = true) => {
    const item = new THREE.Mesh(geometry, mat); item.position.set(x, y, z);
    item.castShadow = shadow; item.receiveShadow = true; parent.add(item); return item;
  };
  const box = (w, h, d, mat, x, y, z, parent = scene, shadow = true) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    if (mat.map === panelTexture) {
      const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        const side = Math.abs(n.getX(i)) > .5, top = Math.abs(n.getY(i)) > .5;
        uv.setXY(i, (side ? p.getZ(i) : p.getX(i)) / 4, (top ? p.getZ(i) : p.getY(i)) / 4);
      }
    }
    return mesh(geometry, mat, x, y, z, parent, shadow);
  };
  const cylinder = (rt, rb, h, mat, x, y, z, parent = scene, segments = 12) => mesh(new THREE.CylinderGeometry(rt, rb, h, segments), mat, x, y, z, parent);
  const ring = (radius, thickness, mat, x, y, z, parent = scene) => mesh(new THREE.TorusGeometry(radius, thickness, 7, 48), mat, x, y, z, parent);

  scene.add(new THREE.HemisphereLight('#b3b6e5', '#312a32', 1.3));
  const moon = new THREE.DirectionalLight('#ecccd2', 2.1);
  moon.position.set(-280, 540, 100); moon.target.position.set(0, 0, -540);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -240, right: 240, top: 360, bottom: -360, near: 10, far: 1300 });
  moon.shadow.bias = -.00025; moon.shadow.normalBias = .2;
  scene.add(moon, moon.target);

  // A procedural celestial vault; it has no ground or unreachable photo landmarks.
  const skyMaterial = new THREE.ShaderMaterial({
    uniforms:{orbitalMix:{value:0}},
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDirection;
      void main(){ vDirection=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vDirection; uniform float orbitalMix;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 p){float n=0.;float a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=p*2.07+vec3(13.2,4.1,8.2);a*=.5;}return n;}
      void main(){vec3 d=normalize(vDirection);float h=mix(max(d.y,0.),.82,orbitalMix);
        vec3 col=mix(vec3(.25,.14,.20),vec3(.018,.024,.069),pow(h,.38));
        float band=pow(max(0.,1.-abs(d.y*.85+d.x*.31-.39)*2.8),3.);
        float cloud=fbm(d*7.);float detail=fbm(d*24.);
        col+=band*pow(cloud,2.)*vec3(.42,.12,.35);
        col+=band*pow(detail,4.)*vec3(.32,.25,.56);
        float star=pow(hash(floor(d*1800.)),1700.)*mix(smoothstep(.03,.22,d.y),1.,orbitalMix);
        col+=star*vec3(.75,.83,1.);gl_FragColor=vec4(col,1.);}`
  });
  const sky = mesh(new THREE.SphereGeometry(8900, 40, 24), skyMaterial, 0, 0, 0, scene, false);
  sky.renderOrder = -10; sky.frustumCulled = false;
  const planetMaterial = material('#6a486f', 1, 0, { emissive: '#25192c', emissiveIntensity: .25, fog: false });
  const planetCanvas = document.createElement('canvas'); planetCanvas.width = 1024; planetCanvas.height = 512;
  const planetContext = planetCanvas.getContext('2d'), planetPixels = planetContext.createImageData(1024, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 1024; x++) {
    const latitude = (y / 512 - .5) * Math.PI, longitude = x / 1024 * Math.PI * 2;
    const swirl = Math.sin(longitude * 3 + Math.cos(latitude * 6)) + Math.sin(longitude * 7 - latitude * 13) * .35;
    const cloud = Math.sin(latitude * 37 + swirl * 1.1) * .19 + Math.sin(longitude * 23 + latitude * 31) * .025 + .65;
    const index = (y * 1024 + x) * 4;
    planetPixels.data[index] = 150 + cloud * 70; planetPixels.data[index + 1] = 140 + cloud * 50; planetPixels.data[index + 2] = 170 + cloud * 60; planetPixels.data[index + 3] = 255;
  }
  planetContext.putImageData(planetPixels, 0, 0);
  const planetTexture = new THREE.CanvasTexture(planetCanvas); planetTexture.colorSpace = THREE.SRGBColorSpace; planetMaterial.map = planetTexture;
  const planet = mesh(new THREE.SphereGeometry(820, 64, 40), planetMaterial, 2150, 2130, -6400, scene, false);
  planet.rotation.z = .4;
  const ringGroup = new THREE.Group(); ringGroup.position.copy(planet.position); ringGroup.rotation.set(.9, .12, -.38); scene.add(ringGroup);
  for (let i = 0; i < 8; i++) {
    const m = new THREE.MeshBasicMaterial({ color: i % 2 ? '#be9397' : '#775b83', side: THREE.DoubleSide, transparent: true, opacity: .17 + (i % 3) * .1, depthWrite: false, fog: false });
    materials.push(m);
    const r = mesh(new THREE.RingGeometry(1150 + i * 62, 1184 + i * 62, 160), m, 0, 0, 0, ringGroup, false); r.rotation.x = Math.PI / 2;
  }
  const starGeometry = new THREE.BufferGeometry();
  const starVertices = [];
  for (let i = 0; i < 1600; i++) { const a = random() * Math.PI * 2, y = .04 + random() * .94, r = Math.sqrt(1 - y * y); starVertices.push(Math.cos(a) * r * 7900, y * 7900, Math.sin(a) * r * 7900); }
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#d6dbff', size: 3.2, sizeAttenuation: true, transparent: true, opacity: .8, fog: false })); scene.add(stars);

  // Shared height function matches the feet controller. Colour variation is in the rock, not a grid overlay.
  const groundGeometry = new THREE.PlaneGeometry(WORLD.halfSize * 2, WORLD.halfSize * 2, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  groundGeometry.rotateX(-Math.PI / 2);
  const positions = groundGeometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), height = terrainHeight(x, z);
    positions.setY(i, height);
    const variation = (Math.sin(x * .042 + z * .069) + Math.cos(x * .14 - z * .04)) * .017 + random() * .035;
    const dust = dustCoverage(x, z);
    const geology=phase1Surface(x,z,height), exposed=Math.min(1,Math.max(0,height)/24);
    const layer=geology.strata*.026*exposed+geology.ejecta*.036;
    color.setRGB(.145 + variation + dust * .036+layer, .139 + variation * .8 + dust * .027+layer*.93, .154 + variation * .8 + dust * .016+layer*.87);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  groundGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); groundGeometry.computeVertexNormals();
  const gritCanvas = document.createElement('canvas'); gritCanvas.width = gritCanvas.height = 512;
  const gritContext = gritCanvas.getContext('2d'), grit = gritContext.createImageData(512, 512);
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    const value = 170 + random() * 75;
    const index = (y * 512 + x) * 4; grit.data[index] = value; grit.data[index + 1] = value; grit.data[index + 2] = value; grit.data[index + 3] = 255;
  }
  gritContext.putImageData(grit, 0, 0);
  const gritTexture = new THREE.CanvasTexture(gritCanvas); gritTexture.wrapS = gritTexture.wrapT = THREE.RepeatWrapping;
  gritTexture.repeat.set(900, 900); gritTexture.colorSpace = THREE.SRGBColorSpace; gritTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const ground = createTerrainRenderChunks(THREE, groundGeometry, enhanceTerrainMaterial(material('#ffffff', 1, .04, { vertexColors: true, map: gritTexture })), TERRAIN_SEGMENTS);
  scene.add(ground);
  groundGeometry.dispose();

  scene.add(createRockRenderChunks(ROCK_FIELD.rocks,terrainHeight,enhanceTerrainMaterial(material('#ffffff',.98,.04,{vertexColors:true,flatShading:true}))));
  scene.add(createMeteorDetails(materials));
  // Distant ridges lie outside the traversable 6 km square.
  const ridgeGeometry = new THREE.BufferGeometry(), ridgePositions = [], ridgeIndices = [];
  const ridgeSegments = 384, ridgeRows = 7;
  for (let row = 0; row < ridgeRows; row++) for (let segment = 0; segment <= ridgeSegments; segment++) {
    const a = segment / ridgeSegments * Math.PI * 2, radius = 4250 + row * 380;
    const profile = 360 + Math.sin(a * 5 + .4) * 115 + Math.sin(a * 13 + 2.1) * 91 + Math.sin(a * 29) * 48 + Math.sin(a * 67) * 23;
    const fold = Math.pow(Math.sin(row / (ridgeRows - 1) * Math.PI), 1.25);
    ridgePositions.push(Math.sin(a) * radius, profile * fold - 35 + Math.sin(a * 37 + row) * fold * 20, Math.cos(a) * radius);
    if (row < ridgeRows - 1 && segment < ridgeSegments) {
      const p = row * (ridgeSegments + 1) + segment, q = p + ridgeSegments + 1;
      ridgeIndices.push(p, q, p + 1, p + 1, q, q + 1);
    }
  }
  ridgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ridgePositions, 3)); ridgeGeometry.setIndex(ridgeIndices); ridgeGeometry.computeVertexNormals();
  const distantRidge = mesh(ridgeGeometry, material('#4c424e', 1, .05, { side: THREE.DoubleSide }), 0, 0, 0, scene, false);

  const wreck = new THREE.Group(); scene.add(wreck);
  // The structural surfaces and collision rectangles deliberately share one source.
  for (const wall of WALLS) {
    box(wall.w, wall.h, wall.d, Math.abs(wall.x) >= 49 ? hull : inner, wall.x, wall.h / 2, wall.z, wreck);
    const horizontal = wall.w > wall.d;
    box(horizontal ? wall.w : .14, .13, horizontal ? .14 : wall.d, darkHull, wall.x, .33, wall.z, wreck, false);
    box(horizontal ? wall.w : .13, .09, horizontal ? .13 : wall.d, glass, wall.x, 1.1, wall.z, wreck, false);
  }
  const deck = box(96, .12, 320, material('#4f5c65', .91, .3), 0, -.04, -631, wreck);
  deck.receiveShadow = true;
  // Fine deck seams, drainage channels and occasional worn plates give ground motion scale.
  for (let z = -478; z > -786; z -= 8) {
    box(13.6, .015, .065, dark, 0, .031, z, wreck, false);
    box(.09, .02, 7.8, edge, -6.2, .032, z - 4, wreck, false);
    box(.09, .02, 7.8, edge, 6.2, .032, z - 4, wreck, false);
  }
  const roof = box(97, 1.4, 318, darkHull, 0, 12.6, -632, wreck);
  roof.receiveShadow = true;
  // Roof superstructure stays above the walkable space: no inaccessible photo or sealed false entry.
  for (let row = 0; row < 9; row++) {
    const z = -490 - row * 33;
    for (const side of [-1, 1]) {
      // Closed structural modules sit directly on the roof; no floating plates.
      const height = 6 + row * 1.1;
      box(47, height, 33.2, row % 3 ? hull : rust, side * 23.5, 13.3 + height / 2, z, wreck);
      box(1.2, height + .4, 2.2, edge, side * 46, 13.3 + height / 2, z, wreck);
    }
    for (const x of [-7.9, 7.9]) {
      if (WALLS.some(w => Math.abs(x - w.x) < w.w / 2 && Math.abs(z - 8 - w.z) + 1.7 < w.d / 2)) box(1.8, 7, 3.4, edge, x, 3.5, z - 8, wreck);
    }
    box(14, .65, 1.5, edge, 0, 7.2, z - 8, wreck);
  }
  box(20, 10, 215, darkHull, -5, 28, -665, wreck);
  box(36, 19, 42, hull, -6, 40, -714, wreck);
  box(12, 32, 13, hull, -11, 63, -724, wreck);
  box(24, .8, 15, edge, -11, 79, -724, wreck);
  cylinder(.26, .48, 29, edge, -11, 93.5, -724, wreck);
  // Broken swept fins and an asymmetric upper hull retain a spacecraft silhouette from the approach.
  const finShape = new THREE.Shape();
  finShape.moveTo(0,0); finShape.lineTo(65,-56); finShape.lineTo(9,-79); finShape.lineTo(-4,-56); finShape.closePath();
  // Extrusion closes every edge; viewed from beneath, it remains a solid wing.
  const finGeometry = new THREE.ExtrudeGeometry(finShape,{depth:2.4,bevelEnabled:false});
  finGeometry.rotateX(Math.PI/2);
  const tornFin = material('#414149', .82, .63, { side: THREE.DoubleSide });
  mesh(finGeometry, tornFin, 39, 11, -520, wreck);
  const portFin = mesh(finGeometry.clone(), tornFin, -38, 16, -573, wreck); portFin.scale.x = -.81; portFin.rotation.z = -.17;
  const dorsal = box(11, 31, 74, hull, -16, 43, -627, wreck); dorsal.rotation.set(-.09, .04, -.46);
  box(24, 14, 76, darkHull, -16, 26, -627, wreck);
  for (let i = 0; i < 7; i++) {
    const height = 12 + random() * 13;
    const anchor = new THREE.Group();
    anchor.position.set(-24 + i * 8, 16, -487 - random() * 22);
    anchor.rotation.set(-.4 + random() * .8, random() * .6, -.55 + random() * 1.1);
    wreck.add(anchor);
    box(1.5 + random() * 3, height, 2, hull, 0, height / 2, 0, anchor);
  }
  for (let i = 0; i < 7; i++) {
    const windowPanel = box(3.3, 2, .24, i % 3 === 0 ? amber : dark, -19 + i * 4.1, 46.5, -692.7, wreck, false);
    windowPanel.rotation.z = -.12;
  }
  // Two dead engine bells sit on roof saddles, above the entrance bulkhead.
  for (const x of [-33, 33]) {
    box(12, 4, 15, darkHull, x, 15, -479, wreck);
    const bell = cylinder(9.3, 7.4, 14, darkHull, x, 22, -478, wreck, 20); bell.rotation.x = Math.PI / 2;
    for (const z of [-470.7, -474, -480.5]) ring(8.7, .62, edge, x, 22, z, wreck);
    const throat = mesh(new THREE.CircleGeometry(6.7, 24), dark, x, 22, -470.6, wreck);
    ring(4.9, .13, amber, x, 22, -470.5, wreck);
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      const vane = box(.5, 2.5, .8, hull, x + Math.cos(a) * 6.2, 22 + Math.sin(a) * 6.2, -469.8, wreck); vane.rotation.z = a - Math.PI / 2;
    }
    throat.castShadow = false;
  }
  // Visible, floor-level breach and ripped upper edges; its width matches the collision opening.
  box(16, 4.9, 2, rust, 0, 9.45, -470, wreck);
  for (const side of [-1, 1]) box(40, 4.9, 2, hull, side * 28, 9.45, -470, wreck);
  for (const side of [-1, 1]) {
    box(.7, 7, 1.2, rust, side * 8.4, 3.5, -469.2, wreck);
    box(.18, 2.8, .15, amber, side * 7.9, 1.7, -469.1, wreck, false);
  }
  lightSources.push({ x: 0, y: 5.5, z: -467, color: '#f6a65f', intensity: 42, distance: 27 });

  const powered = [];
  for (let z = -484; z > -785; z -= 23) {
    for (const side of [-1, 1]) box(.15, .08, 4.7, amber, side * 6.55, .13, z, wreck, false);
    box(1.8, .17, .4, dark, 0, 7, z, wreck);
    const lamp = box(1.5, .075, .23, cyan, 0, 6.9, z, wreck, false); powered.push(lamp);
    lightSources.push({ x: 0, y: 5.7, z, color: '#71c4d0', intensity: 26, distance: 20, powered: true });
  }
  // Sparse room equipment hugs the perimeter and remains clear of the documented travel route.
  for (const z of [-529, -551]) {
    for (const x of [-42, -39]) {
      box(2.4, 1.7, 4.5, hull, x, .85, z, wreck);
      box(2.5, .12, 4.6, edge, x, 1.75, z, wreck);
      box(.7, .13, .03, amber, x, 1.25, z + 2.28, wreck, false);
    }
  }
  for (let z = -622; z >= -641; z -= 6) {
    box(1.3, 4.8, 3.6, darkHull, 45, 2.4, z, wreck);
    for (let y = .8; y < 4.5; y += .65) box(.035, .12, 2.4, glass, 44.32, y, z, wreck, false);
  }
  for (const z of [-520, -570, -615, -655, -735]) {
    const pipe = cylinder(.21, .21, 20, rust, -6.6, 5.9, z, wreck); pipe.rotation.x = Math.PI / 2;
  }
  const gate = new THREE.Group(); gate.position.set(GATE.x, 0, GATE.z); wreck.add(gate);
  box(GATE.w, GATE.h, GATE.d, hull, 0, GATE.h / 2, 0, gate);
  for (const x of [-5.2, 0, 5.2]) box(.14, 6.1, 1.43, edge, x, 3.3, 0, gate);
  box(12.9, .11, 1.46, crimson, 0, 1.1, 0, gate, false);
  box(15.7, .6, 2.1, edge, 0, 7.3, GATE.z, wreck);
  for (const x of [-7.4, 7.4]) box(.65, 7.4, 2.1, darkHull, x, 3.7, GATE.z, wreck);
  // Batch immutable hull pieces by material; doors and power-dependent lamps stay separate.
  const staticBatches = new Map();
  for (const item of [...wreck.children]) {
    if (!item.isMesh || powered.includes(item)) continue;
    const key = `${item.material.uuid}:${item.castShadow}`;
    if (!staticBatches.has(key)) staticBatches.set(key, { material: item.material, shadow: item.castShadow, geometries: [] });
    item.updateMatrix();
    const geometry = item.geometry.index ? item.geometry.toNonIndexed() : item.geometry.clone();
    geometry.applyMatrix4(item.matrix); staticBatches.get(key).geometries.push(geometry);
    wreck.remove(item); item.geometry.dispose();
  }
  for (const batch of staticBatches.values()) {
    const geometry = mergeGeometries(batch.geometries, false);
    batch.geometries.forEach(g => g.dispose());
    if (geometry) mesh(geometry, batch.material, 0, 0, 0, wreck, batch.shadow);
  }
  function hangingSign(title, subtitle, z, y = 5.4, width = 8.4) {
    const surface = document.createElement('canvas'); surface.width = 1024; surface.height = 192;
    const context = surface.getContext('2d');
    context.fillStyle = '#08191f'; context.fillRect(0, 0, 1024, 192);
    context.strokeStyle = '#417b88'; context.lineWidth = 4; context.strokeRect(4, 4, 1016, 184);
    context.fillStyle = '#80d2dc'; context.fillRect(22, 25, 5, 140);
    context.fillStyle = '#d2edf0'; context.font = '600 66px "Microsoft YaHei", sans-serif'; context.fillText(title, 56, 91);
    context.fillStyle = '#72969e'; context.font = '26px "Microsoft YaHei", sans-serif'; context.fillText(subtitle, 59, 146);
    const texture = new THREE.CanvasTexture(surface); texture.colorSpace = THREE.SRGBColorSpace; signTextures.push(texture);
    const signMaterial = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }); materials.push(signMaterial);
    mesh(new THREE.PlaneGeometry(width, width * 192 / 1024), signMaterial, 0, y, z, wreck, false);
    box(width + .14, width * 192 / 1024 + .14, .14, darkHull, 0, y, z - .09, wreck);
    for (const x of [-width * .43, width * .43]) box(.055, 1.1, .065, edge, x, y + 1.05, z - .05, wreck, false);
  }
  hangingSign('← 货舱', 'CARGO / 01 · 备用电芯存储', -519.2);
  hangingSign('中继室 →', 'RELAY / 02 · 值班记录与信号中继', -610.2);
  hangingSign('原始记录舱', 'SEALED ARCHIVE / 03 · 独立安全回路', -709.85, 6.0, 8.2);

  const payloads = new Map();
  const riftEnergy=new THREE.Group(),beaconDecode=new THREE.Group();
  for (const point of POINTS) {
    const group = new THREE.Group(); group.name = point.id; group.position.set(point.x, terrainHeight(point.x, point.z), point.z); scene.add(group);
    const glow = point.type === 'blackbox' || point.type === 'anomaly' ? amber : cyan;
    if (point.type === 'entry') continue;
    if (point.type === 'beacon') {
      cylinder(1.05, 1.7, .45, hull, 0, .23, 0, group);
      cylinder(.2, .38, 4.5, edge, 0, 2.4, 0, group);
      cylinder(.08, .08, 3.5, cyan, 0, 3.4, 0, group);
      ring(.7, .1, cyan, 0, 4.5, 0, group).rotation.x = Math.PI / 2;
      for (const x of [-1.4, 1.4]) { const leg = box(.22, 2.8, .25, hull, x * .5, 1.1, 0, group); leg.rotation.z = x * .38; }
      const pod = box(5.5, 2.4, 8, muted, -6, 1.2, 4, group); pod.rotation.z = -.13;
      box(3.8, 1.4, .1, dark, -6, 1.5, 8.1, group);
      box(3.3, .1, .12, cyan, -6, 2.3, 8.2, group, false);
      group.add(beaconDecode);
      ring(.85,.09,amber,0,3.1,0,beaconDecode).rotation.x=Math.PI/2;
      box(.16,.75,.16,amber,0,3.65,0,beaconDecode,false);
    } else if (point.type === 'relay') {
      box(1.7, 1.1, 1.4, hull, 0, .55, 0, group);
      const stem = cylinder(.08, .14, 3, edge, .3, 2, 0, group); stem.rotation.z = -.22;
      const dish = mesh(new THREE.SphereGeometry(.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), muted, -.1, 3.2, 0, group); dish.rotation.x = Math.PI * .62;
      box(.75, .42, .035, glass, 0, .9, .72, group, false);
      box(.11, .12, .05, amber, .55, .95, .75, group, false);
    } else if (point.type === 'pickup') {
      box(1.2, .75, .9, hull, 0, .4, 0, group);
      const payload = new THREE.Group(); group.add(payload); payloads.set(point.id, payload);
      cylinder(.15, .15, .65, edge, 0, 1.12, 0, payload);
      cylinder(.153, .153, .43, cyan, 0, 1.12, 0, payload);
    } else if (point.type === 'power') {
      box(1.4, 1.65, .7, hull, 0, .86, 0, group);
      box(1.05, 1.1, .075, dark, 0, 1, .4, group);
      for (const x of [-.3, 0, .3]) cylinder(.065, .065, .48, amber, x, 1.1, .49, group);
      box(.65, .12, .08, glass, 0, .52, .48, group, false);
    } else if (point.type === 'terminal' || point.type === 'log') {
      cylinder(.55, .75, .28, darkHull, 0, .14, 0, group);
      box(.3, .85, .35, hull, 0, .6, 0, group);
      const screen = box(1.25, .72, .13, darkHull, 0, 1.21, 0, group); screen.rotation.x = -.38;
      const display = box(1.1, .57, .02, glass, 0, 1.23, .09, group); display.rotation.x = -.38;
      // Physical glyphs mirror the journal's three relay motifs, rather than arbitrary buttons.
      if (point.id === 'relay-1') ring(.16, .025, cyan, 0, 1.26, .17, group);
      else if (point.id === 'relay-2') {
        const a = box(.035, .24, .025, cyan, -.06, 1.32, .17, group); a.rotation.z = -.5;
        const b = box(.035, .24, .025, cyan, .06, 1.16, .17, group); b.rotation.z = -.5;
      } else if (point.id === 'relay-3') {
        for (let k = 0; k < 3; k++) { const spoke = box(.035, .4, .025, cyan, 0, 1.26, .17, group); spoke.rotation.z = k * Math.PI / 3; }
      } else {
        for (let i = 0; i < 4; i++) box(.65 - i * .1, .025, .03, cyan, -.1, 1.4 - i * .095, .17, group, false);
      }
    } else if (point.type === 'blackbox') {
      cylinder(1.2, 1.7, .25, hull, 0, .13, 0, group);
      box(.4, .8, .4, edge, 0, .63, 0, group);
      const payload = new THREE.Group(); group.add(payload); payloads.set(point.id, payload);
      box(1.1, .6, .62, amber, 0, 1.13, 0, payload);
      for (const x of [-.37, .37]) box(.15, .65, .66, darkHull, x, 1.13, 0, payload);
      box(.4, .16, .025, glass, 0, 1.17, .325, payload, false);
      for (let i = 0; i < 3; i++) ring(2.6 + i * 1.3, .025, glass, 0, .04, 0, group).rotation.x = Math.PI / 2;
    } else if (point.type === 'rift') {
      const relic=material('#333841',.85,.5);
      box(3.2,1.25,3.2,relic,0,.625,0,group);
      box(2.5,.08,2.5,dark,0,1.30,0,group);
      for(const x of [-4,4]) {
        box(1.15,3.8,1.15,relic,x,1.9,-2,group);
        box(.08,2.9,.025,muted,x,2.0,-1.41,group,false);
      }
      for(let i=0;i<3;i++)ring(3.5+i*1.4,.035,muted,0,.04,0,group).rotation.x=Math.PI/2;
      group.add(riftEnergy);
      for(let i=0;i<3;i++)ring(.65+i*.26,.025,amber,0,1.48+i*.24,0,riftEnergy).rotation.x=Math.PI/2;
      box(.07,1.0,.07,amber,0,1.90,0,riftEnergy,false);
      lightSources.push({x:point.x,y:group.position.y+2,z:point.z,intensity:18,distance:13,color:'#da925c',rift:true});
    } else if (point.id === 'capsule') {
      const body = cylinder(1.8, 1.8, 5.5, hull, 0, 1.5, 0, group, 10); body.rotation.z = Math.PI / 2; body.rotation.x = .18;
      box(2.6, .1, 1.3, dark, 0, 3.18, 0, group);
      box(.45, .04, 1.4, amber, 1, 3.24, 0, group, false);
    } else {
      const stone = mesh(new THREE.DodecahedronGeometry(1.45, 0), material('#25202d', .55, .4), 0, 1.7, 0, group); stone.scale.set(.75, 1.7, .62);
      box(.055, 2.8, .025, amber, -.15, 1.8, .88, group, false);
      const scar = box(.055, .85, .025, amber, .1, 1.3, .88, group, false); scar.rotation.z = -.6;
    }
    if(point.type!=='rift')lightSources.push({ x: point.x, y: group.position.y + 1.8, z: point.z + .7, color: glow === amber ? '#f6a951' : '#59d2e7', intensity: point.type === 'beacon' ? 24 : 9, distance: point.type === 'beacon' ? 16 : 6 });
  }
  // A fixed light pool avoids paying for dozens of off-screen point lights per fragment.
  const localLights = Array.from({ length: 4 }, () => { const light = new THREE.PointLight('#59d2e7', 0, 20, 2); scene.add(light); return light; });

  // Real, camera-mounted hands and scanner. Only this rig responds to footsteps.
  // A separate hand pass also prevents the shoulder torch from overexposing its own instrument.
  const handsScene = new THREE.Scene();
  const handsCamera = new THREE.PerspectiveCamera(72, 1, .05, 5); handsScene.add(handsCamera);
  handsScene.add(new THREE.HemisphereLight('#c5dce7', '#26303a', 2.0));
  const handKey = new THREE.DirectionalLight('#aac8d2', 1.6); handKey.position.set(-1, 2, 1); handsScene.add(handKey);
  const equipmentModel = createEquipmentViewmodel();
  handsCamera.add(equipmentModel.root);
  const torch = new THREE.SpotLight('#c2dded', 160, 85, .51, .55, 1.45);
  const torchMount=new THREE.Group();scene.add(torchMount);
  torch.position.set(.16, -.14, -.2); const torchTarget = new THREE.Object3D(); torchTarget.position.set(0, -.06, -10); torchMount.add(torch, torchTarget); torch.target = torchTarget;
  const avatar=createAvatar(materials);scene.add(avatar.root);avatar.root.visible=false;
  const skillVisual=createSkillVisual({scene,avatar,ground:terrainHeight}),instructor=createInstructor(scene,terrainHeight);
  const pulseEffects=createPulseEffects({THREE,scene,terrainHeight});
  const skimmer=createSkimmer(materials);scene.add(skimmer.root,skimmer.pickup);
  const surveyScene=createSurveyScene(materials);scene.add(surveyScene.root);
  const scanEffect=createScanEffect();scene.add(scanEffect.root);
  const dashEffect=createDashEffect();scene.add(dashEffect.root);
  const flightEffect=createYuanYingFlightVfx();scene.add(flightEffect.root);
  const ascensionEffects=createAscensionEffects(scene);
  const aerialSparring=createAerialSparringVisual(scene,materials);
  const dustGeometry = new THREE.BufferGeometry(); const dustPositions = new Float32Array(210 * 3);
  for (let i = 0; i < 210; i++) { dustPositions[i * 3] = (random() - .5) * 50; dustPositions[i * 3 + 1] = random() * 14; dustPositions[i * 3 + 2] = (random() - .5) * 50; }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: '#cebece', size: .035, transparent: true, opacity: .27, depthWrite: false })); scene.add(dust);

  let lastTime = 0, openProgress = 0,cameraState=null, planetController=null;
  const dynamicShadows = createDynamicShadowScheduler(.1);
  let shadowUpdates = 0, dynamicShadowUpdates = 0;
  function resize() {
    const width = Math.max(1, canvas.clientWidth || window.innerWidth), height = Math.max(1, canvas.clientHeight || window.innerHeight);
    renderer.setSize(width, height, false); camera.aspect = handsCamera.aspect = width / height; camera.updateProjectionMatrix(); handsCamera.updateProjectionMatrix();
  }
  function update(view) {
    view={...view,innateFlight:planetController?.hud()};
    const updateCpuStart=performance.now();
    if(sampleRenderBudget(renderBudget,performance.now()))renderer.setPixelRatio(renderBudget.ratio);
    const { player, flags = {} } = view;
    const time = Number.isFinite(view.time) ? view.time : 0;
    const dt = Math.max(0, Math.min(.1, time - lastTime)); lastTime = time;
    const groundHeight=view.planetFrame?player.y:terrainHeight(player.x,player.z);
    avatar.root.quaternion.identity();
    avatar.update(player,view,groundHeight,dt);
    const proneAmount=view.gait?.proneBlend||0,proneEye=proneAmount>.001?avatar.eyePosition():null;
    cameraState=view.planetFrame?{mode:view.cameraMode,position:{x:player.x,y:player.y+1.72,z:player.z},target:{x:player.x,y:player.y+1.72,z:player.z-1},avatarVisible:!['first','vehicle-first'].includes(view.cameraMode),distance:0,occluded:false}:resolveCamera({...player,vehicleYaw:view.mobility?.vehicle?.yaw,proneAmount,proneEye},view.cameraMode,cameraState,dt,flags.gateOpen);
    camera.position.set(cameraState.position.x,cameraState.position.y,cameraState.position.z);
    camera.lookAt(cameraState.target.x,cameraState.target.y,cameraState.target.z);
    avatar.root.visible=cameraState.avatarVisible;
    if(cameraState.mode==='first'&&(pulsePhase(view.combat)||view.combat?.skills?.phase||view.combat?.skills?.weapon)&&!view.innateFlight?.active)avatar.root.visible=true;
    skimmer.update(view.mobility?.vehicle,time,{firstPerson:cameraState.mode==='vehicle-first',radialGround:planetController?.vehicleRadial(),vx:player.vx,vz:player.vz,controls:view.drivingControls});
    if(view.mobility?.vehicle?.mounted&&!view.planetFrame){avatar.root.quaternion.copy(skimmer.root.quaternion);avatar.root.position.copy(skimmer.root.position).add(new THREE.Vector3(0,.14,0).applyQuaternion(skimmer.root.quaternion));}
    surveyScene.update({storyComplete: !!flags.complete, survey: view.survey});
    const feet=Number.isFinite(player.y)?player.y:groundHeight;
    torchMount.position.set(player.x,feet+(player.eyeHeight||WORLD.eyeHeight),player.z);torchMount.rotation.set(player.pitch||0,player.yaw||0,0,'YXZ');
    torch.position.set(.16,-.14,-.2);
    if(proneEye){torchMount.position.copy(proneEye);torch.position.set(.04,.03,-.25);}
    if(view.mobility?.vehicle?.mounted){const heading=view.mobility.vehicle.yaw;torchMount.position.set(player.x-Math.sin(heading)*1.05,feet+.9,player.z-Math.cos(heading)*1.05);torchMount.rotation.set(0,heading,0,'YXZ');}
    equipmentModel.update(view.showTool!==false&&cameraState.mode==='first'&&!pulsePhase(view.combat)&&!view.combat?.skills?.phase&&!view.combat?.skills?.weapon&&!view.innateFlight?.active?view.equipment:{},view.gait);
    if(cameraState.mode==='first'&&equipmentModel.root.visible)avatar.root.visible=false;
    torch.visible = view.flashlight !== false;
    const desired = flags.gateOpen ? 1 : 0;
    const previousOpen = openProgress;
    openProgress = THREE.MathUtils.damp(openProgress, desired, 3.5, dt);
    if (Math.abs(openProgress - previousOpen) > .002) renderer.shadowMap.needsUpdate = true;
    gate.position.y = openProgress * 8.5;
    for (const item of powered) item.visible = Boolean(flags.power);
    payloads.get('blackbox').visible = !flags.blackbox;
    payloads.get('fuse').visible = !flags.fuse;
    riftEnergy.visible=!!flags.returned&&!flags.riftClosed;
    riftEnergy.rotation.y=time*.35;
    beaconDecode.visible=!!flags.returned&&!flags.complete;
    const nearbyLights = lightSources.filter(source => (!source.powered || flags.power)&&(!source.rift||riftEnergy.visible))
      .map(source => ({ source, distance: Math.hypot(source.x - player.x, source.z - player.z) }))
      .filter(item => item.distance < item.source.distance + 20).sort((a, b) => a.distance - b.distance).slice(0, localLights.length);
    localLights.forEach((light, i) => {
      const source = nearbyLights[i]?.source; light.intensity = source?.intensity || 0;
      if (source) { light.position.set(source.x, source.y, source.z); light.color.set(source.color); light.distance = source.distance; }
    });
    scanEffect.update(view.scanner,time,{x:player.x,y:feet+1.2,z:player.z});
    dashEffect.update(view.dash || {active:false,serial:0},player,dt);
    dust.position.set(player.x + Math.sin(time * .08) * 3, 0, player.z);
    dust.visible = !insideWreck(player.x, player.z);
    sky.position.set(player.x, 0, player.z);
    planet.position.set(player.x + 2150, 2130, player.z - 6400); ringGroup.position.copy(planet.position); stars.position.set(player.x, 0, player.z);
    aerialSparring.update(view.combat,dt);
    planetController?.updateScene(view,{camera,scene,avatar:avatar.root,skimmer:skimmer.root,ground,distantRidge,sky,stars,ringPlanet:planet,ringGroup,dust});
    flightEffect.update(view.innateFlight,time,avatar.root,cameraState.mode==='first');
    ascensionEffects.update({flight:view.innateFlight,blink:planetController?.lastBlink,combat:view.combat,time,player,cameraMode:cameraState.mode,avatar:avatar.root});
    pulseEffects.update(view.combat,avatar.palmPosition());
    skillVisual.update(view.combat);instructor.update(time,view.combat);
    applyMountedVehicleView({avatar,skimmer,camera,view,cameraState});
    recordRenderWork(renderBudget,(view.simulationCpuMs||0)+performance.now()-updateCpuStart);
    if (dynamicShadows.consume(time)) { renderer.shadowMap.needsUpdate = true; dynamicShadowUpdates++; }
    if (renderer.shadowMap.needsUpdate) shadowUpdates++;
    try{
      renderer.info.reset(); renderer.clear(); renderer.render(scene, camera);
      if (view.showTool !== false&&cameraState.mode==='first'&&equipmentModel.root.visible) { renderer.clearDepth(); renderer.render(handsScene, handsCamera); }
    }finally{planetController?.finishScene();}
  }
  function dispose() {
    aerialSparring.dispose();
    ascensionEffects.dispose();
    scene.remove(flightEffect.root);flightEffect.dispose();
    pulseEffects.destroy();
    planetController?.dispose();
    skimmer.dispose();
    handsCamera.remove(equipmentModel.root);equipmentModel.dispose();
    scene.remove(scanEffect.root);scanEffect.dispose();
    scene.remove(dashEffect.root);dashEffect.dispose();
    const geometries = new Set(), allMaterials = new Set(materials);
    const collect = object => { if (object.geometry) geometries.add(object.geometry); if (Array.isArray(object.material)) object.material.forEach(m => allMaterials.add(m)); else if (object.material) allMaterials.add(object.material); };
    scene.traverse(collect); handsScene.traverse(collect);
    geometries.forEach(g => g.dispose()); allMaterials.forEach(m => m.dispose()); [gritTexture, panelTexture, planetTexture, ...signTextures].forEach(texture => texture.dispose()); skillVisual.dispose();instructor.dispose();avatar.dispose(); renderer.dispose();
  }
  resize();
  const cameraSnapshot=()=>cameraState?{...cameraState,position:{...cameraState.position},target:{...cameraState.target}}:null;
  return {ascensionSnapshot:ascensionEffects.snapshot, invalidateShadows(){renderer.shadowMap.needsUpdate=true;},invalidateDynamicShadows(){dynamicShadows.request();},shadowRefreshSnapshot:()=>({shadowUpdates,dynamicShadowUpdates,dynamicShadowPending:dynamicShadows.pending}),skillPalm:()=>avatar.palmPosition().clone(),scene, camera, renderer, update, resize, dispose,setPlanetController(controller){planetController=controller;distantRidge.visible=!controller;},cameraSnapshot,cockpitSnapshot:skimmer.cockpitSnapshot,equipmentSnapshot:equipmentModel.snapshot,scanSnapshot:scanEffect.snapshot,dashSnapshot:dashEffect.snapshot,avatarSnapshot:()=>avatar.poseSnapshot() };
}
