// Only run against your isolated checkout. Exact anchors fail closed on changed main.
const fs=require('fs');
const path='playable/src/main.mjs';let source=fs.readFileSync(path,'utf8');
const original=source;
const changes=[
 ["import { Vector3 } from 'three';", "import { Vector3 } from 'three';\nimport {TEST_LAB,testLabEnabled,testLabLink,openTestLabStorage} from './test-lab-storage.mjs';\nimport {createTestLab,seedTestLabGame,prepareTestLabSession} from './test-lab.mjs';"],
 ["const testing = new URLSearchParams(location.search).has('test');", "const labMode=testLabEnabled(location.search);\nlet testLab=null,labPanelOpen=false,labPreparing=false;\nconst testing = new URLSearchParams(location.search).has('test');"],
 ["const persistTest=testing&&", "const persistTest=labMode||testing&&"],
 ["const SAVE_KEY = persistTest?", "const SAVE_KEY = labMode?TEST_LAB.key:persistTest?"],
 ["expeditionLink=testing?", "expeditionLink=labMode?testLabLink(expeditionLink,fresh):testing?"],
 ["createExpeditionRuntime({link:expeditionLink,", "createExpeditionRuntime({...(labMode?{openStorage:openTestLabStorage,checkpointStorageName:TEST_LAB.db}:{}),link:expeditionLink,"],
 ["playing:legacy&&screen==='playing'&&!expeditionBlocked()", "playing:legacy&&(labPreparing||screen==='playing'&&!expeditionBlocked())"],
 ["isVisible(p){const v=", "isVisible(p){if(labPreparing)return false;const v="],
 ["return;}expeditionRuntime=runtime;", "return;}expeditionRuntime=runtime;\n    if(labMode){labPreparing=true;try{await prepareTestLabSession(runtime,()=>epoch===expeditionEpoch);}finally{labPreparing=false;}if(epoch!==expeditionEpoch)return;}"],
 ["loading:expeditionBlocked(),defeated:", "loading:labPanelOpen||expeditionBlocked(),defeated:"],
 ["  if(testing){applyPlanetFixture();applyPhysicsFixture();}", "  if(testing){applyPlanetFixture();applyPhysicsFixture();}\n  if(labMode)seedTestLabGame({story,mobility,evolution,planet:planetRuntime,serialize:serializeGame,discovered,points:allPoints()});"],
 ["  if(expeditionMenu||expeditionBlocked()||", "  if(labPanelOpen||expeditionMenu||expeditionBlocked()||"],
 ["planetRuntime.step({...controls,sprint:true},planetBoost)", "labPlanetStep({...controls,sprint:true},planetBoost)"],
 ["planetRuntime.step({...controls,sprint:false},dt-planetBoost)", "labPlanetStep({...controls,sprint:false},dt-planetBoost)"],
 ["planetRuntime?.step(controls,dt)", "labPlanetStep(controls,dt)"],
 ["if (testFrameFrozen) {", "if (testFrameFrozen || labPreparing || labPanelOpen && !sceneDirty && !expeditionLoading) {"],
 ["if(epoch===expeditionEpoch){expeditionLoading=false;refresh();}", "if(epoch===expeditionEpoch){expeditionLoading=false;if(labMode){sceneDirty=true;testLab?.refresh();}refresh();}"],
 ["setScreen('menu'); world.resize(); requestAnimationFrame(frame);", `function labPlanetStep(controls,dt){return testLab?testLab.step(controls,dt):planetRuntime?.step(controls,dt);}
if(labMode){
  testLab=createTestLab({planet:planetRuntime,context:()=>({player,mobility}),serialize:serializeGame,
    runtime:()=>expeditionRuntime,link:()=>expeditionLink,queries:expeditionQueries,
    ready:()=>screen==='playing'&&!expeditionBlocked(),
    block(value){labPanelOpen=value;input.clear();updateControlGate(false);},
    afterMove(){dash.active=false;dash.remaining=0;clearMobilityInput(mobility);player.spaceHoldTime=0;lookControl=createLookControl();resetLocomotion();input.clear();sceneDirty=true;save();updateMap();refresh();},
    inventory(){expeditionAction({type:'menu',open:true});},
    shutdown(){screen='menu';++expeditionEpoch;expeditionRuntime?.destroy();expeditionRuntime=null;},
  });
  document.querySelector('#start-button').firstChild.textContent='新建元婴测试档 ';
  document.querySelector('#continue-button').firstChild.textContent='继续元婴测试档 ';
  document.querySelector('.save-notice').textContent='独立元婴测试档 · 已完成调查 / 开放飞行 · 正式进度保持隔离';
  document.querySelector('#game-title').textContent='元婴测试实验室';
  window.__STAR_ABYSS_LAB__=Object.freeze({snapshot:()=>({lab:testLab.snapshot(),game:structuredClone(serializeGame()),root:expeditionRuntime?.snapshot(),planet:planetRuntime.snapshot(),loading:expeditionLoading,error:expeditionError}),show:()=>testLab.show()});
}
setScreen('menu'); world.resize(); requestAnimationFrame(frame);
if(labMode)continueGame();`],
];
fs.mkdirSync('docs/test-lab',{recursive:true});
fs.writeFileSync('docs/test-lab/main-integration.json',JSON.stringify(changes,null,2));
if(process.argv.includes('--export'))process.exit(0);
for(const [before,after]of changes){if(source.split(before).length!==2)throw Error('Ambiguous/missing integration anchor: '+before);source=source.replace(before,after);}
fs.writeFileSync('docs/test-lab/main.baseline.mjs',original);
fs.writeFileSync(path,source);
