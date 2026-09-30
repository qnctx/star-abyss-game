import {unit,dot,sub,scale,length,toCartesian,toGeodetic,localToGlobal,tangentFrame} from './planet/coordinates.mjs';
import {createCartography} from './cartography.mjs';
const TAU=Math.PI*2;
const escapeXml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const wrap=angle=>((angle+Math.PI)%TAU+TAU)%TAU-Math.PI;
const SURVEYS=[['plains','平原与山麓'],['forest','河流与森林'],['wetland','湿地'],['coast','海岸']];
export function explorationMapMarkers(records=[]){
  const seen=new Set();return records.filter(mark=>mark?.discovered===true&&typeof mark.id==='string'&&!seen.has(mark.id)&&seen.add(mark.id)&&mark.position&&['x','y','z'].every(k=>Number.isFinite(mark.position[k]))&&length(mark.position)>0).map(mark=>{
    const hasResource=Number.isFinite(mark.quantity)?mark.quantity>0:!['observe','legacy'].includes(mark.kind)&&Number.isFinite(mark.remaining);
    const depleted=hasResource&&mark.remaining===0;
    const status=[mark.investigated?'已调查':'待调查',depleted?'已采尽':hasResource?`余 ${mark.remaining} 份`:null,mark.returned?'已回报':null].filter(Boolean).join(' · ');
    return {id:'exploration:'+mark.id,kind:'exploration',label:String(mark.name||'探索地标'),name:String(mark.name||'探索地标'),symbol:depleted?'尽':mark.investigated?'✓':'探',position:{...mark.position},completed:!!mark.investigated,status,investigated:!!mark.investigated,remaining:mark.remaining,returned:!!mark.returned};
  });
}
export function sphericalNavigation(from,to,radius){
  if(!Number.isFinite(radius)||radius<=0)throw new RangeError('Positive radius required');
  const a=unit(from),b=unit(to),cos=Math.max(-1,Math.min(1,dot(a,b))),tangent=sub(b,scale(a,cos));
  const sine=length(tangent),angle=Math.atan2(sine,cos),geo=toGeodetic(a,radius),frame=tangentFrame(geo.lat,geo.lon,radius);
  // Coincident, antipodal and exact polar initial headings have no unique north bearing.
  const bearing=sine<1e-12||Math.abs(a.y)>1-1e-12?null:((Math.atan2(dot(tangent,frame.east),-dot(tangent,frame.south))*180/Math.PI)%360+360)%360;
  return {distance:angle*radius,bearing};
}
export function projectPlanet(position,{radius,width=960,height=480}={}){
  const {lat,lon}=toGeodetic(position,radius);
  return {x:(wrap(lon)+Math.PI)/TAU*width,y:(Math.PI/2-lat)/Math.PI*height,lat,lon:wrap(lon)};
}
export function unprojectPlanet({x,y},{radius,width=960,height=480}={}){
  if(![x,y,width,height].every(Number.isFinite)||width<=0||height<=0||x<0||x>width||y<0||y>height)throw new RangeError('Point outside map');
  return unit(toCartesian({lat:Math.PI/2-y/height*Math.PI,lon:x/width*TAU-Math.PI},radius));
}
export function createPlanetMap({field,camp=null,width=960,height=480,columns=240,rows=120}={}){
  if(!field?.sample||!field?.surfacePoint||!field?.planet||![width,height,columns,rows].every(Number.isFinite)||width<160||height<100||!Number.isInteger(columns)||!Number.isInteger(rows)||columns<4||rows<2||columns*rows>131072)throw new TypeError('Field and bounded map dimensions required');
  const radius=field.planet.radius,projection={radius,width,height};
  const fixed=[{id:'camp',kind:'camp',label:'营地',symbol:'营',position:camp??field.surfacePoint(localToGlobal({x:0,y:0,z:196},tangentFrame(0,0,radius)))}];
  for(const [index,[id,label]]of SURVEYS.entries()){
    const landmark=field.routeLandmarks?.find(mark=>mark.id===id);
    if(!landmark)throw new Error('Missing actual survey landmark: '+id);
    fixed.push({id:'survey:'+id,kind:'survey',biome:id,label,symbol:String(index+1),position:{...landmark.position}});
  }
  for(const mark of fixed){unit(mark.position);mark.position=Object.freeze({...mark.position});Object.freeze(mark);}
  const atlas=createCartography({columns,rows,width,height,sample:(u,v)=>field.sample(unprojectPlanet({x:u*width,y:v*height},projection))});
  const background=atlas.svg;
  function model(state){
    unit(state?.position);
    const markers=fixed.map(mark=>({...mark,position:{...mark.position},completed:mark.kind==='survey'&&Array.isArray(state.progression?.surveys)&&state.progression.surveys.includes(mark.biome)}));
    markers.push(...explorationMapMarkers(state.exploration));
    if(state.vehicle?.parked!==false&&state.vehicle?.position){unit(state.vehicle.position);markers.push({id:'vehicle',kind:'vehicle',label:'停车点',symbol:'车',position:{...state.vehicle.position}});}
    markers.unshift({id:'player',kind:'player',label:'当前位置',symbol:'▲',position:{...state.position}});
    for(const mark of markers)Object.assign(mark,projectPlanet(mark.position,projection),sphericalNavigation(state.position,mark.position,radius));
    const placed=[];
    for(const mark of markers){let display;
      for(let ring=0;ring<=markers.length&&!display;ring++)for(const [dx,dy]of ring===0?[[0,0]]:[[0,-ring*22],[0,ring*22],[-ring*22,0],[ring*22,0],[-ring*22,-ring*22],[ring*22,ring*22]]){
        const point={x:Math.max(9,Math.min(width-9,mark.x+dx)),y:Math.max(9,Math.min(height-9,mark.y+dy))};
        if(placed.every(p=>Math.hypot(p.x-point.x,p.y-point.y)>=20)){display=point;break;}}
      if(!display)throw new Error('Map too small to place markers');
      mark.displayX=display.x;mark.displayY=display.y;placed.push(display);
    }
    const current=toGeodetic(state.position,radius);
    return {projection:'equirectangular',width,height,seed:field.planet.seed,radius,terrainLabels:atlas.labels,player:{...current,latitudeDegrees:current.lat*180/Math.PI,longitudeDegrees:wrap(current.lon)*180/Math.PI},markers,legend:markers.filter(m=>m.kind!=='player').map(m=>({id:m.id,label:m.label,status:m.status??'',number:m.kind==='survey'?Number(m.symbol):null,symbol:m.symbol,position:{...m.position},completed:m.completed??false,distance:m.distance,bearing:m.bearing}))};
  }
  function target(mark,state){const position={...mark.position};return {id:mark.id,kind:mark.kind,name:mark.label,label:mark.label,position,...toGeodetic(position,radius),...sphericalNavigation(state.position,position,radius)};}
  return Object.freeze({
    model,
    render(state){const view=model(state);
      const icons=view.markers.slice().sort((a,b)=>(a.kind==='player')-(b.kind==='player')).map(mark=>{
        const color=mark.kind==='player'?'#fff4d3':mark.completed?'#d0edbd':mark.kind==='vehicle'?'#ffe0a0':'#f0e6c9';
        const title=escapeXml(`${mark.label} · ${(mark.distance/1000).toFixed(1)}公里${mark.status?' · '+mark.status:mark.completed?' · 已完成':''}`);
        const line=`<path d="M${mark.x} ${mark.y}L${mark.displayX} ${mark.displayY}" stroke="${color}" stroke-width="1" style="pointer-events:none"/>`;
        return `${line}<g transform="translate(${mark.displayX},${mark.displayY})"${mark.kind==='player'?' style="pointer-events:none"':` data-target="${escapeXml(mark.id)}" role="button" tabindex="0" aria-label="${title}"`}><title>${title}</title><circle r="8" fill="#4e4638" stroke="${color}" stroke-width="1.5"/><text y="4" text-anchor="middle" font-size="11" font-family="sans-serif" fill="${color}">${escapeXml(mark.symbol)}</text></g>`;
      }).join('');
      return {model:view,svg:`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="星球全球地图：上北下南，横向经度，纵向纬度" style="display:block;overflow:hidden"><title>星球全球地图</title>${background}${icons}</svg>`};
    },
    select(id,state){const mark=model(state).markers.find(m=>m.id===id&&m.kind!=='player');return mark?target(mark,state):null;},
    pick({x,y},state,{hitRadius=10}={}){
      const direction=unprojectPlanet({x,y},projection),view=model(state);
      const closest=view.markers.filter(m=>m.kind!=='player').map(m=>({mark:m,distance:Math.hypot(Math.min(Math.abs(m.displayX-x),width-Math.abs(m.displayX-x)),m.displayY-y)})).sort((a,b)=>a.distance-b.distance)[0];
      if(closest&&closest.distance<=hitRadius)return target(closest.mark,state);
      return target({id:'point',kind:'point',label:'地图目标',position:field.surfacePoint(direction)},state);
    }
  });
}
