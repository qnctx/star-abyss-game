import {aerialFootwork} from './aerial-footwork.mjs';
import {createSkillUI} from './combat-skills/ui.mjs';
import { Vector3 } from 'three';
import {createProgressionScene} from './progression-quests/scene.mjs';
import {createCampV2Scene} from './camp-v2/scene.mjs';
import {createProgressionControls} from './progression-quests/controls.mjs';
import {QUEST_LAB,questLabLink,openQuestLabStorage} from './progression-quests/lab-storage.mjs';
import {TEST_LAB,testLabEnabled,testLabLink,openTestLabStorage} from './test-lab-storage.mjs';
import {createTestLab,seedTestLabGame,prepareTestLabSession} from './test-lab.mjs';
import * as THREE from 'three';
import { createExpeditionRuntime } from './expedition-runtime/index.mjs';
import { createControlGate } from './expedition-runtime/control-gate.mjs';
import { waitForWorldAssets, createAssetStartupPanel } from './expedition-runtime/asset-startup.mjs';
import { createExpeditionQueries } from './expedition-runtime/queries.mjs';
import { bindLegacy } from './expedition-runtime/legacy.mjs';
import { definitions as expeditionDefinitions, createWorldQueries, createExpeditionWorld } from './expedition-world/index.mjs';
import { createExpeditionHUD } from './expedition-ui/index.mjs';
import { createScene } from './scene.mjs';
import { SCAN } from './scan-effect.mjs';
import { createDash, startDash, stepDash, serializeDash } from './dash.mjs';
import { createUI } from './ui.mjs';
import {createFlightHUD} from './flight-hud.mjs';
import { createStory, restoreStory, objective, interact, getJournal } from './story.mjs';
import { POINTS, WORLD, insideWreck, terrainHeight } from './layout.mjs';
import { createPlayer, restorePlayer, hasLineOfSight, turnPlayerHeading } from './movement.mjs';
import { createInput } from './input.mjs';
import {createLookControl,setFreeLook,applyMouseLook,updateLookControl,leaveVehicleLook} from './look-control.mjs';
import { createAudio } from './audio.mjs';
import { createStamina, prepareSprint, updateStamina, clearStaminaInput, serializeStamina, restoreStamina, staminaView } from './stamina.mjs';
import { createNavigation, restoreNavigation, setWaypoint, clearWaypoint, serializeNavigation, navigationView } from './navigation.mjs';
import { MOBILITY, createMobility, restoreMobility, serializeMobility, clearMobilityInput, stepMobility, mobilityAction, mobilityPoints, mobilityView, groundMobilityBlocked } from './mobility.mjs';
import {routeInnateTakeoff} from './innate-takeoff.mjs';
import { createEvolution, restoreEvolution, serializeEvolution, recordEvolutionMotion, evolutionStats, evolutionView, evolve } from './evolution.mjs';
import { createCalibration, setCalibrationValue, calibrationView, requiresCalibration } from './calibration.mjs';
import { createCalibrationUI } from './calibration-ui.mjs';
import { SURVEY_SITES } from './survey-sites.mjs';
import { createSurvey, restoreSurvey, serializeSurvey, surveyView, collectSurvey, archiveSurvey } from './survey.mjs';
import { createGait, updateGait, gaitView } from './gait.mjs';
import {createGroundCombatRecoil} from './ground-combat-recoil.mjs';
const groundCombatRecoil=createGroundCombatRecoil();
import {setPosture,updateTacticalControl} from './tactical-control.mjs';
import {createEquipment,useScanner,stowEquipment,updateEquipment,equipmentView} from './equipment-control.mjs';
import { sampleFooting, sampleImpact } from './footing.mjs';
import {createPlanetRuntime} from './planet-runtime.mjs';
import {createAscensionUI} from './ascension-ui.mjs';
import {createExplorationContent} from './exploration-content/runtime.mjs';
import {applyStaminaGrant} from './foundation/stamina-grant.mjs';
import {createCampUI} from './foundation/camp-ui.mjs';
import {createCampScene} from './foundation/camp-scene.mjs';
import {globalToLocal} from './planet/coordinates.mjs';
import {explorationMapMarkers} from './planet-map.mjs';

const questScenario=new URLSearchParams(location.search).get('questLab');
const questMode=['opening','breakthrough'].includes(questScenario);
let progressionScene=null,progressionControls=null,progressionMenu=false,campV2Scene=null;
const labMode=!questMode&&testLabEnabled(location.search);
let testLab=null,labPanelOpen=false,labPreparing=false;
const testing = new URLSearchParams(location.search).has('test');
const persistTest=questMode||labMode||testing&&new URLSearchParams(location.search).get('persistTest')==='1';
const SAVE_KEY = questMode?QUEST_LAB.key+':'+questScenario:labMode?TEST_LAB.key:persistTest?'star-abyss-planet-isolated-test-v1':'star-abyss-silent-echo-v1';
const canvas = document.getElementById('world');
const sound = createAudio();
let story = createStory(), player = createPlayer(), screen = 'menu', journalReturn = 'playing';
let lookControl=createLookControl();
let equipment=createEquipment();
let elapsed = 0, stamina = createStamina(), scannerCooldown = 0, scanRemaining = 0, flashlight = true;
let lastSave = 0, moving = false, sprinting = false, nearby = null, world, input, sceneDirty = true;
let vehicleCameraMode = null;
const drivingView=()=>vehicleCameraMode||cameraMode;
let cameraMode = 'first', walkMode = false, navigation = createNavigation(), discovered = new Set(), surface = 'gravel', blocked = false, arrivalKey = '';
let mobility = createMobility();
let dash = createDash();
let planetRuntime=null,blinkMenu=false,ascensionUI=null;
let medicineReceipt=null;
let campUI=null,campScene=null,campMenu=false,skillUI=null,skillMenu=false;
let explorationContent=null;
let evolution = createEvolution();
let survey = createSurvey(), calibration = null;
let gait = createGait(player, sampleGround), lastContact = null;
let storedSave = readSave(), storageWarned = false;
let expeditionRuntime=null, expeditionVisual=null, expeditionEffects=null, expeditionHUD=null, expeditionLink=null, expeditionMenu=false, expeditionLoading=false, expeditionError='', expeditionEpoch=0;
const expeditionControlGate=createControlGate(()=>input);
const marker = document.createElement('div');
marker.className = 'world-marker'; marker.hidden = true; document.body.append(marker);
const calibrationUI = createCalibrationUI({
  change(index, value) {
    if (screen !== 'calibration' || !setCalibrationValue(calibration, index, value)) return;
    calibrationUI.update(calibrationView(calibration));
  },
  confirm: confirmCalibration, cancel: closeCalibration,
});
const ui = createUI({ start: newGame, newGame, resume, continueGame, toggleJournal, togglePause,
  toggleSound() { sound.toggle(); if (screen === 'playing') sound.wake(); else sound.suspend(); refresh(); },
  toggleCamera, toggleWalk,
  trackTransport,
  planetWaypoint(selection){if(planetRuntime?.setMapTarget(selection)){save();updateMap();refresh();ui.toast(selection?'行星导航已更新，请留意地形与海面。':'已恢复调查目标导航。');}},
  openEvolution, openRecords, upgrade: applyEvolution, trackCalibration,
  setWaypoint(selection) {
    if (selection && !selection.pointId && Number.isFinite(selection.x) && Number.isFinite(selection.z) && groundMobilityBlocked(selection.x, selection.z, mobility, story.flags.gateOpen)) {
      ui.toast('这个位置有岩石、车辆、墙体或关闭的舱门，请标记旁边可通行的地面。'); return;
    }
    if (!setWaypoint(navigation, selection, knownPoints())) { ui.toast('无法标记这里，请选择地图范围内的地面或已知地点。'); return; }
    arrivalKey = ''; save(); updateMap(); refresh();
    ui.toast('导航已更新。方向线仅供定位，请留意实际地形与舱门。');
  },
  clearWaypoint() { clearWaypoint(navigation);planetRuntime?.setMapTarget(null); arrivalKey = ''; save(); updateMap(); refresh(); },
});
const flightHUD=createFlightHUD(document);
ui.setHasSave(!!storedSave);
if(questMode){document.title='星渊 · 前期任务独立测试';const badge=document.createElement('div');badge.textContent='独立任务测试 · '+(questScenario==='breakthrough'?'后天十级满槽':'后天一级')+' · 营地成长测试';Object.assign(badge.style,{position:'fixed',top:'6px',left:'50%',transform:'translateX(-50%)',zIndex:'80',maxWidth:'calc(100vw - 32px)',padding:'6px 12px',background:'#173142',color:'#d7f0f5',font:'14px system-ui',pointerEvents:'none'});document.body.append(badge);}
try { world = createScene(canvas); }
catch (error) {
  document.body.innerHTML = '<main style="padding:10vh 8vw;color:#d9f6ff;background:#08111e;min-height:100vh;font:18px sans-serif"><h1>三维场景未能启动</h1><p>此版本需要 WebGL 2。请使用支持硬件加速的 Chrome 或 Edge 重新打开。</p><p id="boot-error"></p></main>';
  document.getElementById('boot-error').textContent = error.message;
  throw error;
}
input = createInput(canvas, {
  isFlying:()=>planetRuntime?.active===true,
  canMelee:()=>combatAvailable()&&!mobility.vehicle.mounted&&!expeditionBlocked(),
  guard(held){if(!held)void expeditionRuntime?.action({type:'air-guard',held:false});else expeditionAction({type:'air-guard',held:true});},
  captureChanged() { refresh(); },
  look(dx,dy){applyMouseLook(lookControl,player,dx,dy,{mounted:mobility.vehicle.mounted});},
  freeLook(active){setFreeLook(lookControl,player,active);},
  action(name) {
    if (name === 'pause') {if(blinkMenu)return ascensionUI.close();if(skillMenu)return skillUI.close();if(campUI?.isOpen)return campUI.close();return togglePause();}
    if (name === 'journal') return toggleJournal();
    if (name === 'records') return openRecords();
    if (name === 'evolution') return openEvolution();
    if (screen !== 'playing') return;
    if(name==='air-melee'){expeditionAction({type:'air-melee'});return;}
    if (name === 'blink') {requestBlink();return;}
    if (name === 'planet') {if(planetRuntime?.action()){save();refresh();}return;}
    if(planetRuntime?.radialFrame()&&['dash','crouch','prone'].includes(name)){ui.toast('当前星球航行使用站姿与飞行控制。');return;}
    if (name === 'dash') return activateDash();
    if (name === 'interact') activateNearby();
    if (name === 'camera') toggleCamera();
    if (name === 'crouch') toggleWalk();
    if (name === 'prone') changePosture('prone');
    if (name === 'transport') trackTransport();
    if (name === 'light') { flashlight = !flashlight; ui.toast(flashlight ? '肩灯已开启' : '肩灯已关闭'); }
    if (name === 'scan' && scannerCooldown <= 0) {
      if(!useScanner(equipment))return;
      scannerCooldown = SCAN.cooldown;
      const navigation = currentNavigation(),target=navigation.target;
      ui.toast(target ? `回波定位：${target.name} · ${Math.round(navigation.distance)} m` : '回波已记录。你仍可以探索这片地表。');
    }
  },
  blur() { if (screen === 'playing' || screen === 'calibration') setScreen('pause'); save(); },
});
const expeditionQueries=createExpeditionQueries({
  worldQueries:createWorldQueries({gateOpen:()=>story.flags.gateOpen}),getVehicle:()=>mobility.vehicle,
});
planetRuntime=createPlanetRuntime({world,getContext:()=>({player,story,mobility,realm:expeditionRuntime?.realm||0}),toast:message=>ui.toast(message)});
ascensionUI=createAscensionUI({onOpen(open){blinkMenu=open;input.clear();updateControlGate(!open);},onCommit(ticket){if(!canUseBlink())return;const result=planetRuntime.blinkCommit(ticket);ui.toast(result.message);if(result.ok){save();sceneDirty=true;}refresh();}});
explorationContent=createExplorationContent({THREE,scene:world.scene,planet:planetRuntime,legacyHeight:terrainHeight,getRuntime:()=>expeditionRuntime,
  getContext:()=>({player,playing:screen==='playing'&&!expeditionBlocked(),menu:expeditionMenu||campMenu||progressionMenu||skillMenu,mounted:mobility.vehicle.mounted,airborne:mobility.flight.airborne||mobility.jump.airborne}),toast:message=>ui.toast(message)});
expeditionVisual=createExpeditionWorld({THREE,scene:world.scene,terrainHeight});
expeditionHUD=createExpeditionHUD({onAction:expeditionAction});
campV2Scene=createCampV2Scene({scene:world.scene,onChange:()=>{sceneDirty=true;world.invalidateShadows();}});
const campActorChanged=({dynamic=false}={})=>{sceneDirty=true;if(dynamic)world.invalidateDynamicShadows();else world.invalidateShadows();};
const campAwareQueries=Object.freeze({...expeditionQueries,hasLineOfSight:(a,b)=>expeditionQueries.hasLineOfSight(a,b)&&campV2Scene.hasLineOfSight(a,b),canAirTraverse(a,b,radius,height){
  if(!expeditionQueries.canAirTraverse(a,b,radius,height))return false;
  for(const y of [.1,height*.5,height])for(const [x,z]of [[0,0],[-radius,0],[radius,0],[0,-radius],[0,radius]])if(!campV2Scene.hasLineOfSight({x:a.x+x,y:a.y+y,z:a.z+z},{x:b.x+x,y:b.y+y,z:b.z+z}))return false;
  return true;
}});
progressionScene=createProgressionScene({scene:world.scene,terrainHeight,onChange:campActorChanged});
progressionControls=createProgressionControls({getRuntime:()=>expeditionRuntime,isPlaying:()=>screen==='playing'&&!expeditionBlocked()&&planetRuntime?.legacyActive()!==false,isMenu:()=>expeditionMenu||campMenu||progressionMenu||skillMenu||labPanelOpen,
  setMenu(open){progressionMenu=open;updateControlGate();},openStorage(){expeditionAction({type:'menu',open:true});},
  async saveAndExit(){await expeditionRuntime?.checkpoint();save();setScreen('menu');},
  npcReady:id=>progressionScene.npcReady(id),nodeReady:id=>progressionScene.nodeReady(id),toast:message=>ui.toast(message)});
skillUI=createSkillUI({onAction:action=>expeditionAction(action),onMenu:open=>{skillMenu=open;updateControlGate();}});
campScene=createCampScene({scene:world.scene,foundationReady:campV2Scene.ready,onChange:campActorChanged});
campUI=createCampUI({host:document.body,onAction:expeditionAction,onOpenChange(open){campMenu=open;updateControlGate();refresh();},onUse(){campMenu=false;updateControlGate();}});
const expeditionStartupPanel=createAssetStartupPanel({
  onRetry(){if(!expeditionLoading)void attachExpedition(false,true);},
  onMenu(){++expeditionEpoch;expeditionLoading=false;save();expeditionStartupPanel.update({visible:false,loading:false,error:''});setScreen('menu');},
});
document.addEventListener('keydown',event=>{
  if(event.repeat||event.altKey||event.ctrlKey||event.metaKey||event.target.closest?.('input,textarea,select'))return;
  if(event.code==='KeyI'&&screen==='playing'&&!progressionMenu&&!campMenu&&!skillMenu) {event.preventDefault();expeditionAction({type:'menu',open:!expeditionMenu});}
  if(screen!=='playing'||expeditionMenu||campMenu||progressionMenu||skillMenu||expeditionLoading)return;
  if(event.code==='KeyR'){event.preventDefault();expeditionAction({type:'attack'});}
  if(event.code==='KeyH'){event.preventDefault();expeditionAction({type:'interact'});}
});
function expeditionBlocked(){return expeditionLoading||!!expeditionError||expeditionVisual?.assetStatus?.status!=='ready'||!expeditionRuntime;}
function combatAvailable(){return planetRuntime?.legacyActive()!==false||(planetRuntime?.active===true&&planetRuntime?.combatZone()===true);}
function expeditionContext(){const legacy=planetRuntime?.legacyActive()!==false,zone=combatAvailable(),flying=planetRuntime?.active===true;return {remote:!zone,combatZone:zone,flying,player:zone?{...player,...(flying?planetRuntime.combatPose():{})}:planetRuntime.parkedPlayer,mounted:mobility.vehicle.mounted,airborne:flying||mobility.flight.airborne||mobility.jump.airborne,dashing:dash.active,playing:zone&&(labPreparing||screen==='playing'&&!expeditionBlocked()),menu:expeditionMenu||campMenu||progressionMenu||blinkMenu||labPanelOpen,skillMenu,prone:player.posture==='prone',sprinting,restoring:expeditionLoading,npcPositions:Object.fromEntries(['N01','N03','N04','N05'].map(id=>[id,progressionScene?.position(id)]).filter(([,position])=>position)),physicianPosition:campScene?.position,progressionReady:{npcs:['N01','N03','N04','N05'].filter(id=>progressionScene?.npcReady(id)),nodes:['breath-1','breath-2','breath-3'].filter(id=>progressionScene?.nodeReady(id))}};}
function canUseBlink(){
  const cv=expeditionRuntime?.combatView(),melee=cv?.aerialMelee;
  if(melee&&(melee.guarding||melee.stunUntil>cv.time||melee.end>cv.time)){ui.toast('拳脚收势或受击期间暂不能虚步。');return false;}
 if(screen!=='playing'||expeditionBlocked()||expeditionRuntime?.busy||expeditionRuntime?.defeated||labPanelOpen||expeditionMenu||campMenu||progressionMenu||skillMenu||mobility.vehicle.mounted)return false;
 const load=expeditionRuntime?.view().load;
 if(expeditionRuntime?.medicineActive||expeditionRuntime?.skillsMotion()||load?.canTakeOff===false||load?.overloaded){ui.toast('当前状态或负重不允许虚步。');return false;}return true;
}
function requestBlink(){
 if(!canUseBlink())return;
 const mode=input.snapshot().sprint?'long':'short',preview=planetRuntime.blinkPreview(mode);
 if(mode==='long'){ascensionUI.show(preview);return;}
 if(!preview.ok){ui.toast(preview.message);return;}
 const result=planetRuntime.blinkCommit(preview.ticket);ui.toast(result.message);if(result.ok){save();sceneDirty=true;}refresh();
}
async function attachExpedition(fresh=false,retry=false){
  const epoch=++expeditionEpoch;
  skillUI?.close();expeditionRuntime?.destroy();expeditionRuntime=null;expeditionLoading=true;expeditionError='';expeditionMenu=false;progressionMenu=false;progressionControls?.panel.close();
  refresh();
  try{
    const data=serializeGame();
    // Explicit test mode has its own storage link and DB world; it never imports the user's story save.
    expeditionLink=questMode?(expeditionLink&&!fresh?expeditionLink:questLabLink()):labMode?testLabLink(expeditionLink,fresh):testing?(expeditionLink&&!fresh?expeditionLink:{version:1,worldId:'original:test-'+crypto.randomUUID(),playerId:'explorer:test-'+crypto.randomUUID(),rescueRevision:0})
       :bindLegacy(localStorage,data,()=>crypto.randomUUID(),{fresh});
    save();
    const visual=expeditionVisual;
    if(!await waitForWorldAssets(visual,{retry,isCurrent:()=>epoch===expeditionEpoch&&visual===expeditionVisual}))return;
    const runtime=await createExpeditionRuntime({...(questMode?{openStorage:options=>openQuestLabStorage(options,questScenario),checkpointStorageName:QUEST_LAB.db+':'+questScenario}:labMode?{openStorage:openTestLabStorage,checkpointStorageName:TEST_LAB.db}:{}),getPalm:()=>world.skillPalm(),link:expeditionLink,world:expeditionDefinitions,queries:campAwareQueries,getContext:expeditionContext,
      explorationAccess:(root,request)=>explorationContent.access(root,request),
      onAirImpulse:impulse=>{if(epoch!==expeditionEpoch)return;if(planetRuntime?.active)planetRuntime.airImpulse(impulse);else if(!mobility.vehicle.mounted)groundCombatRecoil.start(impulse);},
      isVisible(p){if(labPreparing)return false;const v=new Vector3(p.x,p.y,p.z).project(world.camera);return v.z>-1&&v.z<1&&Math.abs(v.x)<1&&Math.abs(v.y)<1;},
      onChange:()=>{if(epoch!==expeditionEpoch)return;if(expeditionRuntime&&!expeditionRuntime.busy)save();refresh();},onRescue(pose,revision){if(epoch!==expeditionEpoch)return;Object.assign(player,pose,{heading:pose.yaw,y:terrainHeight(pose.x,pose.z),vx:0,vz:0});
        groundCombatRecoil.clear();planetRuntime?.rescue();expeditionLink.rescueRevision=revision;lookControl=createLookControl();resetLocomotion();expeditionMenu=false;updateControlGate(false);save();}});
    if(epoch!==expeditionEpoch||visual!==expeditionVisual||visual.assetStatus?.status!=='ready'){runtime.destroy();return;}expeditionRuntime=runtime;
    if(labMode){labPreparing=true;try{await prepareTestLabSession(runtime,()=>epoch===expeditionEpoch);}finally{labPreparing=false;}if(epoch!==expeditionEpoch)return;}
    if(runtime.progressionView().training?.mode==='offline')await runtime.action({type:'progression',progression:{action:'train-stop'}});
    save();
  }catch(error){if(epoch!==expeditionEpoch)return;console.error('Expedition startup failed',error);expeditionError=expeditionVisual.assetStatus?.status!=='ready'?'生物模型加载失败，玩法已暂停。请重试，或返回菜单稍后继续。':'外勤存档暂时无法载入；进度已保留，请重试或返回菜单。';ui.toast(expeditionError);}
  finally{if(epoch===expeditionEpoch){expeditionLoading=false;if(labMode){sceneDirty=true;testLab?.refresh();}refresh();}}
}
function expeditionAction(action){
  if(screen!=='playing'||expeditionBlocked())return;
  if(blinkMenu||labPanelOpen||progressionMenu||campMenu&&action.type!=='camp'||skillMenu&&!['skill-manage','skill-cast'].includes(action.type))return;
  if(action.type==='interact'&&explorationContent?.interact())return;
  if(action.type==='toggleInventory')return; // HUD emits its authoritative menu notification first.
  else if(action.type==='closeInventory')expeditionMenu=false;
  else if(action.type==='menu')expeditionMenu=action.open;
  else {const airAttack=planetRuntime?.active&&combatAvailable()&&['attack','skill','skill-cast','air-melee','air-guard'].includes(action.type);if(planetRuntime?.legacyActive()===false&&!airAttack){ui.toast('盆地内可御空战斗；采集、用药与仓储请落地，远区战斗尚未开放。');return;}void expeditionRuntime?.action(action);return;}
  updateControlGate();refresh();
}
function updateControlGate(capture=true){expeditionControlGate.update({screen,menu:expeditionMenu||campMenu||progressionMenu||skillMenu||blinkMenu,loading:labPanelOpen||expeditionBlocked(),defeated:!!expeditionRuntime?.defeated,capture});}
function refreshExpedition(){
  updateControlGate();
  if(!expeditionHUD)return;
  progressionControls?.refresh();
  expeditionStartupPanel.update({visible:screen==='playing'&&expeditionBlocked(),loading:expeditionLoading,error:expeditionError});
  if(expeditionRuntime){
    const nextReceipt=applyStaminaGrant(stamina,medicineReceipt,expeditionLink?.worldId,expeditionRuntime.campView().staminaGrant);
    if(nextReceipt!==medicineReceipt){medicineReceipt=nextReceipt;save();}
    const view=explorationContent.decorateView(expeditionRuntime.view());
    const gameplayVisible=view.visible;
    if(campMenu||progressionMenu||skillMenu)view.screen='playing';
    if(screen==='playing'&&!expeditionMenu&&!progressionMenu&&!skillMenu&&!labPanelOpen&&planetRuntime?.legacyActive()!==false&&campScene?.assetStatus==='ready')campUI?.update(expeditionRuntime.campView());else campUI?.hide();
    if(screen!=='playing'){view.visible=false;view.screen=screen;}
    if(campMenu||progressionMenu||skillMenu)view.visible=false;
    expeditionHUD.update(view);expeditionVisual.update(combatAvailable()?view:{});
    skillUI.update(expeditionRuntime.skillsView(),gameplayVisible&&screen==='playing'&&!expeditionRuntime.defeated&&combatAvailable()&&!expeditionMenu&&!campMenu&&!progressionMenu&&!labPanelOpen&&!blinkMenu);
    const evidence=document.getElementById('expedition-evidence');
    if(evidence){const root=expeditionRuntime.snapshot(),key=JSON.stringify([root.revision,screen,expeditionMenu,view.pending,view.error,view.save.status,expeditionLoading,expeditionVisual.assetStatus.status]);
      if(evidence.dataset.revision!==key){evidence.dataset.revision=key;evidence.textContent=JSON.stringify({game:serializeGame(),screen,menu:expeditionMenu,loading:expeditionLoading,blocked:expeditionBlocked(),assetStatus:expeditionVisual.assetStatus,root,view});}}
  }else {
    skillUI?.update(null,false);
    expeditionHUD.update({visible:false,screen:'playing',pending:expeditionLoading,error:expeditionError,save:{status:'idle'}});
    const evidence=document.getElementById('expedition-evidence');
    if(evidence){evidence.dataset.revision='';evidence.textContent=JSON.stringify({game:serializeGame(),screen,menu:expeditionMenu,loading:expeditionLoading,blocked:expeditionBlocked(),error:expeditionError,assetStatus:expeditionVisual.assetStatus,root:null});}
  }
}

function readSave() {
  if (testing&&!persistTest) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    return raw?.version === 1 && raw.story && raw.player ? raw : null;
  } catch { return null; }
}
function save() {
  if ((testing&&!persistTest) || screen === 'menu') return false;
  try {
    const data = serializeGame();
    localStorage.setItem(SAVE_KEY, JSON.stringify(data)); storedSave = data; ui.setHasSave(true); return true;
  } catch {
    if (!storageWarned) { storageWarned = true; ui.toast('浏览器未允许本地存档；本次仍可游玩，请勿刷新。'); }
    return false;
  }
}
function serializeGame() {
  const data={ version: 1, story, medicineReceipt, player: { x: player.x, y: player.y, z: player.z, heading: player.heading, yaw: player.yaw, pitch: player.pitch,posture:player.posture||'stand' }, elapsed,
    stamina: serializeStamina(stamina), mobility: serializeMobility(mobility), dash: serializeDash(dash), evolution: serializeEvolution(evolution), survey: serializeSurvey(survey), flashlight, cameraMode, vehicleCameraMode, walkMode, navigation: serializeNavigation(navigation), discovered: [...discovered], ...(expeditionLink?{expedition:expeditionLink}:{}) };
  return planetRuntime?.save(data)||data;
}
function dashContext() {
  return { grounded: !mobility.flight.airborne&&!mobility.jump.airborne&&(player.posture||'stand')==='stand', mounted: mobility.vehicle.mounted, gateOpen: story.flags.gateOpen, mobility, sprintDuration:evolutionStats(evolution).sprintDuration };
}
async function activateDash() {
  if(expeditionRuntime?.medicineActive){ui.toast('正在服药，请先取消或等待服用完成。');return;}
  if(expeditionRuntime&&!expeditionRuntime.view().load.canDodge){ui.toast('携重过高，请回营地整理背包后闪避。');return;}
  if (!story.flags.signal) { ui.toast('先调查失真的求救信号，解析玄壳的矢量控制指令。'); return; }
  const skillMotion=expeditionRuntime?.skillsMotion();
  if(skillMotion){if(!skillMotion.canDodge){ui.toast('收势前半段不能闪避取消');return;}if(!await expeditionRuntime.cancelSkill())return;}
  const result=startDash(dash,player,stamina,input.snapshot({mounted:mobility.vehicle.mounted}),dashContext());
  if (!result.changed) ui.toast(result.message);
  else { stowEquipment(equipment);evolution.restTime=0; sound.pulse(); save(); }
  refresh();
}
function toggleWalk() {
  changePosture('crouch');
}
function changePosture(target) {
  if(screen!=='playing'||dash.active||planetRuntime?.active)return;
  const next=player.posture===target?'stand':target;
  if(!setPosture(player,next,{airborne:mobility.flight.airborne||mobility.jump.airborne,mounted:mobility.vehicle.mounted,gateOpen:story.flags.gateOpen})){
    ui.toast('当前空间或移动状态不允许切换姿势。');return;
  }
  save();refresh();
  ui.toast(`${{stand:'已起身',crouch:'已蹲伏',prone:'已趴下'}[next]} · C 蹲伏，Z 趴下，Ctrl 慢走。`);
}
function toggleCamera() {
  if (screen !== 'playing') return;
  if (mobility.vehicle.mounted) { vehicleCameraMode=drivingView()==='first'?'third':'first'; player.yaw=mobility.vehicle.yaw;player.pitch=-.12;lookControl=createLookControl();sceneDirty=true;save();refresh();ui.toast(vehicleCameraMode==='first'?'驾驶第一人称 · 鼠标环视，A/D 转向，V 切追尾':'驾驶追尾 · V 切驾驶第一人称');return; }
  cameraMode = cameraMode === 'first' ? 'third' : 'first'; sceneDirty = true; save(); refresh();
  const viewName=cameraMode === 'third'?'第三人称':'第一人称';
  ui.toast(planetRuntime?.hud()?.active?`已切换${viewName}`:`${viewName} · 鼠标转向，WASD 移动；按住 Alt 独立环视，松开回正。`);
}
function currentObjective() { return planetRuntime?.objective() || surveyView(survey, story).objective || objective(story); }
function currentNavigation() {
  return planetRuntime?.navigation() || navigationView(navigation, player, knownPoints(), allPoints().find(p => p.id === currentObjective().target));
}
function trackTransport() {
  if (screen !== 'playing') return;
  if (mobility.vehicle.mounted) { ui.toast('你正在驾驶勘探车。Tab 地图可选择调查地点作为目的地。'); return; }
  if(planetRuntime?.legacyActive()===false&&planetRuntime.setMapTarget({id:'vehicle'})){save();refresh();ui.toast('已按球面位置追踪停放的勘探车。');return;}
  const target = mobility.vehicle.repaired || mobility.vehicle.partTaken ? 'skimmer' : 'skimmer-part';
  const points = knownPoints(), point = points.find(p => p.id === target) || points.find(p => p.id === 'skimmer');
  if (!point) { ui.toast('尚未发现勘探车。留意着陆点东北侧的低功率信号。'); return; }
  setWaypoint(navigation, { pointId: point.id }, points); arrivalKey = ''; save(); refresh();
  ui.toast(`已追踪：${point.name}。Tab 地图可查看实际位置。`);
}
function updateMap() {
  const markers=explorationContent?.mapMarkers()||[];
  const nearby=planetRuntime?explorationMapMarkers(markers).map(mark=>({...mark,...globalToLocal(mark.position,planetRuntime.frame)})).filter(mark=>Math.abs(mark.x)<=WORLD.halfSize&&Math.abs(mark.z)<=WORLD.halfSize):[];
  ui.setMap(player, [...knownPoints(),...nearby], { navigation: currentNavigation(), gateOpen: story.flags.gateOpen, entered: story.flags.entered,planet:planetRuntime?.mapView(markers) });
}
function setScreen(value) {
  if(value!=='playing'&&campUI?.isOpen)campUI.close();
  if(value!=='playing'){skillUI?.close();expeditionMenu=false;progressionMenu=false;progressionControls?.panel.close();planetRuntime?.pause();if(planetRuntime?.legacyActive()!==false)void expeditionRuntime?.checkpoint();}
  if (value !== 'calibration') calibration = null;
  screen = value; sceneDirty = true; moving = false; sprinting = false;
  explorationContent?.setVisible(value==='playing');
  if (value !== 'playing') { dash.active=false; dash.remaining=0; }
  blocked = false;
  player.vx = 0; player.vz = 0;
  player.spaceHoldTime=0;
  clearStaminaInput(stamina);
  clearMobilityInput(mobility);
  ui.setScreen(value, { returnScreen: journalReturn });
  if (value === 'journal') { ui.setJournal(fieldJournal()); updateMap(); }
  if (value === 'playing') canvas.focus({ preventScroll: true });
  updateControlGate();
  if (value === 'playing') sound.wake(); else sound.suspend();
  refresh();
}
function newGame() {
  medicineReceipt=null;
  expeditionLoading=true;
  expeditionLink=null;
  lookControl=createLookControl();
  equipment=createEquipment();
  story = createStory(); player = createPlayer(); elapsed = 0; stamina = createStamina(); scannerCooldown = 0; scanRemaining = 0; flashlight = true; lastSave = 0;
  cameraMode = 'first'; vehicleCameraMode=null; walkMode = false; navigation = createNavigation(); discovered = new Set(); surface = 'gravel'; blocked = false; arrivalKey = '';
  mobility = createMobility(); dash = createDash(); evolution = createEvolution(); survey = createSurvey();
  planetRuntime?.reset({player:{...player},mobility:serializeMobility(mobility)});
  if(testing){applyPlanetFixture();applyPhysicsFixture();}
  if(labMode)seedTestLabGame({story,mobility,evolution,planet:planetRuntime,serialize:serializeGame,discovered,points:allPoints()});
  resetLocomotion();
  setScreen('playing'); save();
  void attachExpedition(true);
  ui.toast('耳机里传来你自己的声音：“不要接通主天线。”');
}
function continueGame() {
  if (!storedSave) return newGame();
  expeditionLoading=true;
  expeditionLink=storedSave.expedition||null;
  medicineReceipt=storedSave.medicineReceipt||null;
  equipment=createEquipment();scanRemaining=0;scannerCooldown=0;
  story = restoreStory(storedSave.story); player = restorePlayer(storedSave.player, story.flags.gateOpen);
  mobility = restoreMobility(storedSave.mobility, player, story.flags.gateOpen);
  lookControl=createLookControl();lookControl.returnPitch=player.pitch;lookControl.returning=!mobility.vehicle.mounted;
  dash = createDash(storedSave.dash);
  evolution = restoreEvolution(storedSave.evolution, story);
  survey = restoreSurvey(storedSave.survey, story);
  elapsed = Number.isFinite(storedSave.elapsed) ? Math.max(0, storedSave.elapsed) : 0;
  // The previous charge field is read only to preserve existing local saves.
  stamina = restoreStamina(storedSave.stamina, storedSave.charge);
  discovered = new Set(Array.isArray(storedSave.discovered) ? storedSave.discovered.filter(id => allPoints().some(p => p.id === id)) : []);
  cameraMode = storedSave.cameraMode === 'third' ? 'third' : 'first';
  vehicleCameraMode=['first','third'].includes(storedSave.vehicleCameraMode)?storedSave.vehicleCameraMode:null;
  walkMode = false;
  navigation = restoreNavigation(storedSave.navigation, knownPoints()); arrivalKey = '';
  flashlight = storedSave.flashlight !== false; lastSave = elapsed;
  try{planetRuntime?.reset({...storedSave,player:{...player},mobility:serializeMobility(mobility)});}catch(error){expeditionLoading=false;ui.toast(error.message);return;}
  resetLocomotion();
  setScreen('playing'); ui.toast(story.flags.returned && !story.flags.complete ? '已恢复记录。黑匣子已隔离，继续调查地表的两处回声。' : '已恢复记录。调查可以继续。');
  void attachExpedition();
}
// Explicit, isolated visual QA start points; never applied to ordinary play or user saves.
function applyPlanetFixture(){
  const id=new URLSearchParams(location.search).get('planetFixture');
  if(!['boundary','plains','forest','wetland','coast','orbit','orbit-remote-vehicle','landing','backside','backside-vehicle'].includes(id))return;
  story=restoreStory({...story,flags:Object.fromEntries(Object.keys(story.flags).map(key=>[key,true]))});mobility.vehicle.repaired=true;mobility.vehicle.coupler=true;mobility.vehicle.partTaken=true;
  const advanced=['orbit','orbit-remote-vehicle','landing','backside','backside-vehicle'].includes(id);
  const field=planetRuntime.field,landmark=field.routeLandmarks.find(p=>p.id===(advanced?'basin':id));
  let canonical=id==='boundary'?field.surfacePoint(field.routeDirection(2980)):landmark.position;
  if(id.startsWith('backside'))canonical=field.surfacePoint({x:-120000,y:600,z:0});
  if(id.startsWith('orbit'))canonical={x:field.planet.radius*3,y:0,z:0};
  let remoteVehicle;
  if(id==='orbit-remote-vehicle'){const support=planetRuntime.prepare(field.routeLandmarks.find(p=>p.id==='forest').position);remoteVehicle={position:{...support.position},yaw:.4,battery:37,mounted:false};}
  const surface=planetRuntime.prepare(canonical);if(!id.startsWith('orbit')&&surface.ready)canonical=surface.position;
  if(id==='landing'){const radius=Math.hypot(canonical.x,canonical.y,canonical.z);canonical=Object.fromEntries(['x','y','z'].map(k=>[k,canonical[k]*(1+100/radius)]));}
  const data=serializeGame();data.planet.position=canonical;
  data.planet.gameplay={version:1,energy:100,progression:{surveys:advanced?['plains','forest','wetland','coast']:['plains','forest','wetland','coast'].slice(0,Math.max(0,['plains','forest','wetland','coast'].indexOf(id))),commissioned:advanced}};
  if(id==='backside-vehicle')data.planet.gameplay.surfaceVehicle={position:{...canonical},yaw:-Math.PI/2,battery:80,mounted:true};
  if(remoteVehicle)data.planet.gameplay.surfaceVehicle=remoteVehicle;
  planetRuntime.reset(data);player.heading=player.yaw=-Math.PI/2;player.pitch=id.startsWith('orbit')?-1.35:0;
}
function applyPhysicsFixture(){
  const id=new URLSearchParams(location.search).get('physicsFixture');
  if(id==='foot-edge'){
    Object.assign(player,{x:25.35,z:130,y:1.0366603702898871,yaw:0,heading:0,pitch:-.2,vx:0,vz:0});
    cameraMode='third';planetRuntime.reset({player:{...player},mobility:serializeMobility(mobility)});return;
  }
  if(id==='territory-watch'){
    Object.assign(player,{x:95,z:138,y:terrainHeight(95,138),yaw:Math.PI,heading:Math.PI,pitch:-.08,vx:0,vz:0});
    cameraMode='third';planetRuntime.reset({player:{...player},mobility:serializeMobility(mobility)});return;
  }
  if(!['vehicle-slope','vehicle-steep','foot-slope'].includes(id))return;
  const x=id==='vehicle-steep'?220:140,z=id==='vehicle-steep'?40:-80;
  const gx=(terrainHeight(x+1,z)-terrainHeight(x-1,z))/2,gz=(terrainHeight(x,z+1)-terrainHeight(x,z-1))/2,yaw=Math.atan2(gx,gz);
  Object.assign(player,{x,z,y:terrainHeight(x,z),yaw,heading:yaw,pitch:-.15,vx:0,vz:0});
  Object.assign(mobility.vehicle,{x,z,yaw,repaired:true,partTaken:true,mounted:id!=='foot-slope'});
  discovered.add('skimmer');cameraMode='third';vehicleCameraMode='third';
  planetRuntime.reset({player:{...player},mobility:serializeMobility(mobility)});
}
function resume() { if (screen === 'menu') return continueGame(); setScreen('playing'); }
function togglePause() {
  if (screen === 'menu') return;
  if (screen === 'calibration') return closeCalibration();
  if (screen === 'journal') return toggleJournal();
  if (screen === 'playing') { setScreen('pause'); save(); } else resume();
}
function toggleJournal() {
  if (screen === 'menu') return;
  if (screen === 'calibration') return closeCalibration();
  if (screen === 'journal') setScreen(journalReturn);
  else { journalReturn = screen; setScreen('journal'); ui.selectArchiveTab('map'); }
  save();
}
function openRecords() {
  if (screen === 'menu' || screen === 'calibration') return;
  if (screen === 'journal' && ui.isArchiveTab('records')) return toggleJournal();
  if (screen !== 'journal') { journalReturn = screen; setScreen('journal'); }
  ui.selectArchiveTab('records');
}
function allPoints() { return [...POINTS, ...SURVEY_SITES, ...mobilityPoints(mobility),...(progressionScene?.points(expeditionRuntime?.progressionView().quests.some(q=>q.id==='Q04'&&q.status==='claimed'))||[]),...expeditionDefinitions.sites.map(p=>({...p,id:'expedition-'+p.id,type:'anomaly'}))]; }
function calibrationPoints() { return POINTS.filter(p => p.id === 'beacon' || (p.id === 'power' && story.flags.power)); }
function evolutionContext() {
  const feet = player.y ?? terrainHeight(player.x, player.z);
  const point = calibrationPoints().find(p => Math.hypot(p.x - player.x, p.z - player.z, feet - terrainHeight(p.x, p.z)) <= 3.2 && hasLineOfSight(player, p, story.flags.gateOpen));
  return { grounded: !mobility.flight.airborne, mounted: mobility.vehicle.mounted, canCalibrate: !!point, stationName: point?.name || '' };
}
function openEvolution() {
  if (screen === 'menu') return;
  if (screen === 'calibration') { ui.toast('先完成调谐，或按 Esc / Tab 取消后查看进化。'); return; }
  if (screen === 'journal' && ui.isArchiveTab('evolution')) { toggleJournal(); return; }
  if (screen !== 'journal') { journalReturn = screen; setScreen('journal'); }
  ui.selectArchiveTab('evolution'); refresh(); save();
}
function applyEvolution(branch) {
  if (screen !== 'journal') return;
  const result = evolve(evolution, branch, story, evolutionContext());
  if (result.changed) { sceneDirty = true; sound.interact(); save(); ui.setJournal(fieldJournal()); }
  refresh(); ui.toast(result.message);
}
function trackCalibration() {
  if (screen !== 'journal') return;
  const target = calibrationPoints().sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0];
  setWaypoint(navigation, { pointId: target.id }, knownPoints()); arrivalKey = ''; save(); updateMap(); refresh();
  ui.toast(`已追踪${target.name}。关闭档案，靠近工作点后再打开进化页校准。`);
}
function fieldJournal() {
  const entries = getJournal(story);
  entries.push(...(explorationContent?.journal()||[]));
  entries.push(...surveyView(survey, story).records);
  entries.push({ title: '仪器手册 · 三路相位调谐', text: '测量装置需在现场手动调谐。读出每路现场相位，以补偿旋钮让合成波与目标重合：普通测量归零，隔离返流则反相到 180°。三路全部锁定后，确认才写入调查记录。\n终端打开时暂停移动与资源计时。Esc / Tab 取消不提交；离开页面或读档会放弃未提交的调整。已完成的旧记录仍然有效，无需重做。' });
  entries.push({ title: '装备手册 · 玄壳共生服', text: '回收矿物组成的壳层，正在替代传统背负式生命维持设备。它偶尔回应地表的低频信号，来源仍未确认。\n长按 G 低空助推，松开后缓降；Space 用于地面跳跃。限高 4.5 m，能量耗尽会强制落地；只有落地并松开按键后才能回充。舰内禁止起飞。\n飞行能量与步行体力相互独立。它适合越障，不能代替长途运输。' });
  const growth = evolutionStats(evolution);
  entries.push({ title: '外勤记录 · 共生适应', text: `身体 L${growth.bodyLevel}：满体力冲刺 ${growth.sprintDuration.toFixed(1)} 秒。装备 L${growth.equipmentLevel}：满能助推 ${growth.flightDuration.toFixed(1)} 秒。\nU 或档案「共生进化」查看条件与完整路线。身体记录有效徒步里程，结合调查成果形成适应；装备通过已取得的技术记录校准，需靠近返回信标或已供电的配电箱。\n升级只提高效率，不瞬间补满体力或能量。旧存档保留已有调查与可用图谱；此前未记录的徒步里程不作推算，从更新后开始累计。` });
  if (discovered.has('skimmer')) entries.push({ title: '野外装备 · 巡迹勘探车', text: mobility.vehicle.repaired
    ? '勘探车已重新接通。W/S 油门与倒车，A/D 转向，鼠标独立环视；Shift 加速，Space 刹车，停稳后 F 下车。\n车辆只适合地表，不可进入失事舰。电池按实际行程消耗，停放后由集光壳层缓慢回充；暂停时不会回充。地图标记跟随真实停放位置。\n车架编号被人磨去了，座位上却没有积灰。'
    : '着陆点东北侧发现一台勘探车，缺少动力耦合芯。附近散落的回收匣可能保留了可用部件。\n靠近回收匣按 F 取回耦合芯，再回到车旁按 F 修复；再次按 F 驾驶。不必建造整座工厂。' });
  return entries;
}
function knownPoints() {
  const expedition = surveyView(survey, story);
  const ids = new Set(['beacon', 'signal', 'breach', currentObjective().target, ...expedition.knownIds]);
  if (story.flags.entered) ['fuse','power','log'].forEach(id => ids.add(id));
  if (story.flags.log) ['relay-1','relay-2','relay-3'].forEach(id => ids.add(id));
  if (story.flags.returned) ['echo','capsule'].forEach(id => ids.add(id));
  const allowed = p => (p.id !== 'rift' || (story.flags.echoCalibrated && story.flags.capsuleCalibrated)) && (p.id !== 'blackbox' || story.flags.gateOpen)
    && (!p.id.startsWith('survey-') || expedition.knownIds.includes(p.id));
  const points = allPoints();
  for (const p of points) {
    if (!allowed(p)) continue;
    if (ids.has(p.id) || Math.hypot(p.x - player.x, p.z - player.z) < 140 || story.logs.includes(p.id)) discovered.add(p.id);
  }
  return points.filter(p => allowed(p) && (ids.has(p.id) || discovered.has(p.id)));
}
function findNearby() {
  if(planetRuntime?.radialFrame())return null;
  if (dash.active) return null;
  const forward = { x: -Math.sin(player.yaw), z: -Math.cos(player.yaw) };
  if (mobility.vehicle.mounted) return { id: 'dismount', name: '巡迹勘探车', hint: 'F · 停稳后下车', distance: 0 };
  if (mobility.flight.airborne) return null;
  return allPoints().map(p => ({ ...p, distance: Math.hypot(p.x - player.x, p.z - player.z, (player.y ?? terrainHeight(player.x, player.z)) - terrainHeight(p.x, p.z)) }))
    .filter(p => p.distance < 3.2 && (p.distance < 1.25 || ((p.x - player.x) * forward.x + (p.z - player.z) * forward.z) / p.distance > .35) && hasLineOfSight(player, p, story.flags.gateOpen))
    .sort((a,b) => a.distance - b.distance)[0] || null;
}
function activateNearby() {
  if(planetRuntime?.legacyActive()!==false&&campScene?.assetStatus==='ready'&&expeditionRuntime?.campView().near){campUI.open();return;}
  if(planetRuntime?.radialFrame()){if(planetRuntime.vehicleAction()){input.clear();resetLocomotion();save();refresh();}return;}
  nearby = findNearby();
  if(nearby?.id.startsWith('expedition-')){ui.toast('外勤区域：R 近距脉冲，H 采集或拾取，I 背包。');return;}
  if (!nearby) { ui.toast('靠近物件，并转向它后按 F。'); return; }
  const wasComplete = story.flags.complete;
  const wasMounted = mobility.vehicle.mounted;
  const expedition = surveyView(survey, story);
  if (requiresCalibration(story, nearby.id) ||
      (nearby.id.startsWith('survey-') && expedition.current?.id === nearby.id && !expedition.pending)) {
    openCalibration(nearby.id); return;
  }
  const result = ['skimmer', 'skimmer-part', 'dismount'].includes(nearby.id)
    ? mobilityAction(player, mobility, nearby.id, story.flags.gateOpen)
    : nearby.id.startsWith('survey-') ? collectSurvey(survey, nearby.id, story, null)
      : nearby.id === 'beacon' && story.flags.complete ? archiveSurvey(survey, story) : interact(story, nearby.id);
  if (result.changed) {
    clearStaminaInput(stamina); input.clear(); sceneDirty = true;
    // Entering/leaving the seat relocates the controller; it is not a 100 m/s stride.
    if (wasMounted !== mobility.vehicle.mounted) {if(mobility.vehicle.mounted){player.yaw=mobility.vehicle.yaw;player.pitch=-.12;lookControl=createLookControl();stowEquipment(equipment);}else leaveVehicleLook(lookControl,player);resetLocomotion();}
    if (nearby.id === 'skimmer-part' && navigation.waypoint?.pointId === 'skimmer-part') { setWaypoint(navigation, { pointId: 'skimmer' }, knownPoints()); arrivalKey = ''; }
    if (mobility.vehicle.mounted && navigation.waypoint?.pointId === 'skimmer') clearWaypoint(navigation);
    if (nearby.id === 'beacon' && story.flags.complete && navigation.waypoint?.pointId === 'beacon') clearWaypoint(navigation);
  }
  sound.interact(); ui.toast(result.message + (result.changed && nearby.id === 'signal' ? ' 玄壳已解析矢量指令：E + WASD 可进行入门闪避，U 查看说明。' : ''));
  if (result.changed) save();
  if (!wasComplete && story.flags.complete) { setScreen('complete'); save(); }
  else if (!expedition.complete && surveyView(survey, story).complete) { setScreen('complete'); save(); }
  refresh();
}
function openCalibration(id) {
  calibration = createCalibration(id);
  if (!calibration) return;
  calibrationUI.update(calibrationView(calibration));
  setScreen('calibration'); save();
}
function closeCalibration() {
  if (screen !== 'calibration') return;
  setScreen('playing'); save();
}
function confirmCalibration() {
  if (screen !== 'calibration' || !calibration) return;
  const session = calibration, point = allPoints().find(p => p.id === session.id);
  const feet = player.y ?? terrainHeight(player.x, player.z);
  const atSite = point && !mobility.flight.airborne && !mobility.vehicle.mounted
    && Math.hypot(point.x - player.x, point.z - player.z, feet - terrainHeight(point.x, point.z)) < 3.2
    && hasLineOfSight(player, point, story.flags.gateOpen);
  if (!atSite) { closeCalibration(); ui.toast('现场连接已中断。请落地、下车并靠近装置后重新测量。'); return; }
  if (!calibrationView(session)?.ready) { ui.toast('三路相位尚未全部锁定，请先完成调谐。'); return; }
  const remote = session.id.startsWith('survey-');
  const result = remote ? collectSurvey(survey, session.id, story, { values: session.values })
    : interact(story, session.id, { values: session.values });
  if (result.changed && navigation.waypoint?.pointId === session.id) { clearWaypoint(navigation); arrivalKey = ''; }
  closeCalibration(); sceneDirty = true; sound.interact(); save(); refresh(); ui.toast(result.message);
}
function simulate(dt, controls = input.snapshot({mounted:mobility.vehicle.mounted})) {
  if (screen !== 'playing' || dt < 1e-8) return;
  if(labPanelOpen||blinkMenu||expeditionMenu||campMenu||progressionMenu||skillMenu||expeditionBlocked()||(expeditionRuntime?.blocking??expeditionRuntime?.busy)||expeditionRuntime?.defeated)return;
  if(planetRuntime?.active||mobility.vehicle.mounted)groundCombatRecoil.clear();
  if(groundCombatRecoil.step(player,dt,campAwareQueries))controls={...controls,forward:false,backward:false,left:false,right:false,sprint:false,jump:false,lift:false};
  const skillMotion=expeditionRuntime?.skillsMotion();
  if(skillMotion)controls={...controls,sprint:false,jump:false,lift:false,actionSpeed:skillMotion.speed};
  const expeditionView=expeditionRuntime?.view(),load=expeditionView?.load;
  if(planetRuntime?.active)controls=aerialFootwork(controls,player,(expeditionView?.enemies||[]).map(e=>({...e,y:e.y??terrainHeight(e.x,e.z)})));
  if(expeditionRuntime?.medicineActive)controls={...controls,walk:true,sprint:false,lift:false,jump:false};
  if(load&&!mobility.vehicle.mounted){
    if(!load.canSprint)controls={...controls,sprint:false};
    if(!load.canTakeOff)controls={...controls,jump:false,lift:false,sprint:false,boost:false};
    if(load.overloaded)controls={...controls,forward:false,backward:false,left:false,right:false};
  }
   {const combat=expeditionRuntime?.combatView(),melee=combat?.aerialMelee;if(melee&&(melee.guarding||melee.end>combat.time||melee.stunUntil>combat.time))controls={...controls,forward:false,backward:false,left:false,right:false,sprint:false,boost:false,lift:false,descend:false,jump:false};}
  const takeoff=routeInnateTakeoff(controls,{unlocked:!!controls.lift&&planetRuntime?.flightUnlocked(),mounted:mobility.vehicle.mounted,legacyAirborne:mobility.flight.airborne||mobility.jump.airborne});
  const planetControls=takeoff.planet;
  const radialFoot=planetRuntime?.radialFrame()&&!planetRuntime.active&&!mobility.vehicle.mounted&&(!planetControls.lift||!planetRuntime.flightUnlocked());
  const planetRules=evolutionStats(evolution),planetBefore=planetRuntime?.position?{...planetRuntime.position}:null;
  const planetBoost=radialFoot&&prepareSprint(stamina,controls)?Math.min(dt,stamina.value/planetRules.sprintDrain):0;
  let planetHandled=false;
  if(radialFoot){
    if(planetBoost>0){planetHandled=labPlanetStep({...planetControls,sprint:true},planetBoost);const distance=Math.hypot(...['x','y','z'].map(k=>planetRuntime.position[k]-planetBefore[k]));updateStamina(stamina,{moving:distance>1e-6,sprinting:distance>1e-6},planetBoost,planetRules);}
    if(planetBoost<dt){const before={...planetRuntime.position};planetHandled=labPlanetStep({...planetControls,sprint:false},dt-planetBoost);updateStamina(stamina,{moving:Math.hypot(...['x','y','z'].map(k=>planetRuntime.position[k]-before[k]))>1e-6,sprinting:false},dt-planetBoost,planetRules);}
  }else planetHandled=labPlanetStep(planetControls,dt);
  if(planetHandled){
    const mounted=mobility.vehicle.mounted,distance=Math.hypot(...['x','y','z'].map(k=>planetRuntime.position[k]-planetBefore[k]));
    turnPlayerHeading(player,controls,dt,{mounted});
    elapsed+=dt;moving=distance>1e-6;sprinting=radialFoot&&stamina.sprinting;surface=planetRuntime.active?'air':'gravel';
    if(!radialFoot){prepareSprint(stamina,mounted?{}:controls);stamina.sprinting=false;stamina.moving=false;if(mounted)updateStamina(stamina,{moving:false,sprinting:false},dt,planetRules);}
    recordGrowthMotion({distance,moving,surface},dt);
    scannerCooldown=Math.max(0,scannerCooldown-dt);scanRemaining=Math.max(0,scanRemaining-dt);
    if(updateEquipment(equipment,dt).emit){scanRemaining=SCAN.duration;sound.pulse();}
    const contacts=updateGait(gait,{player,dt,posture:'stand',grounded:!planetRuntime.active,mounted,sprinting,surface,sampleGround:()=>({height:player.y,surface}),jump:mobility.jump,verticalSpeed:0});
    for(const contact of contacts){lastContact=contact;sound.step(contact);}
    updateLookControl(lookControl,player,dt,{mounted,vehicleHeading:mounted&&drivingView()==='first'?mobility.vehicle.yaw:undefined});
    if(elapsed-lastSave>12){lastSave=elapsed;save();}
    expeditionRuntime?.tick(dt);return;
  }
  controls=takeoff.legacy;
  // G can raise a low posture before takeoff; a low pose must not silently
  // swallow the flight input. Existing ceiling and indoor safety rules remain.
  if((controls.jump||controls.lift)&&player.posture&&player.posture!=='stand')setPosture(player,'stand',{airborne:mobility.flight.airborne||mobility.jump.airborne,mounted:mobility.vehicle.mounted,gateOpen:story.flags.gateOpen});
  controls = updateTacticalControl(player,controls,dt,{mounted:mobility.vehicle.mounted,airborne:mobility.flight.airborne||mobility.jump.airborne});
  walkMode=controls.walk;
  turnPlayerHeading(player,controls,dt,{mounted:mobility.vehicle.mounted});
  updateLookControl(lookControl,player,dt,{mounted:mobility.vehicle.mounted,vehicleHeading:drivingView()==='first'?mobility.vehicle.yaw:undefined});
  const priorVehicleYaw=mobility.vehicle.yaw;
  const previousVerticalSpeed = mobility.jump.airborne?mobility.jump.vy:mobility.flight.vy;
  elapsed += dt;
  const rules = evolutionStats(evolution);
  const wasDashing=dash.active;
  const dashMotion=stepDash(dash,player,stamina,dt,dashContext());
  const launching = controls.lift && !mobility.flight.liftHeld && mobility.flight.energy >= MOBILITY.launchEnergy && !insideWreck(player.x, player.z);
  const onFoot = !mobility.vehicle.mounted && !mobility.flight.airborne && !mobility.jump.airborne && !launching;
  // Observe the same held Shift across a short flight without spending or
  // recovering body energy in the air. Landing must not invent a new key press
  // (or discard a valid sprint session with less than 25% remaining).
  const sprintIntent = !mobility.vehicle.mounted && prepareSprint(stamina, controls);
  const boost = onFoot && sprintIntent;
  if (!onFoot) { stamina.sprinting = false; stamina.moving = false; }
  // Spend only the available sprint time, then finish this simulation step walking.
  const boostTime = boost ? Math.min(dt, stamina.value / rules.sprintDrain) : 0;
  const wasBlocked = blocked; blocked = false;
  if (wasDashing) {
    moving=!!dashMotion?.moving; sprinting=false; blocked=!!dashMotion?.blocked;
    stamina.moving=moving;
    surface=dashMotion?.surface || surface; evolution.restTime=0;
  }
  if (!wasDashing && boostTime > 0) {
    const motion = stepMobility(player, mobility, { ...controls, sprint: true, boost: controls.sprint }, boostTime, story.flags.gateOpen, rules);
    updateStamina(stamina, motion, boostTime, rules); moving = motion.moving; sprinting = stamina.sprinting;
    recordGrowthMotion(motion, boostTime);
    surface = motion.surface; blocked ||= motion.blocked;
  }
  if (!wasDashing && boostTime < dt) {
    const motion = stepMobility(player, mobility, { ...controls, sprint: false, boost: controls.sprint }, dt - boostTime, story.flags.gateOpen, rules);
    if (onFoot && !mobility.flight.airborne) updateStamina(stamina, motion, dt - boostTime, rules);
    if (mobility.vehicle.mounted) {
      prepareSprint(stamina, {});
      updateStamina(stamina, { moving: false, sprinting: false }, dt - boostTime, rules);
    }
    moving = motion.moving; sprinting = false;
    surface = motion.surface; blocked ||= motion.blocked;
    recordGrowthMotion(motion, dt - boostTime);
  }
  if(mobility.vehicle.mounted&&drivingView()==='first')player.yaw+=mobility.vehicle.yaw-priorVehicleYaw;
  scannerCooldown = Math.max(0, scannerCooldown - dt); scanRemaining = Math.max(0, scanRemaining - dt);
  if(updateEquipment(equipment,dt).emit){scanRemaining=SCAN.duration;sound.pulse();}
  const contacts = updateGait(gait, { player, dt, posture:player.posture||'stand', lean:player.lean||0,jump:mobility.jump,grounded: !mobility.flight.airborne && !mobility.jump.airborne && !mobility.vehicle.mounted,
    mounted: mobility.vehicle.mounted, sprinting, surface, sampleGround,
    verticalSpeed: Math.min(previousVerticalSpeed, mobility.jump.airborne?mobility.jump.vy:mobility.flight.vy) });
  for (const contact of contacts) { lastContact = contact; if (!wasDashing) sound.step(contact); }
  if (!mobility.flight.airborne && !mobility.vehicle.mounted) surface = sampleGround(player.x, player.z).surface;
  if (blocked && !wasBlocked) sound.impact(elapsed, sampleImpact(player.x, player.z, {gateOpen:story.flags.gateOpen,vehicle:mobility.vehicle}));
  if (!story.flags.entered && insideWreck(player.x, player.z)) {
    const result = interact(story, 'breach'); ui.toast(result.message); save();
  }
  if (elapsed - lastSave > 12) { lastSave = elapsed; save(); }
  expeditionRuntime?.tick(dt);
}
function sampleGround(x, z) {
  return sampleFooting(x, z, player.y ?? terrainHeight(player.x, player.z),
    { gateOpen: story.flags.gateOpen, vehicle: mobility.vehicle, vehicleHeight: MOBILITY.vehicleBodyHeight });
}
function resetLocomotion() {
  groundCombatRecoil.clear();
  if (!Number.isFinite(player.y)) player.y = terrainHeight(player.x, player.z);
  gait = createGait(player, sampleGround); lastContact = null; sound.reset();
}
function recordGrowthMotion(motion, dt) {
  const mode = mobility.vehicle.mounted ? 'vehicle' : mobility.flight.airborne || motion.surface === 'air' ? 'air' : 'foot';
  recordEvolutionMotion(evolution, { distance: motion.distance, mode, moving: motion.moving || motion.blocked }, dt);
}
function refresh() {
  if (!world) return;
  refreshExpedition();
  const task = currentObjective(), target = allPoints().find(p => p.id === task.target);
  const nav = currentNavigation();
  const growth = evolutionView(evolution, story, evolutionContext()), rules = growth.stats;
  nearby = screen === 'playing' ? findNearby() : null;
  ui.update({ objective: task, targetName: target?.name || '', player, heading: ((-player.yaw * 180 / Math.PI) % 360 + 360) % 360,
    bodyHeading: ((-(mobility.vehicle.mounted ? mobility.vehicle.yaw : player.heading) * 180 / Math.PI) % 360 + 360) % 360,
    distance: target ? Math.hypot(target.x - player.x, target.z - player.z) : 0,
    location: planetRuntime?.legacyActive()!==false&&insideWreck(player.x, player.z) ? (player.z < -711 ? '静默舱' : '坠毁舰 · 内部') : planetRuntime?.location()||'裂环盆地',
    stamina: staminaView(stamina, rules), scannerCooldown, equipment:equipmentView(equipment), interaction: nearby ? { name: nearby.name, hint: interactionHint(nearby) } : null,
    locked: input?.locked || false, captureStatus: input?.captureStatus || 'free', muted: sound.muted, elapsed, complete: story.flags.complete,
    navigation: nav, cameraMode: mobility.vehicle.mounted ? drivingView()==='first'?'vehicle-first':'vehicle' : cameraMode, walkMode, surface, blocked,
    mobility: mobilityView(player, mobility, rules), transportKnown: discovered.has('skimmer'), partKnown: discovered.has('skimmer-part'),
    planet:planetRuntime?.hud(),
    dash:{...dash,unlocked:!!story.flags.signal,cost:600/rules.sprintDuration},
    evolution: growth, stationName: evolutionContext().stationName, survey: surveyView(survey, story),
  });
  flightHUD.update(planetRuntime?.hud(),expeditionRuntime?.combatView());
  if (screen === 'playing' && nav.kind !== 'task' && nav.target) {
    const key = `${nav.kind}:${nav.target.id || `${nav.target.x},${nav.target.z}`}`;
    if (nav.arrived && arrivalKey !== key) {
      arrivalKey = key; sound.interact();
      ui.toast(nav.kind === 'custom' ? '已到达自定义标点。可继续探索，或在地图中清除、更换标点。' : '已到达地点附近。调查物件仍需靠近、面向后按 F。');
    }
    if (nav.distance > 12 && arrivalKey === key) arrivalKey = '';
  }
  marker.hidden = true;
  const guide = nav.target;
  if (screen === 'playing' && guide && guide.aboveHorizon!==false && (nav.kind !== 'task' || scanRemaining > 0)) {
    const point=guide.renderPosition||{x:guide.x,y:terrainHeight(guide.x,guide.z)+2,z:guide.z};
    const projected = new Vector3(point.x,point.y,point.z).project(world.camera);
    if (projected.z < 1 && projected.z > -1 && Math.abs(projected.x) < .85 && Math.abs(projected.y) < .7) {
      marker.hidden = false; marker.style.left = `${(projected.x + 1) * 50}%`; marker.style.top = `${(1 - projected.y) * 50}%`;
      marker.dataset.kind = nav.kind;
      marker.textContent = `◇ ${guide.name} · ${Math.round(nav.distance)} m${nav.arrived ? ' · 附近' : ''}`;
    }
  }
}
function interactionHint(point) {
  if (requiresCalibration(story, point.id)) return 'F · 打开相位调谐终端';
  if (point.id.startsWith('survey-')) return 'F · 调查观测装置';
  if (point.id === 'beacon' && survey.pending) return 'F · 离线封存现场样本';
  if (point.id === 'dismount') return 'F · 停稳后下车';
  if (point.id === 'skimmer-part') return 'F · 回收动力耦合芯';
  if (point.id === 'skimmer') return mobility.vehicle.repaired ? 'F · 驾驶' : mobility.vehicle.coupler ? 'F · 安装耦合芯，修复勘探车' : 'F · 检查缺失部件';
  return 'F · 调查 / 操作';
}
let testSkillCapture=false;
let previous = performance.now(), hudTime = 0, testFrameFrozen = false, testCaptureDash = false, testEquipmentPhase = null,testCaptureCombat=false;
const frameSamples=[];let lastTelemetry=0;
function frame(now) {
  const simulationCpuStart=performance.now();
  const interval=now-previous,dt = Math.min(interval / 1000, .25); previous = now;
  if (testFrameFrozen || labPreparing || labPanelOpen && !sceneDirty && !expeditionLoading) { requestAnimationFrame(frame); return; }
  // Integrate elapsed time in collision-safe steps even when GPU frames are slow.
  for (let remaining = dt; remaining > 0; remaining -= 1/60) simulate(Math.min(remaining, 1/60));
  if(screen==='playing'&&!labPanelOpen)explorationContent?.tick(dt);
  if (screen === 'playing' || sceneDirty) {
    const viewPlayer = screen === 'menu' ? { x:160,z:-330,yaw:.48,pitch:.08 } : player;
    const combat=screen==='playing'&&combatAvailable()?expeditionRuntime?.combatView():null;
    campV2Scene?.update({visible:screen==='playing'&&planetRuntime?.legacyActive()!==false});
    progressionScene?.update({dt:screen==='playing'?dt:0,player:viewPlayer,visible:screen==='playing'&&planetRuntime?.legacyActive()!==false,talkingNpc:progressionControls?.panel.isOpen?expeditionRuntime?.progressionView().nearNpc:null});
    campScene?.update({time:elapsed,dt:screen==='playing'?dt:0,player,visible:screen==='playing'&&planetRuntime?.legacyActive()!==false,dialogOpen:campMenu||progressionMenu});
    world.update({ combat, simulationCpuMs:performance.now()-simulationCpuStart,player:viewPlayer, planetFrame:planetRuntime?.radialFrame(),drivingControls:input.snapshot({mounted:mobility.vehicle.mounted}), time: elapsed, dash, gait: gaitView(gait), moving, sprinting, scanner: scanRemaining,equipment:equipmentView(equipment),flashlight: screen !== 'menu' && flashlight, flags: story.flags, showTool: screen === 'playing', cameraMode: screen === 'menu' ? 'first' : mobility.vehicle.mounted ? drivingView()==='first'?'vehicle-first':'vehicle' : cameraMode, mobility, evolution: evolutionStats(evolution), survey });
    if(testing&&testSkillCapture&&combat?.skills?.casts.some(c=>!c.interrupted&&combat.skills.time>=c.release+.06&&combat.skills.time<c.end)){testFrameFrozen=true;testSkillCapture=false;}
    sceneDirty = false;
    if (testEquipmentPhase === equipment.phase) { testFrameFrozen=true; testEquipmentPhase=null; }
    if (testCaptureDash && dash.active && dash.distance > .5) { testFrameFrozen=true; testCaptureDash=false; }
    if(testCaptureCombat&&combat?.playerCast&&combat.time>=combat.playerCast.due+.01){testFrameFrozen=true;testCaptureCombat=false;}
  }
  hudTime += dt; if (hudTime >= .08) { hudTime = 0; refresh(); }
  if((testing||labMode)&&screen==='playing'&&!expeditionLoading&&interval>0&&interval<1000){
    frameSamples.push(interval);if(frameSamples.length>180)frameSamples.shift();
    if(now-lastTelemetry>1000&&frameSamples.length>=60){lastTelemetry=now;const sorted=[...frameSamples].sort((a,b)=>a-b);canvas.dataset.performance=JSON.stringify({samples:frameSamples.length,averageMs:frameSamples.reduce((a,b)=>a+b,0)/frameSamples.length,p95Ms:sorted[Math.floor(sorted.length*.95)],p99Ms:sorted[Math.floor(sorted.length*.99)],maxMs:sorted.at(-1),over33ms:frameSamples.filter(t=>t>33.34).length,over50ms:frameSamples.filter(t=>t>50).length,calls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles,pixelRatio:world.renderer.getPixelRatio(),...world.shadowRefreshSnapshot()});}
  }else if(screen!=='playing')frameSamples.length=0;
  requestAnimationFrame(frame);
}
window.addEventListener('resize', () => { world.resize(); sceneDirty = true; refresh(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (screen === 'playing' || screen === 'calibration') setScreen('pause'); save(); } });
window.addEventListener('pagehide', save);
function labPlanetStep(controls,dt){return testLab?testLab.step(controls,dt):planetRuntime?.step(controls,dt);}
if(labMode){
  testLab=createTestLab({planet:planetRuntime,context:()=>({player,mobility}),serialize:serializeGame,
    explorationDestinations:explorationContent?.destinations||[],
    runtime:()=>expeditionRuntime,link:()=>expeditionLink,queries:expeditionQueries,
    ready:()=>screen==='playing'&&!expeditionBlocked(),
    block(value){labPanelOpen=value;input.clear();updateControlGate(false);},
    afterMove(){dash.active=false;dash.remaining=0;clearMobilityInput(mobility);player.spaceHoldTime=0;lookControl=createLookControl();resetLocomotion();input.clear();sceneDirty=true;save();updateMap();refresh();},
    inventory(){expeditionAction({type:'menu',open:true});},
    shutdown(){screen='menu';++expeditionEpoch;skillUI?.close();expeditionRuntime?.destroy();expeditionRuntime=null;},
  });
  document.querySelector('#start-button').firstChild.textContent='新建独立境界档 ';
  document.querySelector('#continue-button').firstChild.textContent='继续独立境界档 ';
  document.querySelector('.save-notice').textContent='独立境界测试档 · Shift 加速 / 炼虚起虚步 / 盆地空战 · 正式进度保持隔离';
  document.querySelector('#game-title').textContent=`R${TEST_LAB.realm} 境界测试实验室`;
  window.__STAR_ABYSS_LAB__=Object.freeze({snapshot:()=>({lab:testLab.snapshot(),game:structuredClone(serializeGame()),root:expeditionRuntime?.snapshot(),planet:planetRuntime.snapshot(),checkpointWorker:!!expeditionRuntime?.checkpointWorker,loading:expeditionLoading,error:expeditionError}),show:()=>testLab.show()});
}
setScreen('menu'); world.resize(); requestAnimationFrame(frame);
if(labMode)continueGame();

// Read-only evidence for an explicitly requested local development preview.
if(new URLSearchParams(location.search).has('expeditionDebug')&&['localhost','127.0.0.1'].includes(location.hostname)){
  const evidence=document.createElement('script');evidence.id='expedition-evidence';evidence.type='application/json';document.body.append(evidence);
  Object.defineProperty(window,'__ORIGINAL_EXPEDITION__',{value:Object.freeze({snapshot:()=>({
    game:structuredClone(serializeGame()),screen,menu:expeditionMenu,loading:expeditionLoading,error:expeditionError,
    root:expeditionRuntime?.snapshot()||null,view:expeditionRuntime?.view()||null,progressionScene:progressionScene?.snapshot()||null,
    campV2:campV2Scene?{status:campV2Scene.assetStatus,error:campV2Scene.error,buildings:campV2Scene.buildingStatus}:null,
    campScene:campScene?{status:campScene.assetStatus,error:campScene.error,physician:campScene.position}:null,
  })}),configurable:false,writable:false});
}

// This hook exists only in isolated test mode; tests never touch the user's save.
if (testing) {
  window.__STAR_ABYSS_TEST__ = {
    exploration:()=>explorationContent.snapshot(),
    placeExploration(id){
      const destination=explorationContent.destinations.find(d=>d.id===id);if(!destination)throw Error('Unknown exploration fixture');
      const probe=planetRuntime.adapter.advance(destination.position,{east:0,north:-2,up:0}),support=planetRuntime.prepare(probe);
      if(!support.ready)throw Error('Fixture ground not ready');
      const data=serializeGame();data.planet.position=support.position;data.planet.pose={yaw:0,heading:0,pitch:-.45,posture:'stand'};
      mobility.vehicle.mounted=false;mobility.jump.airborne=false;mobility.flight.airborne=false;
      if(data.planet.gameplay.surfaceVehicle)data.planet.gameplay.surfaceVehicle.mounted=false;
      planetRuntime.reset(data);resetLocomotion();input.clear();sceneDirty=true;save();refresh();return {id,position:support.position};
    },
    freezeFrame(value=true) { testFrameFrozen=!!value; },
    captureNextDash() { testCaptureDash=true; },
    captureNextCombat(){testCaptureCombat=true;testFrameFrozen=false;},
    captureEquipmentPhase(phase) { testEquipmentPhase=phase; testFrameFrozen=false; },
    snapshot: () => ({ frameFrozen:testFrameFrozen, player: { ...player }, lookControl:{...lookControl},freeLook:input.freeLook,controls:input.snapshot({mounted:mobility.vehicle.mounted}),story: structuredClone(story), screen, stamina: { ...stamina }, elapsed, scannerCooldown, captureStatus: input.captureStatus, locked: input.locked,
      camera: world.camera.position.toArray(),cameraDirection:world.camera.getWorldDirection(new Vector3()).toArray(),equipment:equipmentView(equipment),equipmentModel:world.equipmentSnapshot(), cameraMode, vehicleCameraMode:drivingView(), cockpit:world.cockpitSnapshot(), walkMode, cameraRig: world.cameraSnapshot(), navigation: serializeNavigation(navigation), guidance: currentNavigation(), knownPoints: knownPoints().map(p => p.id), surface, blocked,
      mobility: structuredClone(mobility), mobilityStatus: mobilityView(player, mobility, evolutionStats(evolution)),
      evolution: structuredClone(evolution), evolutionStatus: evolutionView(evolution, story, evolutionContext()),
      survey: structuredClone(survey), surveyStatus: surveyView(survey, story), calibration: calibrationView(calibration),
      gait: gaitView(gait), lastContact: lastContact ? {...lastContact} : null, audio: sound.snapshot(), avatarPose: world.avatarSnapshot(),ascension:world.ascensionSnapshot(),combat:expeditionRuntime?.combatView(),airImpulse:planetRuntime?.airImpulseSnapshot(),riftwing:expeditionVisual?.riftwingSnapshot(),
      dash:structuredClone(dash),dashEffect:world.dashSnapshot(),scanEffect: world.scanSnapshot(), graphicsMemory:{...world.renderer.info.memory},
      calls: world.renderer.info.render.calls, triangles: world.renderer.info.render.triangles,renderRatio:world.renderer.getPixelRatio(),rockChunks:world.scene.getObjectByName('physical-rock-field')?.children.length||0,planet:planetRuntime?.snapshot(),planetHud:planetRuntime?.hud() }),
    captureNextSkill(){testSkillCapture=true;testFrameFrozen=false;},
    skillAction:action=>expeditionRuntime?.action(action),skills:()=>expeditionRuntime?.skillsView(),skillRoot:()=>expeditionRuntime?.snapshot(),
    start: newGame,
    advance(seconds, controls = {}) { for (let t = 0; t < seconds; t += 1/60) simulate(Math.min(1/60,seconds-t), controls); refresh(); },
    place(raw) { dash.active=false; dash.remaining=0; player = restorePlayer(raw, story.flags.gateOpen); resetLocomotion(); refresh(); },
    face(x,z) { player.heading = player.yaw = Math.atan2(player.x - x, player.z - z); player.pitch = 0; },
    look(yaw,pitch=0) { player.yaw=yaw;player.pitch=Math.max(-1.35,Math.min(1.35,pitch)); },
    walkTo(x,z) {
      for (let i=0; i<18000 && Math.hypot(x-player.x,z-player.z)>.12; i++) {
        player.heading = player.yaw = Math.atan2(player.x-x,player.z-z); simulate(1/60, { forward:true, sprint:Math.hypot(x-player.x,z-player.z)>3 });
      }
      player.vx=0;player.vz=0;refresh(); return Math.hypot(x-player.x,z-player.z);
    },
    serialize: () => JSON.stringify(serializeGame()),
    restore(raw) { storedSave = JSON.parse(raw); continueGame(); },
  };
}
