import {createAvatar} from '../avatar.mjs';
import {INSTRUCTOR} from './runtime.mjs';
import {createSkillWeapon} from './weapons.mjs';
import {SKILLS} from './definitions.mjs';
// Reuse the verified C2 skin and skeleton unchanged. NPC-specific art is deferred.
export function createInstructor(scene,ground){const materials=[],avatar=createAvatar(materials);avatar.root.name='N06-QiYue-reused-C2';scene.add(avatar.root);
 let weapon=null,kind=null;
 const p={x:INSTRUCTOR.x,z:INSTRUCTOR.z,y:ground(INSTRUCTOR.x,INSTRUCTOR.z),yaw:Math.PI,heading:Math.PI,pitch:0,posture:'stand'};
 return {ready:avatar.assetReady,update(time,combat){avatar.root.visible=!!combat;if(!combat)return;const player=combat.player;if(player&&Math.hypot(player.x-p.x,player.z-p.z)<8){const target=Math.atan2(p.x-player.x,p.z-player.z);p.yaw+=Math.atan2(Math.sin(target-p.yaw),Math.cos(target-p.yaw))*.04;p.heading=p.yaw;}
  const training=combat?.skills?.casts?.find(c=>c.training&&!c.done&&!c.interrupted);const demonstration=training?{skills:{...combat.skills,casts:[{...training,yaw:p.yaw}]}}:null;
  const nextKind=SKILLS[training?.skillId]?.weapon||null;if(nextKind!==kind){weapon?.removeFromParent();weapon=nextKind?createSkillWeapon(nextKind):null;kind=nextKind;}
  if(weapon){const hand=avatar.root.getObjectByName('c2-native-wristR');if(hand&&weapon.parent!==hand)hand.add(weapon);}
  avatar.update(p,{time,cameraMode:'third',gait:null,combat:demonstration},p.y,1/60);avatar.root.visible=true;},dispose(){avatar.dispose();avatar.root.removeFromParent();materials.forEach(m=>m.dispose());}};
}
