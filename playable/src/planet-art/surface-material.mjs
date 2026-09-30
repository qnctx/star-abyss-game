// Reference: docs/art/planet-v1/surface-transition-concept.png.
// Install AFTER the adapter's legacy-mask hook. No terrain/collision displacement.
// Requires geometry attribute planetLegacyXZ (stable anchor x,z,canonical up in metres).
// It is supplied by scene-adapter when legacyMaskHalfSize > 0, even when mask disabled.
const VERSION='planet-surface-v1';
const declarations=/* glsl */`
varying vec3 vPlanetArtSurface;
float planetArtHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float planetArtNoise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(planetArtHash(i),planetArtHash(i+vec3(1,0,0)),f.x),
                 mix(planetArtHash(i+vec3(0,1,0)),planetArtHash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(planetArtHash(i+vec3(0,0,1)),planetArtHash(i+vec3(1,0,1)),f.x),
                 mix(planetArtHash(i+vec3(0,1,1)),planetArtHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
`;
const surface=/* glsl */`
  // 3D value fields remain continuous on slopes and cube-face seams, without UV tiling.
  vec3 planetArtP=vPlanetArtSurface;
  float planetArtFootprint=max(length(dFdx(planetArtP)),length(dFdy(planetArtP)));
  float planetArtDistance=length(vViewPosition);
  float planetArtMacroFade=(1.0-smoothstep(900.0,12000.0,planetArtDistance))
      *(1.0-smoothstep(12.0,60.0,planetArtFootprint));
  // At flight altitude the original local ground has faded away. Keep broad
  // mineral/erosion colour structure visible on the real planet triangles.
  float planetArtOverviewFade=smoothstep(550.0,1400.0,planetArtDistance)
      *(1.0-smoothstep(9000.0,24000.0,planetArtDistance))
      *(1.0-smoothstep(10.0,65.0,planetArtFootprint));
  float planetArtSoilFade=(1.0-smoothstep(90.0,420.0,planetArtDistance))
      *(1.0-smoothstep(0.8,3.0,planetArtFootprint));
  float planetArtGrainFade=(1.0-smoothstep(12.0,65.0,planetArtDistance))
      *(1.0-smoothstep(0.06,0.28,planetArtFootprint));
  float planetArtMacro=planetArtNoise(planetArtP*0.025)-0.5;
  float planetArtRegional=planetArtNoise(planetArtP*0.0025+vec3(17.0,3.0,29.0));
  float planetArtErosion=planetArtNoise(planetArtP*vec3(0.007,0.002,0.007)+vec3(3.0,11.0,19.0));
  float planetArtSoil=planetArtNoise(planetArtP*0.32+vec3(13.7,3.2,7.1))-0.5;
  float planetArtGrain=planetArtNoise(planetArtP*2.4+vec3(3.2,19.1,5.7))-0.5;
  // Retain biome vertex colours. Maximum modulation is small; never paint neon grass.
  float planetArtTone=1.0+planetArtMacro*0.22*planetArtMacroFade
      +planetArtSoil*0.19*planetArtSoilFade+planetArtGrain*0.12*planetArtGrainFade;
  diffuseColor.rgb*=planetArtTone;
  vec3 planetArtMineral=mix(vec3(0.84,0.88,1.05),vec3(1.25,1.15,0.92),
      smoothstep(0.22,0.78,planetArtRegional));
  planetArtMineral=mix(planetArtMineral,vec3(1.13,1.09,1.0),
      0.16*smoothstep(0.5,0.75,planetArtErosion));
  diffuseColor.rgb*=mix(vec3(1.0),planetArtMineral,planetArtOverviewFade*0.8);
  diffuseColor.rgb*=mix(vec3(1.0),vec3(1.025,1.0,0.975),
      (planetArtSoil+0.5)*planetArtSoilFade);
  float planetArtRelief=planetArtSoil*0.018*planetArtSoilFade
      +planetArtGrain*0.009*planetArtGrainFade;
`;
const normals=/* glsl */`
  // Derivative bump is lighting-only; it cannot alter support height or silhouettes.
  vec3 planetArtDx=dFdx(-vViewPosition),planetArtDy=dFdy(-vViewPosition);
  vec3 planetArtR1=cross(planetArtDy,normal),planetArtR2=cross(normal,planetArtDx);
  float planetArtDet=dot(planetArtDx,planetArtR1);
  vec3 planetArtGradient=sign(planetArtDet)*(dFdx(planetArtRelief)*planetArtR1
      +dFdy(planetArtRelief)*planetArtR2);
  normal=normalize(max(abs(planetArtDet),1e-8)*normal-planetArtGradient);
`;
export function enhancePlanetSurfaceMaterial(material) {
  if(!material?.isMeshStandardMaterial)throw new TypeError('Planet surface requires MeshStandardMaterial');
  if(material.userData.planetSurfaceArt===VERSION)return material;
  const previousCompile=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey.call(material);
  material.vertexColors=true;
  material.onBeforeCompile=function(shader,renderer){
    previousCompile.call(this,shader,renderer);
    for(const [source,anchor] of [[shader.vertexShader,'#include <begin_vertex>'],
      [shader.fragmentShader,'#include <map_fragment>'],[shader.fragmentShader,'#include <normal_fragment_maps>']]){
      if(!source.includes(anchor))throw new Error('Unsupported planet surface shader hook: '+anchor);
    }
    if(!/attribute\s+vec3\s+planetLegacyXZ\s*;/.test(shader.vertexShader)){
      shader.vertexShader='attribute vec3 planetLegacyXZ;\n'+shader.vertexShader;
    }
    shader.vertexShader='varying vec3 vPlanetArtSurface;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvPlanetArtSurface=planetLegacyXZ.xzy;');
    shader.fragmentShader=declarations+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+surface);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+normals);
  };
  material.customProgramCacheKey=()=>previousKey+'|'+VERSION;
  material.userData.planetSurfaceArt=VERSION;
  material.needsUpdate=true;
  return material;
}
// Optional standalone constructor. In the adapter use the enhancer on its OWNED material
// after legacy mask setup; passing an external material conflicts with adapter mask ownership.
export function createPlanetSurfaceMaterial(THREE){
  return enhancePlanetSurfaceMaterial(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0}));
}
