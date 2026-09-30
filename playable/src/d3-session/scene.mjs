import { baseResource } from '../d3-combat/index.mjs';
import { fixed, decimal } from '../d3-combat/fixed.mjs';

const check = (ok, code) => { if (!ok) throw Error(code); };
const plain = v => v && Object.getPrototypeOf(v) === Object.prototype;
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
const stableId = v => typeof v === 'string' && v.length > 0 && v.length <= 2048;
function keys(value, expected) {
  check(plain(value) && Object.keys(value).length === expected.length && expected.every(k => own(value,k)), 'invalidSceneFields');
}
const finite = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const defaultBounds = Object.freeze({xMin:-24,xMax:24,zMin:-49,zMax:18,pitchMin:-.3,pitchMax:.65});
function bounds(config) {
  if (!config || !own(config,'poseBounds')) return defaultBounds;
  const b=config.poseBounds;
  keys(b,['xMin','xMax','zMin','zMax','pitchMin','pitchMax']);
  check(['xMin','xMax','zMin','zMax'].every(k=>finite(b[k],-1e9,1e9)) && b.xMin<b.xMax && b.zMin<b.zMax &&
    finite(b.pitchMin,-Math.PI/2,Math.PI/2) && finite(b.pitchMax,-Math.PI/2,Math.PI/2) && b.pitchMin<b.pitchMax,'invalidPoseBounds');
  return b;
}
function pose(value, player = false, b = defaultBounds) {
  keys(value, player ? ['x','z','yaw','pitch',...(own(value,'y')?['y']:[])] : ['x','z','yaw',...(own(value,'y')?['y']:[])]);
  check(finite(value.x,b.xMin,b.xMax) && value.x>b.xMin && value.x<b.xMax && finite(value.z,b.zMin,b.zMax) && value.z>b.zMin && value.z<b.zMax &&
    finite(value.yaw,-Math.PI,Math.PI) && (!player || finite(value.pitch,b.pitchMin,b.pitchMax)) && (!own(value,'y')||finite(value.y,-1000,3500)), 'invalidScenePose');
}
export function validateSceneConfig(config) {
  keys(config,['playerId','safePoint',...(plain(config)&&own(config,'poseBounds')?['poseBounds']:[])]);
  check(stableId(config.playerId), 'invalidScenePlayer'); pose(config.safePoint,true,bounds(config));
  return config;
}
/** D1 XZ scene v1: bounded geometry/timings only; no inventory, stats or arbitrary extension bag. */
export function validateScene(scene, root, config) {
  keys(scene,['version','time','player','enemies','pending','cooldowns','hurt','logs',...(own(scene,'aerialMelee')?['aerialMelee']:[]),...(own(scene,'riftwings')?['riftwings']:[])]);
  check(scene.version===1 && finite(scene.time,0,1e12) && scene.time===root.simTime,'invalidSceneTime');
  if(config) validateSceneConfig(config);
  const b=bounds(config); pose(scene.player,true,b);
  const members=new Set(root.drops.map(d=>d.memberId));
  const actors=new Set(root.combat.actors.map(a=>a.id));
  if(config) {
    validateSceneConfig(config);
    check(actors.has(config.playerId) && !members.has(config.playerId),'invalidScenePlayer');
  }
  const map = (value, max, accept) => {
    check(plain(value) && Object.keys(value).length<=max,'invalidSceneMap');
    for(const [id, entry] of Object.entries(value)) { check(stableId(id) && actors.has(id) && accept(id),'invalidSceneActor'); }
  };
  const known = id => members.has(id) || (config ? id===config.playerId : actors.has(id));
  map(scene.enemies,16,id=>members.has(id));
  for(const enemy of Object.values(scene.enemies)) pose(enemy,false,b);
  map(scene.pending,17,known);
  for(const [actorId,p] of Object.entries(scene.pending)) {
    keys(p,['castId','start','due','end','yaw','committed','resolved',...(own(p,'kind')?['kind','pitch','origin','aim']:[])]);
    check(stableId(p.castId) && finite(p.start,0,scene.time) && finite(p.due,p.start,p.start+60) &&
      finite(p.end,p.due,p.start+60) && finite(p.yaw,-Math.PI,Math.PI) &&
      typeof p.committed==='boolean' && typeof p.resolved==='boolean','invalidScenePending');
    if(own(p,'kind'))check(['air-blade','afterimage-blade','rift-slash','void-break','void-break-great','scavenger-bolt','air-melee-jab','air-melee-cross','air-melee-kick','air-melee-uppercut','air-melee-lunge','riftwing-claw','riftwing-dive','riftwing-sweep'].includes(p.kind)&&
      finite(p.pitch,-1.35,1.35)&&plain(p.origin)&&plain(p.aim)&&
      [p.origin,p.aim].every(v=>Object.keys(v).length===3&&['x','y','z'].every(k=>finite(v[k],-4000,4000))),'invalidAerialCast');
    const cast=root.combat.casts.find(c=>c.castId===p.castId);
    check(cast && cast.sourceId===actorId && !cast.interrupted,'invalidSceneCast');
  }
  for(const [field,horizon] of [['cooldowns',3600],['hurt',60]]) {
    map(scene[field],17,known);
    check(Object.values(scene[field]).every(t=>finite(t,0,scene.time+horizon)),'invalidSceneTimer');
  }
  check(Array.isArray(scene.logs) && scene.logs.length<=30,'invalidSceneLogs');
  for(const entry of scene.logs) {
    keys(entry,['time','text']);
    check(finite(entry.time,0,scene.time) && typeof entry.text==='string' && entry.text.length<=200,'invalidSceneLogs');
  }
  if(own(scene,'aerialMelee')){
    const m=scene.aerialMelee;
    keys(m,['combo','lastContact','guarding','guardSince','guardYaw','guardMeter','guardBreakUntil','stunUntil','counterUntil','events','opponents']);
    check(Number.isInteger(m.combo)&&m.combo>=0&&m.combo<=3&&finite(m.lastContact,-1e12,scene.time)&&
      typeof m.guarding==='boolean'&&finite(m.guardSince,-1e12,scene.time)&&finite(m.guardYaw,-Math.PI,Math.PI)&&
      finite(m.guardMeter,0,100)&&finite(m.guardBreakUntil,0,scene.time+60)&&finite(m.stunUntil,0,scene.time+60)&&
      finite(m.counterUntil,0,scene.time+60),'invalidAerialMelee');
    check(Array.isArray(m.events)&&m.events.length<=24,'invalidAerialMeleeEvents');
    for(const e of m.events){
      keys(e,['id','kind','sourceId','targetId','position','direction','start','end']);
      check(stableId(e.id)&&typeof e.kind==='string'&&e.kind.length<=32&&stableId(e.sourceId)&&(!e.targetId||stableId(e.targetId))&&
        plain(e.position)&&plain(e.direction)&&['x','y','z'].every(k=>finite(e.position[k],-4000,4000)&&finite(e.direction[k],-100,100))&&
        finite(e.start,0,scene.time)&&finite(e.end,e.start,scene.time+60),'invalidAerialMeleeEvents');
    }
    check(plain(m.opponents)&&Object.keys(m.opponents).length<=16,'invalidAerialMeleeOpponents');
    for(const [id,o] of Object.entries(m.opponents)){
      check(members.has(id),'invalidAerialMeleeOpponent');
      keys(o,['guarding','guardSince','guardYaw','guardMeter','guardBreakUntil','stunUntil','reactUntil','impulseX','impulseY','impulseZ','impulseStart','impulseEnd','impulseApplied']);
      check(typeof o.guarding==='boolean'&&finite(o.guardSince,-1e12,scene.time)&&finite(o.guardYaw,-Math.PI,Math.PI)&&
        finite(o.guardMeter,0,100)&&finite(o.guardBreakUntil,0,scene.time+60)&&finite(o.stunUntil,0,scene.time+60)&&
        finite(o.reactUntil,0,scene.time+60)&&['impulseX','impulseY','impulseZ'].every(k=>finite(o[k],-100,100))&&
        finite(o.impulseStart,0,scene.time)&&finite(o.impulseEnd,0,scene.time+60)&&finite(o.impulseApplied,0,1),'invalidAerialMeleeOpponent');
    }
  }
  if(own(scene,'riftwings')){
    check(plain(scene.riftwings)&&Object.keys(scene.riftwings).length<=16,'invalidRiftwingState');
    for(const [id,w] of Object.entries(scene.riftwings)){
      check(members.has(id)&&own(scene.enemies,id),'invalidRiftwingActor');
      keys(w,['mode','modeSince','aggroUntil','stunUntil','lastMoved','impulseX','impulseY','impulseZ','impulseStart','impulseEnd','impulseApplied']);
      check(['ground','takeoff','air','landing','dead'].includes(w.mode)&&
        finite(w.modeSince,0,scene.time)&&
        finite(w.aggroUntil,0,scene.time+60)&&finite(w.stunUntil,0,scene.time+60)&&finite(w.lastMoved,0,scene.time)&&
        ['impulseX','impulseY','impulseZ'].every(k=>finite(w[k],-20,20))&&
        finite(w.impulseStart,0,scene.time)&&finite(w.impulseEnd,0,scene.time+60)&&finite(w.impulseApplied,0,1),'invalidRiftwingState');
    }
  }
  return true;
}

export function checkSceneRequest(request) {
  if(request.kind==='checkpoint' || request.kind==='rescue') {
    keys(request,['worldId','transactionId','expectedRevision','simTime','kind',...(request.kind==='checkpoint'?['scene']:[])]);
  }
}

/** Called only on the private root copy after current authorization succeeds. */
export function rescue(root, config) {
  check(config && root.scene, 'sceneConfigurationRequired'); validateSceneConfig(config);
  const player=root.combat.actors.find(a=>a.id===config.playerId);
  check(player && !root.drops.some(d=>d.memberId===config.playerId),'invalidScenePlayer');
  check(fixed(player.hp)===0n,'playerNotDefeated');
  // A's saved lethal result establishes a real defeat; an arbitrary initial HP=0 is not a rescue event.
  check(root.combat.hits.some(h=>!h.aliasOf && h.result?.defeated===true && h.result.target?.id===config.playerId &&
    fixed(h.result.target.hp)===0n),'defeatEvidenceRequired');
  check(fixed(player.maxHp)>0n,'invalidRescueHealth');
  player.hp=decimal(fixed(player.maxHp));
  player.resource=baseResource(player.realm,player.level);
  // No cast predating rescue can deliver any fresh segment against the recovered player/world.
  for(const cast of root.combat.casts) if(!cast.interrupted) cast.interrupted=true;
  root.scene={...root.scene,time:root.simTime,player:{...config.safePoint},pending:{},cooldowns:{},hurt:{}};
  validateScene(root.scene,root,config);
}
