const { test, expect } = require('@playwright/test');
const esbuild = require('esbuild');
const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL}=require('node:url');

test('four-direction continuous preview: real walk, jog and sprint silhouettes', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({width:1440,height:1200});
  const previewPath=path.resolve(__dirname,'../../docs/ui-implementation/human-locomotion-preview.html');
  const html=fs.readFileSync(previewPath,'utf8').replace('<script src="./human-locomotion-preview.js"></script>','');
  await page.setContent(html);await page.evaluate(()=>{window.__GAIT_PREVIEW_TEST__=true;});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const bundle=await esbuild.build({entryPoints:[path.resolve(__dirname,'gait-preview.mjs')],bundle:true,format:'iife',minify:true,write:false});
  await esbuild.build({entryPoints:[path.resolve(__dirname,'gait-preview.mjs')],bundle:true,format:'iife',minify:true,outfile:path.resolve(__dirname,'../../docs/ui-implementation/human-locomotion-preview.js')});
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.evaluate(()=>{gaitPreview.setStress(true);gaitPreview.advance(2);});
  const sprintFrames=await page.evaluate(()=>gaitPreview.advance(2,{capture:true}));
  await page.screenshot({path:'docs/ui-implementation/human-four-direction-stress.png',fullPage:true});
  await page.evaluate(()=>{gaitPreview.setStress(false);gaitPreview.advance(1);});
  await page.screenshot({path:'docs/ui-implementation/human-four-direction-sprint.png',fullPage:true});
  await page.evaluate(()=>gaitPreview.setCamera('side'));
  await page.screenshot({path:'docs/ui-implementation/human-four-direction-side.png',fullPage:true});
  await page.evaluate(()=>{gaitPreview.setSpeed(4.7);gaitPreview.setCamera('rear');gaitPreview.advance(1);});
  const jogFrames=await page.evaluate(()=>gaitPreview.advance(2,{capture:true}));
  await page.screenshot({path:'docs/ui-implementation/human-four-direction-jog.png',fullPage:true});
  await page.evaluate(()=>gaitPreview.setCamera('back'));
  await page.screenshot({path:'docs/ui-implementation/human-four-direction-back.png',fullPage:true});
  await page.evaluate(()=>gaitPreview.setCamera('rear'));
  const metrics=[];
  for(const[label,frames]of[['sprint',sprintFrames],['jog',jogFrames]])for(let i=0;i<8;i++){
    const poses=frames.map(frame=>frame[i]),feet=poses.flatMap(p=>p.feet),support=feet.filter(f=>f.stance);
    const shoulders=poses.map(p=>p.arms[0].shoulder[0]),elbows=poses.map(p=>p.arms[0].elbow);
    const turning=poses.filter(p=>Math.abs(p.pelvisWorldYaw-p.headingYaw)>.015);
    const counter=turning.filter(p=>(p.pelvisWorldYaw-p.headingYaw)*(p.chestWorldYaw-p.headingYaw*.25)<0).length/Math.max(1,turning.length);
    const gap=pose=>{const left=pose.feet.find(f=>f.side<0),right=pose.feet.find(f=>f.side>0);return (right.soleCenter[0]-left.soleCenter[0])*Math.cos(pose.headingYaw)-(right.soleCenter[2]-left.soleCenter[2])*Math.sin(pose.headingYaw);};
    const separation=pose=>{const a=pose.feet[0].soleCenter,b=pose.feet[1].soleCenter;return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);};
    const kneeGap=pose=>{const a=pose.feet.find(f=>f.side>0).joints.knee,b=pose.feet.find(f=>f.side<0).joints.knee;return(a[0]-b[0])*Math.cos(pose.headingYaw)-(a[2]-b[2])*Math.sin(pose.headingYaw);};
    const metric={label,id:poses[0].id,maxError:Math.max(...feet.map(f=>f.error)),maxSupportError:Math.max(...support.map(f=>f.error)),shoulderRange:Math.max(...shoulders)-Math.min(...shoulders),elbowRange:Math.max(...elbows)-Math.min(...elbows),counter,lowestHip:Math.min(...poses.map(p=>p.pelvis.position[1])),minSoleGap:Math.min(...poses.map(gap)),minSoleSeparation:Math.min(...poses.map(separation)),minKneeGap:Math.min(...poses.map(kneeGap))};metrics.push(metric);
    expect(metric.maxError,JSON.stringify(metric)).toBeLessThan(.045);
    expect(metric.maxSupportError,JSON.stringify(metric)).toBeLessThan(.025);
    const handTravel=poses.map(p=>p.arms[0].joints.wrist[2]-p.arms[0].joints.shoulder[2]);
    const handSide=poses.map(p=>p.arms[0].joints.wrist[0]-p.arms[0].joints.shoulder[0]);
    // Check visible hand travel; local Euler X is not the retargeted arm's flexion axis.
    expect(Math.max(Math.max(...handTravel)-Math.min(...handTravel),Math.max(...handSide)-Math.min(...handSide)),JSON.stringify(metric)).toBeGreaterThan(.15);
    expect(metric.elbowRange,JSON.stringify(metric)).toBeGreaterThan(.09);
    // Imported clip rotations replace the previous hand-coded counter-yaw rule.
    // Verify the actual full rig and changing body pose, not the old sine formula.
    const {MOTION_VERSION}=await import('../src/humanoid-rig.mjs');
    expect(poses.every(p=>p.version===MOTION_VERSION&&p.bones===19)).toBeTruthy();
    expect(poses.every(p=>Math.abs(p.headingYaw)<1e-6),'lateral/reverse steps must preserve physical heading').toBeTruthy();
    expect(new Set(poses.map(p=>p.chest.join(','))).size).toBeGreaterThan(20);
    expect(metric.lowestHip,JSON.stringify(metric)).toBeGreaterThan(.70);
    if(metric.id.endsWith('left')||metric.id.endsWith('right')){
      expect(metric.minSoleGap,JSON.stringify(metric)).toBeGreaterThan(.10);
      expect(metric.minSoleSeparation,JSON.stringify(metric)).toBeGreaterThan(.14);
      expect(metric.minKneeGap,JSON.stringify(metric)).toBeGreaterThan(.10);
    }
    for(const pose of poses)expect(JSON.stringify(pose)).not.toMatch(/null/);
  }
  console.log('DIRECTIONAL_POSES',JSON.stringify(metrics));
  expect(metrics.find(m=>m.label==='sprint'&&m.id==='run-forward').elbowRange).not.toBeCloseTo(metrics.find(m=>m.label==='jog'&&m.id==='run-forward').elbowRange,2);
  expect(errors).toEqual([]);
  await page.evaluate(()=>{gaitPreview.setSpeed(8.6);gaitPreview.reset();gaitPreview.advance(2);});
  for(let frame=0;frame<8;frame++){
    await page.evaluate(()=>gaitPreview.advance(.125));
    await page.screenshot({path:'docs/ui-implementation/human-four-direction-phase-'+String(frame+1).padStart(2,'0')+'.png',fullPage:true});
  }
  // Validate the deliverable itself via file://, not only an injected bundle.
  await page.goto(pathToFileURL(previewPath).href);
  await page.waitForFunction(()=>window.gaitPreview?.snapshot()[4].speed>8.59);
  const native=await page.evaluate(()=>gaitPreview.snapshot());
  for(const [index,expectedSpeed]of [[0,1.65],[1,1.2],[2,1.3],[3,1.3],[5,2.2],[6,2.4],[7,2.4]])expect(native[index].speed).toBeCloseTo(expectedSpeed,1);
  await page.locator('#pause-preview').click();
  const frozen=await page.evaluate(()=>JSON.stringify(gaitPreview.snapshot()));
  await page.waitForTimeout(150);
  expect(await page.evaluate(()=>JSON.stringify(gaitPreview.snapshot()))).toEqual(frozen);
  await page.selectOption('#camera-angle','back');
  await page.screenshot({path:'docs/ui-implementation/human-four-direction-live-preview.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('contact-driven human gait: eight real walking and sprinting frames, IK and transitions', async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1440, height: 1840 });
  await page.setContent('<style>body{margin:0;background:#202520;color:#e2ddcf;font:15px sans-serif}h1{font-size:23px;margin:20px}h2{margin:14px 20px;font-size:18px}main{display:grid;grid-template-columns:repeat(4,1fr)}figure{margin:0;position:relative}canvas{display:block;width:100%}figcaption{position:absolute;bottom:10px;left:14px;background:#15201ac9;padding:6px}footer{margin:15px 20px}</style><h1>C / 玄壳共生服 · 同步真实移动的步态序列</h1><h2 id="walk-title">C 慢走 1.65 m/s · 身体换重 / 脚跟触地 / 对侧摆臂</h2><main id="walk"></main><h2>前进冲刺 8.6 m/s · 屈膝回收 / 屈肘摆臂 / 短暂腾空</h2><main id="run"></main><footer>每行连续 4 帧；每组按实时相位推进，用八个采样点覆盖一个周期，不硬编码步频或独立动画计时器。</footer>');
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const bundle = await esbuild.build({ stdin:{resolveDir:path.resolve(__dirname,'../..'),contents:`
    import * as THREE from 'three';
    import {createAvatar} from './playable/src/avatar.mjs';
    import {createGait,updateGait,gaitView} from './playable/src/gait.mjs';
    const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(360,404);renderer.setPixelRatio(1.5);renderer.toneMapping=THREE.ACESFilmicToneMapping;
    const scene=new THREE.Scene();scene.background=new THREE.Color('#343b34');
    scene.add(new THREE.HemisphereLight('#efe8cf','#777360',2.2));
    const key=new THREE.DirectionalLight('#fff0d1',3);key.position.set(-3,5,2);scene.add(key);
    const fill=new THREE.DirectionalLight('#bfccdb',1.3);fill.position.set(2,3,-4);scene.add(fill);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.MeshStandardMaterial({color:'#56594c',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.001;scene.add(floor);
    const grid=new THREE.GridHelper(300,300,'#636a58','#5d6254');grid.position.y=.001;scene.add(grid);
    const avatar=createAvatar([]);scene.add(avatar.root);
    const camera=new THREE.PerspectiveCamera(32,360/404,.05,300);
    const sample=()=>({height:0,surface:'dust'}),dt=1/120,records=[],cycles=[];
    let player={x:0,y:0,z:0,heading:0,yaw:0,pitch:0,vx:0,vz:0},gait=createGait(player,sample),time=0;
    function tick(speed,dir=[0,-1],extra={}){
      player.vx=dir[0]*speed;player.vz=dir[1]*speed;player.x+=player.vx*dt;player.z+=player.vz*dt;time+=dt;
      updateGait(gait,{player,dt,grounded:!extra.airborne,mounted:!!extra.mounted,sampleGround:sample});
      const view={gait:gaitView(gait),time,mobility:{flight:{airborne:!!extra.airborne,thrusting:!!extra.airborne},vehicle:{mounted:!!extra.mounted,yaw:0}}};
      avatar.update(player,view,0,dt);const pose=avatar.poseSnapshot();records.push(pose);return pose;
    }
    function renderFrame(id,i,pose){
      camera.position.set(player.x+2.8,1.90,player.z+3.6);camera.lookAt(player.x,.95,player.z);
      const contact=avatar.root.getObjectByName('explorer-contact-shadow'),vertices=contact.geometry.getAttribute('position');contact.visible=true;
      for(let j=0;j<vertices.count;j++)vertices.setY(j,.006);vertices.needsUpdate=true;
      renderer.render(scene,camera);const figure=document.createElement('figure'),canvas=document.createElement('canvas');canvas.width=540;canvas.height=606;
      canvas.getContext('2d').drawImage(renderer.domElement,0,0,540,606);figure.appendChild(canvas);
      const caption=document.createElement('figcaption');caption.textContent=(i+1)+' / 相位 '+pose.phase.toFixed(2)+' · '+pose.feet.filter(f=>f.stance).length+' 足支撑';figure.appendChild(caption);document.getElementById(id).appendChild(figure);
    }
    function captureCycle(id,speed){
      let traveled=0,previous=gait.phase,samples=[];
      for(let frame=0;frame<8;frame++){
        let pose,safety=0;
        while(traveled<(frame+1)/8){
          pose=tick(speed);traveled+=(pose.phase-previous+1)%1;previous=pose.phase;
          if(++safety>1000)throw new Error('Contact phase stopped while sampling '+id);
        }
        samples.push(pose.phase);renderFrame(id,frame,pose);
      }
      cycles.push({id,speed,traveled,samples});
    }
    for(const[id,speed]of[['walk',1.65],['run',8.6]]){
      player={x:0,y:0,z:0,heading:0,yaw:0,pitch:0,vx:0,vz:0};gait=createGait(player,sample);
      for(let i=0;i<240;i++)tick(speed);
      captureCycle(id,speed);
    }
    const variants={};
    // Extra 2 m/s transition fixtures, not advertised as the game's default gait.
    for(const[name,speed,dir]of[['reverse',2,[0,1]],['strafe-left',2,[-1,0]],['strafe-right',2,[1,0]],['stop',0,[0,-1]]]){
      const poses=[];for(let i=0;i<180;i++)poses.push(tick(speed,dir));variants[name]=poses.slice(-90);
    }
    const turnStart=gait.stepCount,turn=[];
    for(let i=0;i<180;i++){player.heading+=Math.PI/2/180;turn.push(tick(0));}
    for(let i=0;i<90;i++)turn.push(tick(0));variants.turn=turn;
    const turnSteps=gait.stepCount-turnStart;
    const before=avatar.poseSnapshot();avatar.root.visible=false;
    for(let i=0;i<60;i++)tick(1.65);avatar.root.visible=true;
    const afterHidden=avatar.poseSnapshot();
    const paused=JSON.stringify(afterHidden);avatar.update(player,{gait:gaitView(gait),mobility:{}},0,0);
    const pauseStable=paused===JSON.stringify(avatar.poseSnapshot());
    const transitions=[];for(const extra of [{airborne:true},{},{mounted:true},{}])for(let i=0;i<90;i++)transitions.push(tick(0,[0,-1],extra));
    window.gaitInspection={records,variants,before,afterHidden,pauseStable,transitions,turnSteps,cycles};
    window.inspectDefaultMovement=()=>{
      document.getElementById('walk').replaceChildren();document.getElementById('walk-title').textContent='W 常速 4.7 m/s · 慢跑 / 换重 / 对侧摆臂';
      player={x:0,y:0,z:0,heading:0,yaw:0,pitch:0,vx:0,vz:0};gait=createGait(player,sample);
      for(let i=0;i<240;i++)tick(4.7);
      captureCycle('walk',4.7);
    };
  `},bundle:true,format:'iife',write:false});
  await page.addScriptTag({content:bundle.outputFiles[0].text});
  await page.screenshot({path:'docs/ui-implementation/human-walk-sequence.png',fullPage:true});
  await page.evaluate(()=>inspectDefaultMovement());
  const result=await page.evaluate(()=>gaitInspection);
  await page.screenshot({path:'docs/ui-implementation/human-gait-sequence.png',fullPage:true});
  console.log('GAIT_METRICS',JSON.stringify({maxError:Math.max(...result.records.flatMap(p=>p.feet.map(f=>f.error))),maxSupportError:Math.max(...result.records.flatMap(p=>p.feet.filter(f=>f.stance).map(f=>f.error))),turnSteps:result.turnSteps,variants:Object.fromEntries(Object.entries(result.variants).map(([key,poses])=>[key,Math.max(...poses.flatMap(p=>p.feet.map(f=>f.error)))]))}));
  expect(errors).toEqual([]);
  const walking=result.records.filter(p=>p.mode==='locomotion');
  for(const p of [...walking,...result.transitions]){
    expect(JSON.stringify(p)).not.toMatch(/null/);
    for(const f of p.feet){expect(f.error,`phase ${p.phase} / side ${f.side} / ${p.mode}`).toBeLessThan(.035);if(f.stance){expect(f.error).toBeLessThan(.015);expect(f.actual[1]).toBeGreaterThan(-.015);}}
  }
  expect(Math.max(...walking.flatMap(p=>p.feet.map(f=>Math.abs(f.knee[0]))))).toBeGreaterThan(.85);
  expect(Math.max(...walking.filter(p=>p.runBlend>.8).flatMap(p=>p.arms.map(a=>a.elbow)))).toBeGreaterThan(1.0);
  expect(walking.some(p=>p.feet.every(f=>!f.stance))).toBeTruthy();
  const arms=walking.filter(p=>p.weight>.8).map(p=>p.arms[0].joints.wrist[2]-p.arms[1].joints.wrist[2]);
  expect(Math.min(...arms)).toBeLessThan(-.18);expect(Math.max(...arms)).toBeGreaterThan(.18);
  expect(result.pauseStable).toBeTruthy();expect(result.before.phase).not.toEqual(result.afterHidden.phase);
  expect(result.turnSteps).toBeGreaterThan(0);expect(result.turnSteps).toBeLessThanOrEqual(6);
  expect(result.cycles.map(c=>c.speed)).toEqual([1.65,8.6,4.7]);
  for(const cycle of result.cycles){expect(cycle.samples).toHaveLength(8);expect(cycle.traveled).toBeGreaterThanOrEqual(1);expect(cycle.traveled).toBeLessThan(1.04);}
  for(const poses of Object.values(result.variants))for(const p of poses)for(const f of p.feet)expect(f.error).toBeLessThan(.035);
});
