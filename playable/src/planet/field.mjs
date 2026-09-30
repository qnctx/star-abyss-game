import {DEFAULT_PLANET,unit,scale,dot,tangentFrame} from './coordinates.mjs';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*x*(x*(x*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*t;
function seedHash(s){let h=2166136261;for(const c of String(s)){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0;}
function lattice(x,y,z,seed){let h=seed^Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;}
function noise(p,f,seed){const q=scale(p,f),x=Math.floor(q.x),y=Math.floor(q.y),z=Math.floor(q.z),u=smooth(q.x-x),v=smooth(q.y-y),w=smooth(q.z-z);
  const row=(j,k)=>mix(lattice(x,y+j,z+k,seed),lattice(x+1,y+j,z+k,seed),u);
  return mix(mix(row(0,0),row(1,0),v),mix(row(0,1),row(1,1),v),w);
}
// One continuous 3D field sampled on unit sphere; no longitude/cube-face seams.
export function createPlanetField({planet=DEFAULT_PLANET,legacyHeight=null,legacyMaxHeight=null,legacyHalfSize=3000,blendEnd=4000,frame=tangentFrame(0,0,planet.radius)}={}){
  if(!(planet.radius>blendEnd*2)||!(blendEnd>legacyHalfSize))throw new RangeError('Invalid planet/legacy region bounds');
  if(legacyMaxHeight!==null&&(!Number.isFinite(legacyMaxHeight)||legacyMaxHeight<=-planet.radius))throw new RangeError('Invalid certified legacy height bound');
  // Value noise is in [0,1]. Base <= .52*7000 + 1400 + 45 = 5085m.
  // Uplift <=999m, route <=520m, sea <=-205m; all blends are convex.
  // In the legacy branch |tx|,|tz|<blendEnd, hence sec(angle)<=sqrt(1+2*(blendEnd/R)^2).
  // An arbitrary injected function has no provable bound without a caller-certified maximum.
  const maxSurfaceHeight=legacyHeight&&legacyMaxHeight===null?null:Math.max(5085,legacyHeight?(planet.radius+legacyMaxHeight)*Math.sqrt(1+2*(blendEnd/planet.radius)**2)-planet.radius:0);
  const seed=seedHash(planet.seed),n=(p,f,s=0)=>noise(p,f,seed+s);
  // First playable watershed: broad continuous eastward valley, not disconnected biome rooms.
  const routeZ=s=>500*Math.sin(s/9500);
  const routeProfile=s=>{
    const knots=[[3000,60],[6500,240],[14000,170],[22000,90],[29000,24],[35000,2],[41000,-180]];
    for(let i=1;i<knots.length;i++)if(s<=knots[i][0]){const [a,h]=knots[i-1],[b,k]=knots[i];return mix(h,k,smooth((s-a)/(b-a)));}return -180;
  };
  const routeWeights=s=>{
    const defs={basin:[0,2400],plains:[8000,3700],mountains:[12000,2500],forest:[17000,4200],wetland:[27000,3500],river:[21000,2300],coast:[34000,2500],ocean:[42000,4800],cliff:[31000,1600]};
    return Object.fromEntries(Object.entries(defs).map(([id,[c,w]])=>[id,Math.exp(-(((s-c)/w)**2))*(id==='mountains'||id==='cliff'||id==='river'?.08:1)]));
  };
  function sample(direction){const p=unit(direction);
    const continental=n(p,3.1);let moisture=n(p,9.7,11);const temperature=clamp(1-Math.abs(p.y)*.8+(n(p,6,31)-.5)*.2);
    const ridge=1-Math.abs(n(p,25,7)*2-1),mountain=smooth((continental-.47)/.25)*ridge**3;
    let river=Math.exp(-(((n(p,38,29)-.5)/.026)**2))*smooth((continental-.4)/.15);
    let height=(continental-.48)*7000+mountain*1400+(n(p,150,3)-.5)*90-river*28;
    const s=Math.atan2(dot(p,frame.east),dot(p,frame.up))*planet.radius,cross=Math.asin(dot(p,frame.south))*planet.radius-routeZ(s);
    // Continental-scale uplift, independent of the square legacy ownership boundary.
    // Basin lies inland on a broad western plate; the eastern watershed reaches a curved coast.
    const northSouth=cross+routeZ(s),coastEast=35000+5500*Math.sin(northSouth/17000)+2200*Math.sin(northSouth/7300);
    const plateRadius=Math.hypot((s+20000)/85000,northSouth/72000);
    const plateEdge=1+.08*Math.sin(Math.atan2(northSouth,s+20000)*3)+(n(p,8,63)-.5)*.12;
    const plate=1-smooth((plateRadius-(plateEdge-.35))/.35);
    const inland=1-smooth((s-(coastEast-15000))/18000);
    const continentalUplift=plate*inland;
    const basinDistance=Math.hypot(s,northSouth),basinApron=1-smooth((basinDistance-4000)/7000);
    const inlandHeight=80+(1-basinApron)*(140+n(p,12,43)*420+mountain*350)+(n(p,110,59)-.5)*18;
    height=mix(height,inlandHeight,continentalUplift);
    // A broad eastern continental shelf makes the route mouth an actual sea, not a narrow lake.
    const easternSea=smooth((s-(coastEast-2000))/11000)*(1-smooth((s-95000)/25000))*(1-smooth((Math.abs(northSouth)-22000)/42000));
    height=mix(height,-250-smooth((s-coastEast)/30000)*850+(n(p,16,83)-.5)*90,easternSea);
    const routeBlend=smooth((s-2700)/1300)*(1-smooth((s-42000)/8000))*(1-smooth((Math.abs(cross)-1800)/7200));
    const channel=Math.exp(-(((cross-320)/100)**2));
    if(routeBlend>0){height=mix(height,routeProfile(s)-channel*8+(1-Math.exp(-((Math.max(0,Math.abs(cross)-600)/1600)**2)))*mountain*280,routeBlend);moisture=mix(moisture,mix(.25,.9,smooth((s-8000)/19000)),routeBlend);river=mix(river,channel,routeBlend);}
    let legacyWeight=0;
    const forward=dot(p,frame.up);
    if(legacyHeight&&forward>.5){
      // Ray through old tangent plane. Solves radial elevation so projected x/z and y match exactly.
      const tx=dot(p,frame.east)*planet.radius/forward,tz=dot(p,frame.south)*planet.radius/forward;
      const d=Math.max(Math.abs(tx),Math.abs(tz));
      if(d<blendEnd){
        let h=legacyHeight(tx,tz);
        // Fixed point accounts for legacy y changing the ray's intersection x/z.
        for(let i=0;i<12;i++)h=legacyHeight(tx*(1+h/planet.radius),tz*(1+h/planet.radius));
        const x=tx*(1+h/planet.radius),z=tz*(1+h/planet.radius);
        legacyWeight=1-smooth((Math.max(Math.abs(x),Math.abs(z))-legacyHalfSize)/(blendEnd-legacyHalfSize));
        height=mix(height,(planet.radius+h)/forward-planet.radius,legacyWeight);
      }
    }
    const ocean=1-smooth((height+40)/80),coast=Math.exp(-((height/95)**2)),wetland=moisture* Math.exp(-(((height-65)/170)**2))*(1-ocean),forest=moisture*temperature*(1-mountain)*(1-ocean);
    const raw={ocean,coast,wetland,forest,mountains:mountain*(1-ocean),plains:(1-moisture)*(1-mountain)*(1-ocean)+.01,river:river*(1-ocean),cliff:mountain**3*(1-ocean),basin:legacyWeight};
    if(routeBlend>0){const weights=routeWeights(s),sum=Object.values(weights).reduce((a,b)=>a+b);for(const id of Object.keys(raw))raw[id]=mix(raw[id],weights[id]/sum,routeBlend);raw.river+=channel*routeBlend*2;}
    const basinWeight=Math.max(legacyWeight,basinApron*continentalUplift);
    raw.basin=basinWeight;
    for(const k of Object.keys(raw))if(k!=='basin')raw[k]*=1-basinWeight;
    const total=Object.values(raw).reduce((a,b)=>a+b,0),biomes=Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,v/total]));
    const waterHeight=legacyWeight===1?null:routeBlend>.999&&s>=6500&&s<=35000?Math.max(0,routeProfile(s)-3):height<0?0:null;
    return {height,moisture,temperature,river,biomes,legacyWeight,continentalUplift,waterHeight,waterDepth:waterHeight===null?0:Math.max(0,waterHeight-height)};
  }
  function sampleSurface(direction){const p=unit(direction),result=sample(p),lat=Math.asin(p.y),lon=Math.atan2(-p.z,p.x),f=tangentFrame(lat,lon,planet.radius),epsilon=2/planet.radius;
    const offset=(axis,s)=>unit({x:p.x+axis.x*s,y:p.y+axis.y*s,z:p.z+axis.z*s});
    const derivative=axis=>(sample(offset(axis,epsilon)).height-sample(offset(axis,-epsilon)).height)/4;
    return {...result,slope:Math.atan(Math.hypot(derivative(f.east),derivative(f.south)))};
  }
  const surfacePoint=direction=>{const p=unit(direction);return scale(p,planet.radius+sample(p).height);};
  const routeDirection=(s,crossOffset=0)=>unit({x:frame.up.x*Math.cos(s/planet.radius)*Math.cos((routeZ(s)+crossOffset)/planet.radius)+frame.east.x*Math.sin(s/planet.radius)*Math.cos((routeZ(s)+crossOffset)/planet.radius)+frame.south.x*Math.sin((routeZ(s)+crossOffset)/planet.radius),y:frame.up.y*Math.cos(s/planet.radius)*Math.cos((routeZ(s)+crossOffset)/planet.radius)+frame.east.y*Math.sin(s/planet.radius)*Math.cos((routeZ(s)+crossOffset)/planet.radius)+frame.south.y*Math.sin((routeZ(s)+crossOffset)/planet.radius),z:frame.up.z*Math.cos(s/planet.radius)*Math.cos((routeZ(s)+crossOffset)/planet.radius)+frame.east.z*Math.sin(s/planet.radius)*Math.cos((routeZ(s)+crossOffset)/planet.radius)+frame.south.z*Math.sin((routeZ(s)+crossOffset)/planet.radius)});
  const routeLandmarks=[['basin',1000],['plains',8000],['forest',17000],['wetland',27000],['coast',34000],['ocean',42000]].map(([id,distance])=>({id,distance,position:surfacePoint(routeDirection(distance))}));
  return Object.freeze({planet,maxSurfaceHeight,sample,sampleSurface,surfacePoint,routeDirection,routeLandmarks});
}
