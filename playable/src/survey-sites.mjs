// World positions and solid dimensions are shared by physics and the visible sites.
// The interaction terminal is the origin; each site's approach remains open from +Z.
const site = (id, name, x, z, kind) => Object.freeze({ id, name, x, z, type: 'survey', kind, clearingRadius: 29 });
export const SURVEY_SITES = Object.freeze([
  site('survey-west', '断环观测架', -1100, 650, 'ring'),
  site('survey-east', '埋沙镜阵', 1200, 650, 'mirrors'),
  site('survey-north', '倾斜石柱', 1250, -1100, 'monolith'),
]);

const solids = [];
const add = (site, key, dx, dz, w, d, h, finish = 'stone') => solids.push(Object.freeze({ siteId: site.id, key, x: site.x + dx, z: site.z + dz, w, d, h, finish }));
for (const point of SURVEY_SITES) {
  add(point, 'terminal', 0, 0, 1.55, .95, 1.4, 'terminal');
  if (point.kind === 'ring') {
    // A fractured ground-supported annulus, not an overhead arch with an invisible wall.
    for (let i = 3; i <= 21; i++) {
      const angle = i / 24 * Math.PI * 2;
      add(point, `ring-${i}`, Math.sin(angle) * 9, -12 + Math.cos(angle) * 9, 1.7, 1.7, 1.25 + (i % 3) * .18, 'alloy');
    }
    add(point, 'mast-left', -6.5, -12, 1.45, 1.6, 9.8, 'alloy');
    add(point, 'mast-right', 6.5, -12, 1.45, 1.6, 7.5, 'alloy');
  } else if (point.kind === 'mirrors') {
    for (const [index, dx, dz, height] of [[0,-9,-8,4.8],[1,-4,-15,6.8],[2,4,-14,5.9],[3,9,-7,3.7]]) {
      add(point, `mirror-${index}`, dx, dz, 2.35, .82, height, 'mirror');
    }
    add(point, 'buried-register', 0, -7.5, 3.8, 2.5, .72, 'alloy');
  } else {
    // Adjacent, ground-rooted lamellae give the stone a slanted crown. Every
    // visible slab has its exact solid, including the climbable low fragments.
    for (let i = 0; i < 7; i++) add(point, `crown-${i}`, -6 + i * .8, -13, .8, 2.8, 6.5 + i * 1.05);
    add(point, 'broken-column', 5.2, -11, 2.1, 2.1, 6.2);
    add(point, 'fallen-foot', 3.7, -5.5, 3.6, 2.9, 1.15);
  }
}
export const SURVEY_SOLIDS = Object.freeze(solids);
export const SURVEY_CLEARINGS = Object.freeze(SURVEY_SITES.map(point => Object.freeze({ x: point.x, z: point.z - 9, radius: point.clearingRadius })));
