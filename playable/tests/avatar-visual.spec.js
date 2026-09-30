const { test, expect } = require('@playwright/test');
const esbuild = require('esbuild');
const path = require('node:path');

test('C suit human proportions and actual front/back model reference', async ({ page }) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.setContent('<style>body{margin:0;background:#242522;color:#ddd4c2;font:18px sans-serif}main{display:flex}section{width:33.333%;position:relative}canvas{display:block;width:100%}h1{font-size:23px;font-weight:400;margin:24px}h2{font-size:16px;font-weight:400;position:absolute;top:8px;left:20px}footer{padding:14px 24px;font-size:14px}</style><h1>C / 玄壳共生服 · 实际游戏模型检视</h1><main><section id="front"><h2>正面</h2></section><section id="back"><h2>背面</h2></section><section id="field"><h2>第三人称距离</h2></section></main><footer>同一套可动画三维网格 · 非概念图 / 非贴图替身 · 左中为检视布光，右为低照度检视</footer>');
  const bundle = await esbuild.build({ stdin: { resolveDir: path.resolve(__dirname, '../..'), contents: `
    import * as THREE from 'three';
    import { createAvatar } from './playable/src/avatar.mjs';
    import { createGait, updateGait, gaitView } from './playable/src/gait.mjs';
    const views = [['front',[.12,1.07,-4.1]],['back',[-.08,1.07,4.1]],['field',[.48,2.12,4.3]]];
    const results=[],poseChecks=[];
    for (const [id,position] of views) {
      const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1.5);renderer.setSize(512,858);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
      document.getElementById(id).appendChild(renderer.domElement);
      const scene=new THREE.Scene();scene.background=new THREE.Color(id==='field'?'#302932':'#383934');
      scene.add(new THREE.HemisphereLight(id==='field'?'#b7acdb':'#f6efd8',id==='field'?'#71606f':'#716856',id==='field'?1.8:2.5));
      const sun=new THREE.DirectionalLight('#fff0d2',id==='field'?1.05:3.2);sun.position.set(-3,5,-2);scene.add(sun);
      const fill=new THREE.DirectionalLight('#b9c6d3',id==='field'?.35:1.2);fill.position.set(2,3,4);scene.add(fill);
      const floor=new THREE.Mesh(new THREE.PlaneGeometry(50,50),new THREE.MeshStandardMaterial({color:id==='field'?'#564b55':'#55584d',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.04;scene.add(floor);
      const materials=[],avatar=createAvatar(materials);scene.add(avatar.root);avatar.update({x:0,z:0,y:0,yaw:0,pitch:0},{moving:false,time:0,mobility:{}},0,1/60);
      const camera=new THREE.PerspectiveCamera(id==='field'?35:32,512/858,.05,80);camera.position.set(...position);camera.lookAt(0,id==='field'?.95:.94,0);
      renderer.render(scene,camera);
      const helmetBounds=()=>{const box=new THREE.Box3(),vertex=new THREE.Vector3();avatar.root.traverse(part=>{if(!part.isSkinnedMesh)return;const indices=part.geometry.attributes.skinIndex;for(let i=0;i<indices.count;i++)if(indices.getX(i)===4){part.getVertexPosition(i,vertex);box.expandByPoint(vertex.applyMatrix4(part.matrixWorld));}});return box;};
      const box=new THREE.Box3();avatar.root.traverse(part=>{if(part.isMesh&&part.name!=='explorer-contact-shadow'&&part.visible){if(part.isSkinnedMesh){part.computeBoundingBox();box.union(part.boundingBox.clone().applyMatrix4(part.matrixWorld));}else{part.geometry.computeBoundingBox();box.union(part.geometry.boundingBox.clone().applyMatrix4(part.matrixWorld));}}});
      const helmetBox=helmetBounds();
      results.push({name:id,proportions:avatar.root.userData.proportions,top:box.max.y,height:box.max.y-box.min.y,helmetHeight:helmetBox.max.y-helmetBox.min.y,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
      if(id==='back')for(const pose of ['sprint','flight','seated']){
        const player={x:0,z:0,y:pose==='flight'?2:0,yaw:.18,pitch:.1,vx:0,vz:pose==='sprint'?-8.6:0};
        const gait=createGait(player,()=>({height:0,surface:'dust'}));
        const view={moving:pose==='sprint',sprinting:pose==='sprint',time:1,mobility:{flight:{airborne:pose==='flight',thrusting:pose==='flight'},vehicle:{mounted:pose==='seated',yaw:0}}};
        for(let i=0;i<90;i++){
          player.z+=player.vz/60;updateGait(gait,{player,dt:1/60,grounded:pose==='sprint',mounted:pose==='seated'});
          avatar.update(player,{...view,gait:gaitView(gait)},0,1/60);
        }
        let invalid=false;avatar.root.traverse(part=>{if(part.isMesh){const p=part.geometry.getAttribute('position');for(let i=0;i<p.array.length;i++)if(!Number.isFinite(p.array[i]))invalid=true;}if(part.matrixWorld.elements.some(v=>!Number.isFinite(v)))invalid=true;});
        const bounds=helmetBounds();
        poseChecks.push({pose,invalid,helmetHeight:bounds.max.y-bounds.min.y,helmetY:bounds.min.y});
      }
      if(id==='back'){for(let i=0;i<90;i++)avatar.update({x:0,z:0,y:0,yaw:0,pitch:0},{moving:false,time:0,mobility:{}},0,1/60);renderer.render(scene,camera);}
    }
    window.avatarInspection=results;window.avatarPoseChecks=poseChecks;
  ` }, bundle: true, format: 'iife', write: false });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.waitForFunction(() => window.avatarInspection?.length === 3);
  const result = await page.evaluate(() => avatarInspection);
  await page.screenshot({ path: 'docs/ui-implementation/c-suit-model-review.png' });
  expect(errors).toEqual([]);
  for (const view of result) {
    expect(view.proportions.height / view.proportions.helmetHeight).toBeGreaterThan(7.5);
    // Relaxed knees and a tilted helmet change the world-axis bounding ratio;
    // the unposed anatomical ratio above still requires > 7.5 heads.
    expect(view.height / view.helmetHeight).toBeGreaterThan(7);
    expect(view.height / view.helmetHeight).toBeLessThan(8.2);
    expect(view.top).toBeGreaterThan(1.80); expect(view.top).toBeLessThan(1.89);
    expect(view.calls).toBeLessThan(100);
    expect(view.triangles).toBeLessThan(45000);
  }
  const poses=await page.evaluate(()=>avatarPoseChecks);
  for(const pose of poses){expect(pose.invalid,pose.pose).toBeFalsy();expect(pose.helmetHeight).toBeLessThan(.3);expect(pose.helmetHeight).toBeGreaterThan(.20);}
  // Authored suspension bends the torso slightly more than the former rigid pose.
  expect(poses.find(p=>p.pose==='flight').helmetY).toBeGreaterThan(3.45);
  await page.screenshot({ path: 'docs/ui-implementation/c-suit-model-review.png' });
});
