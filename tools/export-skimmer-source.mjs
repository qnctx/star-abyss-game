import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createSkimmer} from '../playable/src/vehicle-model.mjs';
window.exportSkimmer=async()=>{
 const materials=[],vehicle=createSkimmer(materials);vehicle.update({x:0,z:0,yaw:0,repaired:true,mounted:true,battery:100,partTaken:true},0,{firstPerson:true});vehicle.root.position.set(0,0,0);
 const remove=[];vehicle.root.traverse(o=>{if(o.material?.isShaderMaterial)remove.push(o);});remove.forEach(o=>o.removeFromParent());
 vehicle.root.updateMatrixWorld(true);const bytes=new Uint8Array(await new GLTFExporter().parseAsync(vehicle.root,{binary:true,onlyVisible:true}));
 let b64='';for(let i=0;i<bytes.length;i+=8192)b64+=String.fromCharCode(...bytes.subarray(i,i+8192));return {base64:btoa(b64),bytes:bytes.length};
};
