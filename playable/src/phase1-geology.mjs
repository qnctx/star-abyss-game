// Surface study from docs/art/environments/phase1-v1/map-concept.png.
// World-space sampling keeps the exposed strata continuous across steep ridges.
import {TextureLoader, RepeatWrapping, SRGBColorSpace, LinearMipmapLinearFilter} from 'three';
const basaltLoader = new TextureLoader();
const basaltUniforms = {phase1BasaltMap:{value:null}, phase1BasaltReady:{value:0}};
let basaltRequested = false;
/** One shared optional texture per application. Failure keeps procedural colour
 * and normals intact; enable only after image decoding has succeeded. */
export function loadPhase1BasaltTexture(url) {
  if(basaltRequested || typeof document==='undefined') return;
  basaltRequested=true;
  basaltLoader.load(url || new URL('assets/environments/phase1/basalt-albedo.png',document.baseURI).href, texture=>{
    texture.colorSpace=SRGBColorSpace;
    texture.wrapS=texture.wrapT=RepeatWrapping;
    texture.minFilter=LinearMipmapLinearFilter;
    texture.generateMipmaps=true;texture.anisotropy=4;texture.needsUpdate=true;
    basaltUniforms.phase1BasaltMap.value=texture;
    basaltUniforms.phase1BasaltReady.value=1;
  },undefined,()=>{basaltUniforms.phase1BasaltReady.value=0;});
}
const declarations = /* glsl */`
varying vec3 vGeologyWorld;
varying vec3 vGeologyNormal;
uniform sampler2D phase1BasaltMap;
uniform float phase1BasaltReady;
float geologyHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float geologyNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(geologyHash(i), geologyHash(i+vec3(1,0,0)), f.x),
                 mix(geologyHash(i+vec3(0,1,0)), geologyHash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(geologyHash(i+vec3(0,0,1)), geologyHash(i+vec3(1,0,1)), f.x),
                 mix(geologyHash(i+vec3(0,1,1)), geologyHash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
`;

const surface = /* glsl */`
  vec3 geologyP = vGeologyWorld;
  float geologySlope = 1.0 - abs(normalize(vGeologyNormal).y);
  float geologyMass = geologyNoise(geologyP * 0.036);
  float geologyChips = geologyNoise(geologyP * 0.67 + 17.1) * 0.65
      + geologyNoise(geologyP * 2.17 - 9.2) * 0.35;
  // A bent bedding plane, interrupted by chips, rather than regular grid lines.
  float geologyLayerPhase = geologyP.y * 1.15 + geologyP.x * 0.021
      + geologyP.z * 0.014 + geologyMass * 9.0 + geologyChips * 1.9;
  float geologyLayer = sin(geologyLayerPhase);
  float geologyLayerWidth = max(fwidth(geologyLayerPhase), 0.035);
  float geologySeam = 1.0 - smoothstep(0.03, 0.09 + geologyLayerWidth,
      abs(geologyLayer + (geologyChips - 0.5) * 1.15));
  geologySeam *= smoothstep(0.24, 0.53, geologyChips);
  // Irregular 3D noise level sets, never intersecting periodic X/Z lines:
  // periodic fractures read as masonry when crossed with the bedding planes.
  float geologyFractureField = geologyNoise(geologyP * 0.23 + geologyMass * 5.7);
  float geologyFracture = (1.0 - smoothstep(0.005, 0.024 + fwidth(geologyFractureField),
      abs(geologyFractureField - 0.47))) * smoothstep(0.24, 0.56, geologyChips);
  float geologyExposed = smoothstep(0.045, 0.36, geologySlope);
  float geologyGrain = geologyNoise(geologyP * 7.3);
  // Fade microscopic detail once it is smaller than a screen pixel.
  float geologyFineFade = 1.0 - smoothstep(0.025, 0.23, length(fwidth(geologyP)));
  float geologyRelief = (geologyChips - 0.5) * 0.12
      + (geologyGrain - 0.5) * 0.012 * geologyFineFade
      - geologySeam * geologyExposed * 0.002 - geologyFracture * 0.012;
  float geologyTone = 0.87 + geologyMass * 0.29 + (geologyChips - 0.5) * 0.32;
  geologyTone -= geologySeam * geologyExposed * 0.025 + geologyFracture * 0.10;
  // Keep scene vertex colours but neutralise some violet in exposed basalt.
  vec3 geologyTint = mix(vec3(1.06, 1.04, 0.99), vec3(0.94, 1.00, 1.04), geologyExposed);
  diffuseColor.rgb *= geologyTone * geologyTint;
  if (phase1BasaltReady > 0.5) {
    vec3 geologyBlend = pow(abs(normalize(vGeologyNormal)), vec3(4.0));
    geologyBlend /= max(dot(geologyBlend, vec3(1.0)), 0.0001);
    // Three uploads SRGBColorSpace textures as sRGB; samples here are linear.
    vec3 geologyImage = texture2D(phase1BasaltMap, geologyP.zy * 0.24).rgb * geologyBlend.x
      + texture2D(phase1BasaltMap, geologyP.xz * 0.24).rgb * geologyBlend.y
      + texture2D(phase1BasaltMap, geologyP.xy * 0.24).rgb * geologyBlend.z;
    float geologyImageFade = 1.0-smoothstep(45.0,190.0,length(vViewPosition));
    float geologyImageWeight = geologyExposed * (0.24+0.63*geologyImageFade);
    // Bound modulation so an unusually dark source cannot black out the mesh.
    vec3 geologyImageTone=clamp(geologyImage / 0.14, vec3(0.48), vec3(1.70));
    diffuseColor.rgb *= mix(vec3(1.0),geologyImageTone,geologyImageWeight);
    geologyRelief += dot(geologyImage,vec3(0.2126,0.7152,0.0722))
      * 0.055 * geologyExposed * geologyImageFade;
  }
`;

const normalDetail = /* glsl */`
  // Screen derivatives perturb the lit normal; this is not a displacement and
  // cannot move feet/collision or introduce silhouette-only fake cliffs.
  vec3 geologyDx = dFdx(-vViewPosition);
  vec3 geologyDy = dFdy(-vViewPosition);
  vec3 geologyR1 = cross(geologyDy, normal);
  vec3 geologyR2 = cross(normal, geologyDx);
  float geologyDet = dot(geologyDx, geologyR1);
  vec3 geologyGradient = sign(geologyDet) *
      (dFdx(geologyRelief) * geologyR1 + dFdy(geologyRelief) * geologyR2);
  normal = normalize(max(abs(geologyDet), 1e-8) * normal - geologyGradient);
`;

/** Enhance a Three MeshStandardMaterial in place, preserving lighting/shadows.
 * Call once before first render. No added draw calls or colliders.
 * Optional shared basalt image loads asynchronously with procedural fallback.
 * Ground and static rock meshes are supported; animated/skinned meshes are not.
 */
export function enhanceTerrainMaterial(material, {basaltTexture=true, textureUrl}={}) {
  if (!material?.isMeshStandardMaterial) throw new TypeError('Geology requires MeshStandardMaterial');
  if (material.userData.phase1Geology) return material;
  if(basaltTexture) loadPhase1BasaltTexture(textureUrl);
  const previousCompile = material.onBeforeCompile;
  const previousCacheKey = material.customProgramCacheKey.bind(material);
  const baseCacheKey = previousCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    previousCompile.call(this, shader, renderer);
    shader.uniforms.phase1BasaltMap=basaltUniforms.phase1BasaltMap;
    shader.uniforms.phase1BasaltReady=basaltTexture?basaltUniforms.phase1BasaltReady:{value:0};
    const vertexAnchor = '#include <begin_vertex>';
    const mapAnchor = '#include <map_fragment>';
    const normalAnchor = '#include <normal_fragment_maps>';
    if (!shader.vertexShader.includes(vertexAnchor) || !shader.fragmentShader.includes(mapAnchor)
        || !shader.fragmentShader.includes(normalAnchor)) throw new Error('Unsupported geology shader hooks');
    shader.vertexShader = 'varying vec3 vGeologyWorld;\nvarying vec3 vGeologyNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(vertexAnchor, vertexAnchor + `
      vec4 geologyPosition = vec4(transformed, 1.0);
      vec3 geologyVertexNormal = objectNormal;
      #ifdef USE_INSTANCING
        geologyPosition = instanceMatrix * geologyPosition;
        geologyVertexNormal = mat3(instanceMatrix) * geologyVertexNormal;
      #endif
      vGeologyWorld = (modelMatrix * geologyPosition).xyz;
      vGeologyNormal = normalize(mat3(modelMatrix) * geologyVertexNormal);
    `);
    shader.fragmentShader = declarations + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(mapAnchor, mapAnchor + surface);
    shader.fragmentShader = shader.fragmentShader.replace(normalAnchor, normalAnchor + normalDetail);
  };
  material.customProgramCacheKey = () => baseCacheKey + '|phase1-geology-2';
  material.userData.phase1Geology = { reference: 'phase1-v1/map-concept.png', version: 2 };
  material.needsUpdate = true;
  return material;
}
