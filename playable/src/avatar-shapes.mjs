import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Tailored cloth, not capsules: every ring has its own cut, flattening and shallow folds.
export function tailoredGeometry(profile, { segments = 32, folds = .003, seed = 0 } = {}) {
  const sampled = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i], b = profile[i + 1], count = Math.max(1, Math.ceil((b[0] - a[0]) / .018));
    const previous = profile[Math.max(0, i - 1)], next = profile[Math.min(profile.length - 1, i + 2)];
    for (let step = 0; step < count; step++) {
      const t = step / count, h = b[0] - a[0];
      sampled.push(Array.from({ length: 5 }, (_, j) => {
        if (!j) return a[0] + h * t;
        const av = a[j] || 0, bv = b[j] || 0;
        const m0 = ((b[j] || 0) - (previous[j] || 0)) / (b[0] - previous[0]);
        const m1 = ((next[j] || 0) - av) / (next[0] - a[0]);
        const value = (2*t*t*t-3*t*t+1)*av + (t*t*t-2*t*t+t)*h*m0 + (-2*t*t*t+3*t*t)*bv + (t*t*t-t*t)*h*m1;
        // Clamp the cut to its neighbouring radii: smooth tailoring without
        // overshooting a cuff or inflating a joint into a spherical robot part.
        return j < 3 ? Math.max(Math.min(av,bv),Math.min(Math.max(av,bv),value)) : value;
      }));
    }
  }
  sampled.push(profile.at(-1)); profile = sampled;
  const positions = [], uv = [], indices = [];
  const height = Math.max(.001, profile.at(-1)[0] - profile[0][0]);
  for (let ring = 0; ring < profile.length; ring++) {
    const [y, rx, rz, cx = 0, cz = 0] = profile[ring], t = (y - profile[0][0]) / height;
    for (let j = 0; j <= segments; j++) {
      const angle = j / segments * Math.PI * 2;
      const gather = .28 + .6 * Math.exp(-(((t-.16)/.18)**2)) + .45*Math.exp(-(((t-.83)/.16)**2));
      const jointFabric=height>.25&&height<.6?1.65:1;
      const fold = folds * jointFabric * gather * (Math.sin(y * 43 + Math.sin(angle + seed) * 3.5) * .65 + Math.sin(y * 27 - angle * 3 + seed) * .35);
      positions.push(cx + Math.cos(angle) * (rx + fold), y, cz + Math.sin(angle) * (rz + fold));
      uv.push(j / segments, t * 2);
      if (ring < profile.length - 1 && j < segments) {
        const a = ring * (segments + 1) + j, b = a + segments + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  for (const end of [0, profile.length - 1]) {
    const [y, , , cx = 0, cz = 0] = profile[end], center = positions.length / 3;
    positions.push(cx, y, cz); uv.push(.5, .5);
    for (let j = 0; j < segments; j++) {
      const a = end * (segments + 1) + j;
      indices.push(center, end ? a + 1 : a, end ? a : a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

// A bespoke outline with a narrow edge bevel: deliberately no oval/leaf primitive.
export function mineralPlateGeometry(outline, thickness = .008, crown = .008) {
  // Softly turn each broken mineral edge instead of leaving large triangular
  // wings. The outline is still bespoke; this does not replace it with an oval.
  const curve = new THREE.CatmullRomCurve3(outline.map(p=>new THREE.Vector3(...p)),true,'centripetal');
  outline = Array.from({length:outline.length*3},(_,i)=>curve.getPoint(i/(outline.length*3)).toArray());
  if (THREE.ShapeUtils.area(outline.map(p=>new THREE.Vector2(p[0],p[1]))) < 0) outline.reverse();
  const center = outline.reduce((sum, p) => sum.map((n, i) => n + p[i] / outline.length), [0, 0, 0]);
  const positions = [], uv = [], indices = [], n = outline.length;
  const minX = Math.min(...outline.map(p => p[0])), maxX = Math.max(...outline.map(p => p[0]));
  const minY = Math.min(...outline.map(p => p[1])), maxY = Math.max(...outline.map(p => p[1]));
  for (const [scale, depth] of [[1, -thickness], [1, 0], [.945, crown]]) {
    for (const point of outline) {
      const x = center[0] + (point[0] - center[0]) * scale;
      const y = center[1] + (point[1] - center[1]) * scale;
      const z = point[2] + depth;
      positions.push(x, y, z); uv.push((x - minX) / Math.max(.01, maxX - minX), (y - minY) / Math.max(.01, maxY - minY));
    }
  }
  const triangles = THREE.ShapeUtils.triangulateShape(outline.map(p => new THREE.Vector2(p[0], p[1])), []);
  const inset = outline.map((point,i)=>positions.slice((i+n*2)*3,(i+n*2)*3+3));
  const distanceToEdge = point => Math.min(...inset.map((a, i) => {
    const b = inset[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / Math.max(.000001, dx * dx + dy * dy)));
    return Math.hypot(point[0] - a[0] - dx * t, point[1] - a[1] - dy * t);
  }));
  const crownVertex = (point, raised) => {
    const index = positions.length / 3, distance = distanceToEdge(point);
    const rise = crown * Math.sin(Math.min(1, distance / .05)*Math.PI*.5);
    positions.push(point[0], point[1], point[2] + (raised ? rise : 0));
    uv.push((point[0] - minX) / Math.max(.01, maxX - minX), (point[1] - minY) / Math.max(.01, maxY - minY));
    return index;
  };
  const subdivide = (a, b, c, depth, raised = true) => {
    if (!depth) { indices.push(crownVertex(a, raised), crownVertex(b, raised), crownVertex(c, raised)); return; }
    const mid = (x, y) => x.map((v, i) => (v + y[i]) / 2);
    const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
    subdivide(a, ab, ca, depth - 1, raised); subdivide(ab, b, bc, depth - 1, raised); subdivide(ca, bc, c, depth - 1, raised); subdivide(ab, bc, ca, depth - 1, raised);
  };
  const vertex = i => positions.slice(i*3,i*3+3);
  // All faces use the same boundary refinement: a true closed solid, not a
  // front tessellation with unmatched T-junctions on its side and inner face.
  for (let ring = 0; ring < 2; ring++) for (let i = 0; i < n; i++) {
    const a = ring * n + i, b = ring * n + (i + 1) % n;
    subdivide(vertex(a),vertex(b),vertex(a+n),1,false);
    subdivide(vertex(b),vertex(b+n),vertex(a+n),1,false);
  }
  for (const [a,b,c] of triangles) subdivide(vertex(c),vertex(b),vertex(a),1,false);
  for (const triangle of triangles) subdivide(...triangle.map(i => {
    const index = (i + n * 2) * 3; return positions.slice(index, index + 3);
  }), 1);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const joined = mergeVertices(geometry, .00001); geometry.dispose(); joined.computeVertexNormals();
  return joined;
}

export function bootGeometry(sole = false) {
  const controls = [[-.053,.072],[.053,.072],[.069,.035],[.073,-.08],[.061,-.16],[.036,-.182],[-.036,-.182],[-.063,-.16],[-.074,-.08],[-.067,.033]];
  const curve=new THREE.CatmullRomCurve3(controls.map(([x,z])=>new THREE.Vector3(x,0,z)),true,'centripetal');
  const outline=Array.from({length:40},(_,i)=>{const p=curve.getPoint(i/40);return[p.x,p.z];});
  const rings = sole ? [[.012,1],[.034,1]] : [[.035,.98],[.078,.98],[.118,.83],[.16,.68]];
  const positions = [], uv = [], indices = [], n = outline.length;
  for (let ring = 0; ring < rings.length; ring++) {
    const [y, scale] = rings[ring];
    for (let j = 0; j < n; j++) {
      const [x, z] = outline[j], upper = ring === rings.length - 1 && !sole;
      positions.push(x * scale, y + (upper && z < -.075 ? -.058 : 0), z * (upper ? .62 : 1)); uv.push(j / n, ring / rings.length);
      if (ring < rings.length - 1) {
        const a = ring * n + j, b = ring * n + (j + 1) % n;
        indices.push(a, b, a + n, b, b + n, a + n);
      }
    }
  }
  for (let j = 1; j < n - 1; j++) indices.push((rings.length - 1) * n, (rings.length - 1) * n + j, (rings.length - 1) * n + j + 1);
  for (let j = 1; j < n - 1; j++) indices.push(0,j+1,j);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}
