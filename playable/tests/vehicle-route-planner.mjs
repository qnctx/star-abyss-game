import {createMobility,stepMobility} from '../src/mobility.mjs';
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
// Test-only local manoeuvres. Reuse production physics on clones; execute only
// the returned controls. The existing drivingRoute supplies global waypoints.
export function planVehicleControls(start,mobility,target,{gateOpen=false,maxNodes=45000}={}) {
  if(!mobility.vehicle.mounted)throw Error('Planner requires a mounted vehicle');
  if(Math.hypot(start.vx||0,start.vz||0)>.001)throw Error('Brake to a full stop before planning');
  const vehicle=mobility.vehicle;
  const heap=[];
  function push(n){heap.push(n);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;}
  function pop(){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].f<heap[j].f)j++;if(last.f<=heap[j].f)break;heap[i]=heap[j];i=j;}heap[i]=last;}return first;}
  const distance=p=>Math.hypot(target.x-p.x,target.z-p.z);
  const key=n=>`${Math.round(n.p.x*4)},${Math.round(n.p.z*4)},${Math.round(wrap(n.v.yaw)*18/Math.PI)}`;
  const initial={p:{...start},v:{...vehicle},g:0,f:distance(start),parent:null};push(initial);const seen=new Map([[key(initial),0]]);
  let count=0;
  while(heap.length&&count++<maxNodes){
    const current=pop();if(current.g>seen.get(key(current)))continue;
    if(distance(current.p)<.48){const actions=[];for(let n=current;n.parent;n=n.parent)actions.unshift(n.action);const segments=[];for(const input of actions.flat()){const last=segments.at(-1);if(last&&JSON.stringify(last.input)===JSON.stringify(input))last.frames++;else segments.push({input,frames:1});}return {segments,nodes:count,predictedDistance:distance(current.p)};}
    const d=distance(current.p);
    for(const gear of [1,-1])for(const steer of [-1,0,1]){
      const p={...current.p},s=createMobility();s.vehicle={...current.v};
      const input={forward:gear>0,backward:gear<0,left:steer>0,right:steer<0};
      const duration=d<8?.35:.8;const action=[];let length=0,blocked=false;
      for(let t=0;t<duration-1e-6;t+=1/60){const m=stepMobility(p,s,input,1/60,gateOpen);length+=m.distance;action.push(input);if(m.blocked){blocked=true;break;}}
      for(let j=0;j<120&&Math.hypot(p.vx,p.vz)>.001&&!blocked;j++){const brake={lift:true};const m=stepMobility(p,s,brake,1/60,gateOpen);length+=m.distance;action.push(brake);if(m.blocked)blocked=true;}
      if(blocked||length<.01||Math.abs(p.x-start.x)>Math.abs(target.x-start.x)+25||Math.abs(p.z-start.z)>Math.abs(target.z-start.z)+25)continue;
      const g=current.g+length+.05+(gear<0?.15:0),n={p,v:s.vehicle,g,f:g+distance(p)*1.9,parent:current,action};
      if((seen.get(key(n))??Infinity)<=g)continue;seen.set(key(n),g);push(n);
    }
  }
  throw Error(`plan failed ${count} nodes`);
}
