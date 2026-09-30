import * as THREE from 'three';
import { terrainHeight } from './layout.mjs';
import { SURVEY_SITES, SURVEY_SOLIDS } from './survey-sites.mjs';

// Static structure batches are built once; the three terminal/status materials
// change only when an investigation state changes, not once per animation tick.
export function createSurveyScene(materials = []) {
  const root = new THREE.Group(); root.name = 'far-field-survey';
  const material = options => { const value = new THREE.MeshStandardMaterial(options); materials.push(value); return value; };
  const palette = {
    stone: material({ color: '#8f8984', roughness: .98, metalness: .13 }),
    alloy: material({ color: '#79828a', roughness: .72, metalness: .64 }),
    terminal: material({ color: '#304452', roughness: .79, metalness: .52 }),
    mirror: material({ color: '#9bacb7', roughness: .17, metalness: .92 }),
    dark: material({ color: '#13212c', roughness: .77, metalness: .39 }),
    trim: material({ color: '#b3a289', roughness: .86, metalness: .44 }),
  };
  const indicators = [];
  for (const site of SURVEY_SITES) {
    const group = new THREE.Group(); group.name = site.id; root.add(group);
    const batches = new Map();
    const addGeometry = (geometry, mat, x, y, z) => {
      const position = geometry.getAttribute('position'), index = geometry.getIndex();
      if (!batches.has(mat)) batches.set(mat, []);
      const out = batches.get(mat);
      for (let i = 0; i < (index ? index.count : position.count); i++) {
        const vertex = index ? index.getX(i) : i;
        out.push(position.getX(vertex) + x, position.getY(vertex) + y, position.getZ(vertex) + z);
      }
      geometry.dispose();
    };
    const box = (w, h, d, mat, x, y, z) => addGeometry(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
    const status = material({ color: '#57636a', emissive: '#1a242b', emissiveIntensity: .15, roughness: .38, metalness: .43 });
    const solids = SURVEY_SOLIDS.filter(solid => solid.siteId === site.id);
    for (const solid of solids) {
      const floor = terrainHeight(solid.x, solid.z);
      box(solid.w, solid.h, solid.d, palette[solid.finish], solid.x, floor + solid.h / 2, solid.z);
      // Inset face strips sit on the actual slabs, never floating walk-through rocks.
      if (solid.key.startsWith('mirror-')) {
        box(solid.w - .22, .09, .026, palette.trim, solid.x, floor + .32, solid.z + solid.d / 2 + .012);
        box(.065, solid.h - .5, .027, status, solid.x - solid.w * .35, floor + solid.h / 2, solid.z + solid.d / 2 + .014);
        for (let tick = 0; tick < 5; tick++) box(.29 + tick * .13, .035, .025, palette.dark, solid.x + .17, floor + .95 + tick * .59, solid.z + solid.d / 2 + .013);
      } else if (solid.key.startsWith('mast-')) {
        box(.075, solid.h - .9, .035, status, solid.x, floor + solid.h / 2, solid.z + solid.d / 2 + .018);
        for (let tick = 0; tick < 4; tick++) box(solid.w - .16, .09, .04, palette.dark, solid.x, floor + 1.2 + tick * 1.45, solid.z + solid.d / 2 + .02);
      } else if (solid.key.startsWith('crown-')) {
        const step = Number(solid.key.slice(-1));
        box(solid.w - .08, .06, .029, status, solid.x, floor + 3.1 + step * .27, solid.z + solid.d / 2 + .015);
        box(solid.w - .06, .11, .03, palette.dark, solid.x, floor + 1.65 + step * .13, solid.z + solid.d / 2 + .016);
      }
    }
    const floor = terrainHeight(site.x, site.z);
    // Terminal screen, three channel readings and a physical E glyph face the clear approach.
    box(1.31, .63, .035, palette.dark, site.x, floor + 1.01, site.z + .493);
    for (let channel = 0; channel < 3; channel++) {
      const x = site.x - .45 + channel * .24;
      box(.075, .3 + channel * .06, .018, status, x, floor + .97, site.z + .519);
      box(.17, .025, .019, palette.trim, x, floor + .76, site.z + .52);
    }
    const ex = site.x + .42, ey = floor + 1.02, ez = site.z + .52;
    box(.04, .24, .022, status, ex - .075, ey, ez);
    for (const [dy, width] of [[-.1,.17],[0,.13],[.1,.17]]) box(width, .035, .022, status, ex, ey + dy, ez);
    box(1.18, .045, .035, status, site.x, floor + 1.35, site.z + .49);
    box(.14, .21, .12, palette.trim, site.x - .59, floor + .37, site.z + .51);
    box(.14, .21, .12, palette.trim, site.x + .59, floor + .37, site.z + .51);

    for (const [mat, vertices] of batches) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.computeVertexNormals(); geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, mat); mesh.name = `${site.id}-${mat === status ? 'status' : 'structure'}`;
      mesh.castShadow = mat !== status; mesh.receiveShadow = true; group.add(mesh);
    }
    group.userData.siteId = site.id; group.userData.solidCount = solids.length;
    indicators.push({ id: site.id, material: status, mode: '' });
  }
  function update(view = {}) {
    const survey = view.survey || {};
    const archived = Array.isArray(survey.archived) ? survey.archived : SURVEY_SITES.slice(0, survey.archivedCount || 0).map(site => site.id);
    const currentId = survey.current?.id || SURVEY_SITES[archived.length]?.id;
    for (const item of indicators) {
      const mode = !view.storyComplete ? 'dormant' : archived.includes(item.id) ? 'archived' : survey.pending === item.id ? 'pending' : currentId === item.id ? 'active' : 'dormant';
      if (mode === item.mode) continue;
      item.mode = mode;
      const color = { dormant: '#57636a', archived: '#a5c2af', pending: '#e8b465', active: '#68d7df' }[mode];
      item.material.color.set(color); item.material.emissive.set(color);
      item.material.emissiveIntensity = mode === 'dormant' ? .045 : mode === 'archived' ? .35 : 1.15;
    }
  }
  update();
  return { root, update };
}
