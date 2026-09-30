import {Box3,Ray,Vector3} from 'three';
import {Octree} from 'three/addons/math/Octree.js';
import {Capsule} from 'three/addons/math/Capsule.js';
import {registerPhysicalProps} from './physical-props.mjs';

/** Both side collision and foot support use the rendered world-space triangles. */
export function installCampCollision(objects){
  const entries=objects.map(object=>{object.updateWorldMatrix(true,true);return {bounds:new Box3().setFromObject(object),tree:new Octree().fromGraphNode(object)};});
  let enabled=true;const ray=new Ray(new Vector3(),new Vector3(0,-1,0)),capsule=new Capsule();
  const nearby=(b,x,z,r=0)=>x>=b.min.x-r&&x<=b.max.x+r&&z>=b.min.z-r&&z<=b.max.z+r;
  const provider={support(x,z,maxHeight){if(!enabled)return -Infinity;let result=-Infinity;
    for(const {bounds,tree} of entries){if(!nearby(bounds,x,z))continue;ray.origin.set(x,Math.min(bounds.max.y+.1,maxHeight+.001),z);const hit=tree.rayIntersect(ray);if(hit&&hit.position.y<=maxHeight+.002)result=Math.max(result,hit.position.y);}return result;
  },blocked(x,z,feet,radius,height){if(!enabled)return false;
    capsule.radius=radius;capsule.start.set(x,feet+radius+.015,z);capsule.end.set(x,feet+Math.max(radius,height-radius),z);
    for(const {bounds,tree} of entries){if(!nearby(bounds,x,z,radius)||feet>bounds.max.y+.01||feet+height<bounds.min.y)continue;const hit=tree.capsuleIntersect(capsule);if(hit&&hit.depth>.008)return true;}return false;
  }};
  const remove=registerPhysicalProps(provider);
  return {provider,setEnabled(value){enabled=!!value;},destroy:remove};
}
