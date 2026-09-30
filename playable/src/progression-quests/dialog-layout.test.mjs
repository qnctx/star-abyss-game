import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createQuestPanel} from './ui.mjs';
import {createCampUI} from '../foundation/camp-ui.mjs';
import {createProgressionScene} from './scene.mjs';

function fakeDom(){
 const classes=new Set();
 const classList={add:name=>classes.add(name),remove:name=>classes.delete(name),contains:name=>classes.has(name),toggle:(name,on)=>on?classes.add(name):classes.delete(name)};
 class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.hidden=false;this.listeners={};this.html='';this.body={scrollTop:0,scrollHeight:800};}
  append(child){this.children.push(child);}
  addEventListener(name,fn){this.listeners[name]=fn;}
  setAttribute(){}
  remove(){}
  contains(){return false;}
  focus(){}
  set innerHTML(value){this.html=value;this.body={scrollTop:0,scrollHeight:800};}
  get innerHTML(){return this.html;}
  querySelector(selector){if(selector==='.quest-body'||selector==='.camp-body')return this.html.includes(selector.slice(1))?this.body:null;if(selector==='[data-act="confirm"]')return this.html.includes('data-act="confirm"')?{focus(){}}:null;if(selector==='[data-close]')return this.html.includes('data-close')?{focus(){}}:null;return null;}
  querySelectorAll(){return [];}
  getContext(){return {fillRect(){},fillText(){}};}
 }
 const document={body:new Element('body'),head:new Element('head'),activeElement:null,createElement:tag=>new Element(tag)};
 document.body.classList=classList;
 const window={addEventListener(){},removeEventListener(){}};
 return {document,window};
}

test('NPC and physician dialogs keep a fixed close control and connected actions',async()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window,{document,window}=fakeDom();globalThis.document=document;globalThis.window=window;
 try {
  const sent=[];const quest=createQuestPanel({onAction:action=>sent.push(action),onClose:()=>{}});
  quest.update({nearNpc:'N04',realmName:'后天',level:1,xp:0,required:100,coins:14,quests:[{id:'Q03',npc:'N04',name:'商站基础补给',description:'交付三份月露苔',xp:40,coins:12,status:'active',ready:true}],market:{budget:100,shop:[{id:'solvent',name:'溶剂',price:1,stock:12}],buyback:[]},iron:0,refined:0,stones:0,error:''});
  quest.open('N04');const panel=document.body.children.at(-1);
  assert(document.body.classList.contains('quest-dialog-open'));
  assert.match(panel.innerHTML,/<header class="quest-header">/);
  assert.match(panel.innerHTML,/class="quest-body"/);
  assert.match(panel.innerHTML,/data-act="deliver:Q03"/);
  assert.match(panel.innerHTML,/data-act="buy:solvent"/);
  await panel.listeners.click({target:{closest:()=>({dataset:{act:'deliver:Q03'},disabled:false,textContent:'交付'})}});
  assert.match(panel.innerHTML,/data-act="confirm"/);
  assert.equal(panel.body.scrollTop,panel.body.scrollHeight);
  await panel.listeners.click({target:{closest:()=>({dataset:{act:'confirm'},disabled:false})}});
  assert.deepEqual(sent,[{action:'deliver',npc:'N04',quest:'Q03'}]);
  quest.close();assert(!document.body.classList.contains('quest-dialog-open'));quest.destroy();

  const campActions=[];const camp=createCampUI({host:document.body,onAction:action=>campActions.push(action)});
  camp.update({near:true,busy:false,taught:false,kitPending:false,sampleCount:1,coins:0,buybackBudget:100,cooldown:0,orders:[],recipes:[{id:'MED02',name:'电容补剂',effect:'补充电容',quality:1,ingredients:[],craftSeconds:30,fee:0,canCraft:true}],shop:[],buyback:[],medicines:[],use:null,error:''});
  camp.open();const root=document.body.children.at(-1);
  assert(document.body.classList.contains('camp-dialog-open'));
  assert.match(root.innerHTML,/class="camp-dialog"/);
  assert.match(root.innerHTML,/data-close/);
  await root.listeners.click({target:{closest:()=>({dataset:{tab:'craft'},disabled:false,hasAttribute:()=>false})}});
  assert.match(root.innerHTML,/data-command="craft" data-recipe="MED02"/);
  camp.close();assert(!document.body.classList.contains('camp-dialog-open'));camp.destroy();

  const styles=document.head.children.map(el=>el.textContent).join('\n');
  assert.match(styles,/top:50%;transform:translate\(-50%,-50%\)/);
  assert.match(styles,/overflow-y:auto/);
 } finally {globalThis.document=oldDocument;globalThis.window=oldWindow;}
});

test('3D labels stay compact, appear only nearby and hide during either dialog',async()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window,{document,window}=fakeDom();globalThis.document=document;globalThis.window=window;
 try {
  const scene=new THREE.Scene();for(let i=1;i<=3;i++){const relay=new THREE.Group();relay.name='relay-'+i;relay.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial()));scene.add(relay);}
  const view=createProgressionScene({scene,assets:{}});await view.ready;
  const sprite=scene.getObjectByName('breath-1').children.find(child=>child.isSprite);
  assert(sprite);assert.equal(sprite.material.sizeAttenuation,false);assert.ok(sprite.scale.x<=.16&&sprite.scale.y<=.035);
  view.update({player:{x:0,z:211}});assert.equal(sprite.visible,false);
  view.update({player:{x:-38,z:154}});assert.equal(sprite.visible,true);
  document.body.classList.add('quest-dialog-open');view.update({player:{x:-38,z:154}});assert.equal(sprite.visible,false);
  document.body.classList.remove('quest-dialog-open');document.body.classList.add('camp-dialog-open');view.update({player:{x:-38,z:154}});assert.equal(sprite.visible,false);
  document.body.classList.remove('camp-dialog-open');view.update({player:{x:-38,z:154}});assert.equal(sprite.visible,true);
  window.innerHeight=600;view.update({player:{x:-38,z:154}});assert.equal(sprite.scale.x,.155*1.5);assert.equal(sprite.scale.y,.032*1.5);
  view.update({player:{x:-26,z:154}});assert.equal(sprite.visible,false,'12 m away is beyond the 11 m label range');
  view.dispose();
 } finally {globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
