import * as THREE from 'three';
import { ROCK_FIELD, terrainHeight } from './layout.mjs';

// Geology details only: the shared ROCK_FIELD supplies every large visible body
// and its collision. These millimetre-thin overlays add no false floating props.
export function createMeteorDetails(materials = []) {
  const group = new THREE.Group(); group.name = 'meteor-details';
  const scarPositions = [], scarColors = [], metalPositions = [], veinPositions = [];
  const vector = (rock, index, scale, rise) => {
    const vertex = rock.vertices[index % 8];
    const x = rock.x + vertex.x * scale, z = rock.z + vertex.z * scale;
    return new THREE.Vector3(x, terrainHeight(x, z) - .015 + rock.height * rise, z);
  };
  const triangle = (output, a, b, c) => output.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  const interpolate = (a, b, c, x, y, z) => new THREE.Vector3().addScaledVector(a, x).addScaledVector(b, y).addScaledVector(c, z);
  function ribbon(output, start, end, width, normal) {
    const across = new THREE.Vector3().subVectors(end, start).cross(normal).normalize().multiplyScalar(width / 2);
    const a = start.clone().add(across), b = start.clone().sub(across);
    const c = end.clone().add(across), d = end.clone().sub(across);
    triangle(output, a, b, c); triangle(output, b, d, c);
  }
  // Ground-conforming dark fall scars are deliberately flat and shallow: no
  // apparent raised crater rim that the player would be allowed to walk through.
  for (const impact of ROCK_FIELD.impacts) {
    const segments = 32, rings = [0, .48, .82, 1];
    const point = (index, ring) => {
      const a = index / segments * Math.PI * 2;
      const uneven = 1 + Math.sin(a * 5 + impact.id) * .08 + Math.sin(a * 9) * .035;
      const radius = impact.radius * rings[ring] * uneven;
      const u = Math.cos(a) * radius, v = Math.sin(a) * radius * .76;
      const x = impact.x + u * Math.cos(impact.direction) - v * Math.sin(impact.direction);
      const z = impact.z + u * Math.sin(impact.direction) + v * Math.cos(impact.direction);
      return new THREE.Vector3(x, terrainHeight(x, z) - .026, z);
    };
    const colors = [new THREE.Color('#211c23'), new THREE.Color('#241d26'), new THREE.Color('#39303b'), new THREE.Color('#4b414e')];
    for (let ring = 0; ring < rings.length - 1; ring++) for (let i = 0; i < segments; i++) {
      const a = point(i, ring), b = point(i + 1, ring), c = point(i, ring + 1), d = point(i + 1, ring + 1);
      triangle(scarPositions, a, c, b); triangle(scarPositions, b, c, d);
      for (const level of [ring, ring + 1, ring, ring, ring + 1, ring + 1]) scarColors.push(...colors[level].toArray());
    }
  }
  for (const rock of ROCK_FIELD.rocks) {
    if (rock.kind !== 'meteor' || !rock.fractured) continue;
    const face = rock.id % 8;
    // Use the same physical/rendered side triangle, never a guessed sphere.
    const a = vector(rock, face, 1, .32), b = vector(rock, face + 1, 1, .32), c = vector(rock, face, .43, .88);
    const normal = new THREE.Vector3().subVectors(c, a).cross(new THREE.Vector3().subVectors(b, a)).normalize();
    const surface = (x, y, z) => interpolate(a, b, c, x, y, z).addScaledVector(normal, .006);
    triangle(metalPositions, surface(.67, .19, .14), surface(.12, .54, .34), surface(.16, .15, .69));
    const p = surface(.76, .16, .08), q = surface(.42, .31, .27), r = surface(.24, .21, .55), s = surface(.12, .09, .79);
    for (const point of [p, q, r, s]) point.addScaledVector(normal, .004);
    const width = Math.max(.009, rock.radius * .009);
    ribbon(veinPositions, p, q, width, normal); ribbon(veinPositions, q, r, width * .75, normal); ribbon(veinPositions, r, s, width * .5, normal);
  }
  function batch(name, positions, material, colors = null) {
    materials.push(material);
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.receiveShadow = true; group.add(mesh);
  }
  batch('meteor-fall-scars', scarPositions, new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1, metalness: .06, transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide }), scarColors);
  batch('meteor-iron-faces', metalPositions, new THREE.MeshStandardMaterial({ color: '#756957', roughness: .56, metalness: .78, side: THREE.DoubleSide }));
  batch('meteor-fracture-veins', veinPositions, new THREE.MeshStandardMaterial({ color: '#b08a53', emissive: '#704018', emissiveIntensity: .16, roughness: .67, metalness: .63, side: THREE.DoubleSide }));
  group.userData.impactCount = ROCK_FIELD.impacts.length;
  return group;
}
