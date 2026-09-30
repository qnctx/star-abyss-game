import {Quaternion,Euler} from 'three';
import {SKILLS} from './definitions.mjs';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const q=new Quaternion(),e=new Euler();
// Joint-space action keys authored from concept/six-skills.png. The native C2
// skeleton receives these through the existing retargeter after locomotion/IK.
export const POSES={
 WS01:{wind:[[1,0,-.65,0],[3,.12,-.5,-.1],[6,.4,0,-.6],[7,1.2,0,0],[10,.8,-.5,-1.1],[11,1.3,0,0],[12,0,0,.3]],release:[[1,.08,.55,0],[3,.08,.5,.12],[6,.5,0,-.3],[7,.9,0,0],[10,1.3,.6,.55],[11,.12,0,0],[12,0,0,-.12]]},
 WS03:{wind:[[1,.02,-.35,0],[3,.1,-.25,0],[6,.2,0,-.5],[7,.9,0,0],[10,.75,-.15,-.25],[11,1.6,0,0],[12,0,0,0]],release:[[1,.18,.25,0],[3,.18,.2,0],[6,.4,0,-.7],[7,.5,0,0],[10,1.6,0,.1],[11,.03,0,0],[12,0,0,0]]},
 ES05:{wind:[[1,.02,-.16,0],[3,.04,-.12,0],[6,.45,0,-.5],[7,1.6,0,0],[10,.5,-.2,.2],[11,1.6,0,0],[12,-.3,0,0]],release:[[1,.05,.16,0],[3,.05,.2,0],[6,.6,0,-.4],[7,1.1,0,0],[10,1.65,0,.1],[11,.1,0,0],[12,-.5,0,0]]},
 ES13:{wind:[[1,0,-.1,0],[3,-.1,-.1,0],[6,.6,0,-.5],[7,1.7,0,0],[10,2.3,0,.15],[11,.7,0,0],[12,.1,0,0]],release:[[1,.12,.12,0],[3,.18,.2,0],[6,.5,0,-.5],[7,1.1,0,0],[10,1.5,0,.1],[11,.12,0,0],[12,-.5,0,0]]},
 HS04:{wind:[[1,.04,.2,0],[3,.08,.2,0],[6,.9,0,-.4],[7,1.4,0,0],[10,.8,0,.4],[11,1.4,0,0]],release:[[1,.08,.1,0],[3,.1,.1,0],[6,1.35,0,-.18],[7,.5,0,0],[10,1.35,0,.18],[11,.5,0,0],[12,-.6,0,0]]},
 HS06:{wind:[[1,0,0,0],[3,.08,0,0],[6,.9,0,-.25],[7,1.6,0,0],[10,.9,0,.25],[11,1.6,0,0]],release:[[1,-.04,0,0],[3,-.1,0,0],[6,.8,0,-1.05],[7,.2,0,0],[10,.8,0,1.05],[11,.2,0,0]]}
};
export function applySkillPose(bones,combat){
 const view=combat?.skills,time=view?.time,c=view?.casts?.find(c=>!c.interrupted&&time>=c.start&&time<c.end);
 if(!c){if(!view?.weapon)return null;for(const [i,x,y,z]of [[10,.95,-.15,.18],[11,.65,0,0],[12,0,0,0]]){q.setFromEuler(e.set(x,y,z,'XYZ'));bones[i]?.quaternion.slerp(q,.85);}return {yaw:combat.player?.yaw||0,phase:'ready'};}
 const d=SKILLS[c.skillId],pose=POSES[c.skillId];if(!pose)return null;
 const anticipation=time<c.release,release=time<c.activeEnd+.1;
 const blend=anticipation?smooth((time-c.start)/d.windup):1-smooth((time-c.activeEnd)/d.recovery);
 const mix=anticipation?0:smooth((time-c.release)/Math.max(.06,d.activeDuration));
 for(const [i,x,y,z]of pose.wind){const r=pose.release.find(p=>p[0]===i)||[i,x,y,z];q.setFromEuler(e.set(x+(r[1]-x)*mix,y+(r[2]-y)*mix,z+(r[3]-z)*mix,'XYZ'));bones[i]?.quaternion.slerp(q,blend);}
 return {yaw:c.yaw,phase:anticipation?'anticipation':release?'active':'recovery',skillId:c.skillId};
}
