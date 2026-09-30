import {openIndexedDB} from './d3-session/indexeddb.mjs';
import {computeAttributes} from './d3-combat/index.mjs';

export function testLabProfile(search=''){
  const params=new URLSearchParams(search),requested=Number(params.get('realm'));
  const realm=params.get('testLab')==='1'&&Number.isInteger(requested)&&requested>=4&&requested<=9?requested:4;
  const arena=params.get('testLab')==='1'&&params.get('arena')==='1';
  const suffix=(realm===4?'':'-r'+realm)+(arena?'-arena-r9':'');
  return {key:'star-abyss-test-lab-v1'+suffix,db:'star-abyss-test-lab-expedition-v1'+suffix,realm,level:1,...(arena?{arena:true}:{})};
}
export const TEST_LAB = Object.freeze(testLabProfile(globalThis.location?.search||''));
export const testLabEnabled = search => new URLSearchParams(search).get('testLab') === '1';
export function testLabLink(previous, fresh=false, uuid=()=>crypto.randomUUID()) {
  if(!fresh && previous?.worldId?.startsWith('test-lab:') && previous?.playerId?.startsWith('test-lab:')&&previous.worldId.startsWith('test-lab:arena:')===!!TEST_LAB.arena)return previous;
  return {version:1,worldId:(TEST_LAB.arena?'test-lab:arena:':'test-lab:')+uuid(),playerId:'test-lab:'+uuid(),rescueRevision:0};
}
export function seedTestLabRoot(root, playerId) {
  if(!root.worldId.startsWith('test-lab:')||!playerId.startsWith('test-lab:'))throw Error('测试档命名空间不匹配');
  const next=structuredClone(root),actor=next.combat.actors.find(a=>a.id===playerId);
  if(!actor)throw Error('测试角色缺失');
  const attributes=computeAttributes({realm:TEST_LAB.realm,level:TEST_LAB.level});
  Object.assign(actor,attributes.effective,{realm:TEST_LAB.realm,level:TEST_LAB.level,hp:attributes.effective.maxHp,resource:attributes.baseResource});
  return next;
}
export async function openTestLabStorage(options, open=openIndexedDB) {
  const storage=await open({...options,name:TEST_LAB.db});
  const playerId=options.sceneConfig.playerId;
  const check=id=>{if(!id?.startsWith('test-lab:'))throw Error('拒绝访问非测试档');};
  return {...storage,
    load(id){check(id);return storage.load(id);},
    initialize(root){check(root.worldId);return storage.initialize(seedTestLabRoot(root,playerId));},
    compareAndSwap(args){check(args.worldId);return storage.compareAndSwap(args);},
  };
}
export async function resetTestLabStorage({storage=localStorage,db=globalThis.indexedDB}={}) {
  await new Promise((resolve,reject)=>{
    const request=db.deleteDatabase(TEST_LAB.db);
    request.onsuccess=resolve;request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(Error('另一个测试页面仍在使用存档，请关闭后重试。'));
  });
  storage.removeItem(TEST_LAB.key);
}
