// C suit bind pose, metres. Source clips are retargeted into these local axes.
export const HUMANOID_RIG = [
  ['pelvis',-1,[0,1.01,0],'pelvis'],
  ['waist',0,[0,.04,0],'spine_01'],
  ['lumbar',1,[0,.16,0],'spine_02'],
  ['chest',2,[0,.20,0],'spine_03'],
  ['head',3,[0,.351,-.006],'Head'],
  ['clavicleL',3,[-.170,.118,0],'clavicle_l'],
  ['shoulderL',5,[-.045,-.020,0],'upperarm_l'],
  ['elbowL',6,[0,-.30,0],'lowerarm_l'],
  ['wristL',7,[0,-.277,0],'hand_l'],
  ['clavicleR',3,[.170,.118,0],'clavicle_r'],
  ['shoulderR',9,[.045,-.020,0],'upperarm_r'],
  ['elbowR',10,[0,-.30,0],'lowerarm_r'],
  ['wristR',11,[0,-.277,0],'hand_r'],
  ['hipL',0,[-.087,0,0],'thigh_l'],
  ['kneeL',13,[0,-.445,0],'calf_l'],
  ['ankleL',14,[0,-.445,0],'foot_l'],
  ['hipR',0,[.087,0,0],'thigh_r'],
  ['kneeR',16,[0,-.445,0],'calf_r'],
  ['ankleR',17,[0,-.445,0],'foot_r'],
];
export const MOTION_VERSION='C2-IDLE-FIX-20260909';
