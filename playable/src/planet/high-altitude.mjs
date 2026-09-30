const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export const LEGACY_DITHER='fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898,78.233)))*43758.5453)';
/** Rendering policy only: the authoritative height field and collider stay unchanged. */
export function altitudeTerrainPolicy(agl){
  const height=Math.max(0,Number.isFinite(agl)?agl:0);
  return {legacyBlend:smooth(450,900,height),fogDensity:.00075*Math.exp(-height/550)};
}
export function installLegacyGroundFade(group){
  const alpha={value:0},seen=new Set();
  group.traverse(object=>{for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){
    if(seen.has(material))continue;seen.add(material);
    const compile=material.onBeforeCompile,key=material.customProgramCacheKey.call(material);
    material.onBeforeCompile=function(shader,renderer){compile.call(this,shader,renderer);shader.uniforms.planetLegacyBlend=alpha;shader.fragmentShader='uniform float planetLegacyBlend;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>\nif(${LEGACY_DITHER}<planetLegacyBlend) discard;`);};
    material.customProgramCacheKey=()=>key+'|legacy-altitude-fade-v1';material.needsUpdate=true;
  }});
  return {set(value){alpha.value=Math.max(0,Math.min(1,value));},get value(){return alpha.value;}};
}
