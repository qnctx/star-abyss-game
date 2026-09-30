import {createAvatar} from './avatar.mjs';

// Reuse the shipped C2 skinned character and its reference-authored skeletal clips.
// This renderer never creates actors, changes HP, or resolves contacts.
export function createAerialSparringVisual(scene,materials){
  let actor=null,visible=false;
  return {update(combat,dt){
    const target=combat?.aerialMelee?.opponents?.find(e=>e.sparring!==false&&e.alive!==false);
    visible=!!target;
    if(!target){if(actor)actor.root.visible=false;return;}
    if(!actor){actor=createAvatar(materials);actor.root.name='aerial-sparring-c2';scene.add(actor.root);}
    actor.root.visible=true;
    const player={x:target.x,y:target.y,z:target.z,yaw:target.yaw||0,heading:target.yaw||0,pitch:0,posture:'stand'};
    actor.update(player,{time:combat.time,planetFrame:true,cameraMode:'third',innateFlight:{active:true,agl:20,speed:0,boosting:false},combat:{time:combat.time,aerialMelee:target}},target.y-20,dt);
  },snapshot:()=>({visible,pose:visible?actor?.poseSnapshot():null}),dispose(){if(actor){scene.remove(actor.root);actor.dispose();actor=null;}}};
}
