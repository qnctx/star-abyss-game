// Authoring units are metres; the GLB entrances face +Z in the original lunar camp.
export const CAMP_V2_BUILDINGS=Object.freeze([
 {id:'command',asset:'assets/camp-v2/command.glb',x:-17,z:174,yaw:0},
 {id:'medical',asset:'assets/camp-v2/medical.glb',x:4,z:174,yaw:0},
 {id:'workshop',asset:'assets/camp-v2/workshop.glb',x:20,z:174,yaw:0},
]);

// Work positions and approach positions are outside walls or through real open doorways.
// The live scene publishes these positions to F authorization and prompts.
export const CAMP_V2_PEOPLE=Object.freeze({
 N01:{home:{x:-17,z:177.25},work:{x:-17,z:175.7},radius:3.2},
 N02:{home:{x:4,z:177.2},work:{x:4.7,z:175.65},radius:3.2},
 N03:{home:{x:20,z:177.42},work:{x:20.55,z:177.3},radius:3.2},
 N04:{home:{x:26,z:181},work:{x:25.4,z:181.8},radius:3.2},
 N05:{home:{x:-9,z:184},work:{x:-9.6,z:184.8},radius:3.2},
});

export function campPersonHome(id){const person=CAMP_V2_PEOPLE[id];return person?{id,x:person.home.x,z:person.home.z,radius:person.radius}:null;}
