import {distance} from './rules.mjs';
/** Bounded local A*, swept edges, cached by caller. Never relocates an actor across an obstacle. */
export function findPath(start,goal,clear,{step=2.5,maxNodes=1600}={}) {
  if(clear(start,goal))return [{x:goal.x,z:goal.z}];
  const key=(x,z)=>x+','+z, open=[{ix:0,iz:0,x:start.x,z:start.z,g:0,parent:null}],cost=new Map([[key(0,0),0]]);
  let visited=0;
  while(open.length&&visited++<maxNodes){
    open.sort((a,b)=>(b.g+distance(b,goal))-(a.g+distance(a,goal)));
    const current=open.pop();
    if(distance(current,goal)<step*2&&clear(current,goal)){
      const points=[{x:goal.x,z:goal.z}];for(let n=current;n.parent;n=n.parent)points.push({x:n.x,z:n.z});
      return points.reverse();
    }
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const ix=current.ix+dx,iz=current.iz+dz;
      if(Math.abs(ix)>36||Math.abs(iz)>36)continue;
      const next={ix,iz,x:start.x+ix*step,z:start.z+iz*step,g:current.g+step*Math.hypot(dx,dz),parent:current};
      const k=key(ix,iz);if((cost.get(k)??Infinity)<=next.g||!clear(current,next))continue;
      cost.set(k,next.g);open.push(next);
    }
  }
  return [];
}
