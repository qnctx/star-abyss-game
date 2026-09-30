export function createSkillUI({onAction,onMenu}){
 const dialog=document.createElement('dialog');dialog.className='combat-skills-panel';dialog.setAttribute('aria-label','战技研习与装备');
 const style=document.createElement('style');style.textContent=`.combat-skills-panel{box-sizing:border-box;width:min(720px,calc(100vw - 24px));max-height:calc(100dvh - 24px);padding:0;border:1px solid #54888d;border-radius:12px;color:#e5f1ee;background:#101d27;z-index:1000;font:14px/1.6 system-ui,sans-serif}.combat-skills-panel::backdrop{background:#000a}.combat-skills-panel header{display:flex;align-items:center;justify-content:space-between;gap:12px;position:sticky;top:0;background:#101d27;padding:12px 18px;z-index:1}.combat-skills-panel h2{font-size:19px;margin:0}.combat-skills-panel .skill-body{padding:0 18px 18px;overflow:auto}.combat-skills-panel .skill-card{border-top:1px solid #35525d;padding:12px 0}.combat-skills-panel p{margin:5px 0;overflow-wrap:anywhere}.combat-skills-panel button{white-space:normal;min-height:38px;border:1px solid #54888d;border-radius:6px;background:#23414b;color:#edf7f2;padding:7px 12px;font:inherit;cursor:pointer}.combat-skills-panel button:disabled{opacity:.45;cursor:default}.combat-skills-panel .skill-actions{display:flex;flex-wrap:wrap;gap:8px}.combat-skills-panel .skill-feedback{color:#ffd48a}.combat-skills-panel .skill-meta{color:#a6c6cc}`;
 document.head.append(style);dialog.innerHTML='<header><h2>战技研习与装备</h2><button data-close>关闭 · Esc</button></header><div class="skill-body"><p>武器战技：1 · 主动一：2 · 主动二：3 · 研习：K</p><p data-location></p><p class="skill-feedback" aria-live="polite" data-feedback></p><div data-cards></div></div>';document.body.append(dialog);
 let view=null,visible=false,launcher=null;const cards=new Map();
 const close=()=>{dialog.close();onMenu(false);};dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',()=>onMenu(false));
 function show(){if(!visible||!view)return;dialog.showModal();onMenu(true);dialog.querySelector('[data-close]').focus();}
 const button=(text,action)=>{const b=document.createElement('button');b.textContent=text;b.onclick=action;return b;};
 for(const id of ['WS01','WS03','ES05','ES13','HS04','HS06']){const row=document.createElement('section');row.className='skill-card';row.dataset.skill=id;
  const title=document.createElement('strong'),meta=document.createElement('p'),detail=document.createElement('p'),actions=document.createElement('div');meta.className='skill-meta';actions.className='skill-actions';
  const teach=button('开始导引',()=>onAction({type:'skill-manage',skill:{action:'guide',skillId:id}}));
  const demo=button('执行演示',()=>{close();onAction({type:'skill-cast',skillId:id,training:true});});
  const equip0=button('装备',()=>onAction({type:'skill-manage',skill:{action:'equip',skillId:id,slot:0}})),equip1=button('装备主动二',()=>onAction({type:'skill-manage',skill:{action:'equip',skillId:id,slot:1}}));
  const upgrade=button('确认进阶',()=>onAction({type:'skill-manage',skill:{action:'upgrade',skillId:id}}));
  const cast=button('施放',()=>{close();onAction({type:'skill-cast',skillId:id});});
  actions.append(teach,demo,equip0,equip1,upgrade,cast);row.append(title,meta,detail,actions);dialog.querySelector('[data-cards]').append(row);cards.set(id,{row,title,meta,detail,teach,demo,equip0,equip1,upgrade,cast});
 }
 function update(next,shown){view=next;visible=shown;if(!visible&&dialog.open)close();if(!launcher){const strip=document.querySelector('.expedition-strip');if(strip){launcher=button('战技 · K',show);launcher.dataset.skillsOpen='';strip.append(launcher);}}if(launcher)launcher.hidden=!visible;if(!view)return;
  dialog.querySelector('[data-location]').textContent=view.nearInstructor?'祁岳训练区：面向北方，完成正确演示。训练不增加实战熟练度。':`前往曙光营地祁岳处（${view.instructor.x}，${view.instructor.z}）开始导引。已学技能可随时调整装备。`;
  dialog.querySelector('[data-feedback]').textContent=view.error||view.feedback;
  for(const d of view.skills){const c=cards.get(d.id);c.title.textContent=`${d.name} · ${d.id} · ${d.stage}${d.equipped?' · 已装备':''}`;c.meta.textContent=`R${d.realm} / D${d.difficulty} · 耗能${d.cost}% · ${d.cooldown>0?`冷却 ${d.cooldown.toFixed(1)}秒`:'冷却就绪'} · 熟练度 ${d.practice}`;c.detail.textContent=d.learned?'主动槽 2 / 被动槽 2 / 武器战技槽 1；五阶掌握需实战记录。':`${d.source} · 演示 ${d.demonstrations}/${d.required}`;
   c.teach.hidden=d.learned||d.guided;c.teach.disabled=view.busy||!view.nearInstructor||!d.realmAllowed||!d.sourceAvailable;
   c.demo.hidden=d.learned||!d.guided;c.demo.disabled=view.busy||view.casting||d.cooldown>0||!view.nearInstructor;
   c.equip0.hidden=!d.learned;c.equip0.textContent=d.slot==='weapon'?'装备武器战技':'装备主动一';c.equip0.disabled=view.busy||view.casting;
   c.equip1.hidden=!d.learned||d.slot==='weapon';c.equip1.disabled=view.busy||view.casting;
   c.upgrade.hidden=!d.learned||d.mastery===5;c.upgrade.disabled=view.busy||view.casting||!d.upgradeReady;
   c.cast.hidden=!d.equipped;c.cast.disabled=view.busy||view.casting||d.cooldown>0;
  }
 }
 const key=e=>{if(!visible||e.repeat||e.ctrlKey||e.altKey||e.metaKey||e.target.closest?.('input,textarea,select'))return;if(e.code==='KeyK'){e.preventDefault();e.stopImmediatePropagation();if(dialog.open)close();else show();}else if(!dialog.open&&['Digit1','Digit2','Digit3'].includes(e.code)){e.preventDefault();onAction({type:'skill-cast',slot:e.code==='Digit1'?'weapon':Number(e.code.slice(-1))-2});}};
 window.addEventListener('keydown',key,true);return {update,close,destroy(){close();window.removeEventListener('keydown',key,true);dialog.remove();style.remove();launcher?.remove();}};
}
