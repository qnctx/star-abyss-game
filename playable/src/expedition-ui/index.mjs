// UI projection only. All game and persistence mutations belong to CORE.
export const authorityNumber = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) ? Number(value) : null;
export function projectView(view = {}) {
  const number = authorityNumber;
  const pair = value => `${number(value?.used) ?? '—'} / ${number(value?.max) ?? '—'}${value?.unit ? ` ${value.unit}` : '（单位未提供）'}`;
  const player = view.player ?? {};
  return { visible: view.visible === true && ['playing','inventory','rescue'].includes(view.screen),
    hp: `${number(player.hp) ?? '—'} / ${number(player.maxHp) ?? '—'}`,
    resource: `${number(player.resource) ?? '—'} / ${number(player.maxResource) ?? '—'}`,
    capacity: `格数 ${pair(view.inventory?.slots)} · 容积 ${pair(view.inventory?.volume)} · 负重 ${pair(view.inventory?.weight)}`,
    save: view.save?.message || ({idle:'尚未保存',saving:'正在保存…',saved:'已保存',error:'保存失败'}[view.save?.status] ?? '保存状态未知'),
    busy: Boolean(view.pending), mounted: Boolean(view.vehicle?.mounted) };
}

export function createExpeditionHUD({onAction = () => {}} = {}) {
  const host = document.querySelector('#app');
  if (!host) throw new Error('Expedition HUD requires original #app');
  const root = document.createElement('section');
  root.className = 'expedition-hud'; root.hidden = true;
  root.setAttribute('aria-label','野外行动');
  root.innerHTML = `<div class="expedition-strip"><span data-hp></span><span data-resource></span><button data-attack></button><button data-open aria-haspopup="dialog">背包 · I</button><button data-rescue-open hidden>救援</button><span data-save role="status"></span></div><div class="expedition-nearby" hidden><span data-nearby></span><button data-interact>交互 · H</button></div><p class="expedition-error" role="alert" hidden></p><section class="expedition-panel" role="dialog" aria-modal="false" aria-label="野外背包" tabindex="-1" hidden><header><h2 data-title>野外背包</h2><button data-close>关闭 · Esc</button></header><div class="expedition-panel-body"><p data-capacity></p><div data-inventory><h3>随身物资</h3><ul data-items></ul><section data-storage hidden><h3 data-storage-label></h3><ul data-stored></ul></section></div><div data-rescue hidden><p data-rescue-detail></p><button data-rescue-submit>返回安全站</button></div><p data-panel-save role="status"></p><p data-panel-error role="alert" hidden></p></div></section>`;
  host.append(root);
  const el = selector => root.querySelector(selector);
  const beastStatus=document.createElement('span');beastStatus.dataset.riftwing='';beastStatus.hidden=true;beastStatus.style.cssText='flex-basis:100%;white-space:normal;line-height:1.5;color:#ebc898';el('.expedition-strip').append(beastStatus);
  const toast = document.querySelector('#toast'), toastStyle = toast?.getAttribute('style');
  const restoreToast = () => { if(toast) { if(toastStyle === null)toast.removeAttribute('style');else toast.setAttribute('style',toastStyle); } };
  let view = {}, menu = null, destroyed = false, priorFocus = null, lastScreen, rescueWasRequired = false;
  const emit = action => { if (!destroyed) onAction(action); };
  function setMenu(next, notify = true) {
    if (menu === next) return;
    const old = menu; menu = next;
    if (next) priorFocus = priorFocus || document.activeElement;
    render();
    if (next) el('[data-close]').focus();
    else { const focus = priorFocus; priorFocus = null; if (focus?.isConnected && !root.hidden) focus.focus(); }
    if (notify) emit({type:'menu',open:Boolean(next),screen:next || old});
  }
  const lists = new Map();
  function rowList(target, items, type) {
    const old = lists.get(target) || new Map(), next = new Map();
    const body = el('.expedition-panel-body'), scroll = body.scrollTop;
    const focused = document.activeElement, focusedId = focused?.dataset.itemId;
    const rows = (Array.isArray(items) ? items : []).map((item, index) => {
      const key = String(item.id ?? `unknown-${index}`);
      const li = old.get(key) || document.createElement('li');
      if (!li.firstChild) li.append(document.createElement('span'));
      li.firstChild.textContent = `${item.name || item.id || '未知物品'} × ${authorityNumber(item.quantity) ?? '—'}`;
      let button = li.querySelector('button:not([data-use-medicine])');
      if (view.storage?.enabled && item.id != null) {
        if (!button) { button = document.createElement('button'); button.dataset.itemId = key;
          button.textContent = type === 'store' ? '存入 1' : '取出 1';
          button.addEventListener('click',()=>emit({type,id:button.itemId,quantity:1})); li.append(button); }
        button.itemId = item.id;
        button.disabled = Boolean(view.pending) || Boolean(item.locked) || !(authorityNumber(item.quantity) > 0);
      } else button?.remove();
      let use=li.querySelector('[data-use-medicine]');
      if(type==='store'&&item.medicine){
        if(!use){use=document.createElement('button');use.dataset.useMedicine='true';use.addEventListener('click',()=>{const itemId=use.itemId;setMenu(null);emit({type:'camp',camp:{action:'use-start',itemId}});});li.append(use);}
        use.itemId=item.id;use.dataset.itemId=item.id;use.textContent=view.medicine?.cooldown>0?`恢复冷却 ${Math.ceil(view.medicine.cooldown)} 秒`:'使用医剂';
        use.disabled=!!view.pending||!!item.locked||!!view.medicine?.active||view.medicine?.cooldown>0||view.medicine?.canUse===false;
      }else use?.remove();
      next.set(key,li); return li;
    });
    if (!rows.length) { const li = old.get('__empty') || document.createElement('li'); li.textContent = Array.isArray(items) ? '暂无物资' : '物资信息未知'; next.set('__empty',li); rows.push(li); }
    // Retain stable nodes; unrelated labels and HP updates never replace focused controls.
    rows.forEach((row,index)=>{if(target.children[index] !== row)target.insertBefore(row,target.children[index] || null)});
    for (const child of [...target.children]) if (!rows.includes(child)) child.remove();
    if (focusedId && target.contains(focused) && !focused.disabled) focused.focus({preventScroll:true});
    else if (old.size && !focused?.isConnected && next.has(focusedId)) next.get(focusedId).querySelector('button:not(:disabled)')?.focus({preventScroll:true});
    body.scrollTop = scroll; lists.set(target,next);
  }
  function layout() {
    if (destroyed || root.hidden) return;
    const flightBottom=Math.ceil(el('.expedition-strip').getBoundingClientRect().bottom+12)+'px';
    if(document.body.style.getPropertyValue('--flight-actions-bottom')!==flightBottom)document.body.style.setProperty('--flight-actions-bottom',flightBottom);
    // The ground strip also grows when a nearby creature exposes its combat state.
    // Keep the objective below it; flight retains its responsive stylesheet layout.
    const objective = document.querySelector('#hud .objective');
    if (objective) objective.style.top = document.body.classList.contains('flight-active') ? '' :
      `${Math.max(innerWidth <= 480 ? 150 : innerWidth <= 1000 ? 160 : 145, parseFloat(flightBottom))}px`;
    const visibleRect = node => node && node.getClientRects().length ? node.getBoundingClientRect() : null;
    const rects = selectors => [...document.querySelectorAll(selectors)].map(visibleRect).filter(Boolean);
    const panel = el('.expedition-panel');
    if (menu) {
      panel.style.top = '';
      let r = panel.getBoundingClientRect(), top = r.top;
      for (const p of rects('#hud .navigation-hud,#hud .compass,.expedition-strip')) {
        if (p.right > r.left && p.left < r.right && p.top <= r.top && p.bottom + 12 > top) top = p.bottom + 12;
      }
      if (top !== r.top) { panel.style.top = `${top}px`; r = panel.getBoundingClientRect(); }
      let bottom = innerHeight - 16;
      for (const p of rects('#hud .suit-status,#hud .hud-controls,#hud .capture-hint,#hud .navigation-hud')) {
        if (p.right > r.left && p.left < r.right && p.top > r.top + 90) bottom = Math.min(bottom,p.top - 12);
      }
      panel.style.maxHeight = `${Math.max(90,bottom-r.top)}px`;
    }
    if(menu && toast && !toast.hidden) {
      const p=panel.getBoundingClientRect(), width=Math.min(220,innerWidth*.46);
      const x=innerWidth-width-16;
      const y=x>p.right+8?p.top:p.bottom+12;
      toast.style.cssText=`left:${x}px;right:auto;top:${y}px;bottom:auto;transform:none;width:${width}px;max-width:${width}px;max-height:${Math.max(40,innerHeight-y-100)}px;overflow:auto;`;
    } else restoreToast();
    const nearby = el('.expedition-nearby');
    if (!nearby.hidden) {
      const blocked = rects('#hud .suit-status,#hud .objective,#hud .location,#hud .capture-hint,#hud .navigation-hud,#hud .hud-controls,#hud .interaction,#toast,.expedition-strip');
      const width = innerWidth <= 720 ? Math.min(220,innerWidth * .46) : Math.min(430,innerWidth-32);
      nearby.style.width = `${width}px`; nearby.style.maxWidth = `${width}px`;
      const height = nearby.getBoundingClientRect().height;
      const xs = [(innerWidth-width)/2,innerWidth-width-16,16];
      let chosen;
      for(let y=Math.round(innerHeight*.4); y>=90 && !chosen; y-=12) for(const x of xs) {
        if(blocked.every(p=>x+width+8<=p.left || x>=p.right+8 || y+height+8<=p.top || y>=p.bottom+8)){chosen={x,y};break;}
      }
      if (chosen) { nearby.style.left=`${chosen.x}px`;nearby.style.top=`${chosen.y}px`;nearby.style.visibility='visible'; }
      else { nearby.style.left='16px';nearby.style.top='90px';nearby.style.visibility='hidden'; }
    }
  }
  let layoutFrame;
  const scheduleLayout = () => { cancelAnimationFrame(layoutFrame); layoutFrame=requestAnimationFrame(layout); };
  const resizeObserver = new ResizeObserver(scheduleLayout);
  for(const node of document.querySelectorAll('#hud .suit-status,#hud .hud-controls,#hud .capture-hint,#hud .navigation-hud,#toast'))resizeObserver.observe(node);
  window.addEventListener('resize',scheduleLayout);
  function render() {
    const focusedOperation = el('.expedition-panel').contains(document.activeElement) && document.activeElement?.tagName === 'BUTTON' ? document.activeElement : null;
    const scrollBefore = el('.expedition-panel-body').scrollTop;
    const state = projectView(view); root.hidden = !state.visible;
    if (!state.visible) { restoreToast(); const objective=document.querySelector('#hud .objective'); if(objective)objective.style.top=''; }
    root.dataset.mounted = String(state.mounted);
    el('[data-hp]').textContent = `生命 ${state.hp}`;
    el('[data-resource]').textContent = `真气 ${state.resource}`;
    const attack = el('[data-attack]');
    attack.textContent = `${view.skill?.label || '攻击'} · R${view.skill?.cooldown > 0 ? ` · ${Math.ceil(view.skill.cooldown)}秒` : ''}`;
    attack.disabled = state.busy || state.mounted || !view.skill?.ready || Boolean(view.rescue?.required);
    attack.title = state.mounted ? '驾驶中不可用' : view.skill?.reason || '';
    el('[data-save]').textContent = state.save;
    const beast=view.enemies?.find(e=>e.kind==='riftwing'&&Math.hypot(e.x-(view.player?.x??Infinity),e.z-(view.player?.z??Infinity))<90);
    beastStatus.hidden=!beast||!!menu;
    if(beast){const modes={ground:'地面',takeoff:'展翼起飞',air:'空中追猎',landing:'收翼落地',dead:'已击杀'},phases={windup:'蓄势 · 留意闪避/格挡',attack:'正在出击',hurt:'受击硬直'};beastStatus.textContent=`裂翼巡猎兽 · ${modes[beast.mode]||'地面'} · ${Math.ceil(beast.hp/Math.max(1,beast.maxHp)*100)}%${phases[beast.phase]?' · '+phases[beast.phase]:''}｜左键拳脚 · 右键格挡`;}
    el('[data-rescue-open]').hidden = !view.rescue?.required;
    el('.expedition-nearby').hidden = !view.nearby || state.mounted || Boolean(menu);
    el('[data-nearby]').textContent = view.nearby ? `${view.nearby.label || ''} · ${view.nearby.detail || ''}` : '';
    el('[data-interact]').disabled = state.busy || !view.nearby?.enabled;
    for (const selector of ['.expedition-error','[data-panel-error]']) { el(selector).hidden = !view.error; el(selector).textContent = view.error || ''; }
    el('.expedition-error').hidden = !view.error || Boolean(menu);
    el('.expedition-panel').setAttribute('aria-label',menu === 'rescue' ? '等待救援' : '野外背包');
    el('.expedition-panel').hidden = !menu;
    el('[data-open]').setAttribute('aria-expanded',String(menu === 'inventory'));
    el('[data-title]').textContent = menu === 'rescue' ? '等待救援' : '野外背包';
    el('[data-inventory]').hidden = menu !== 'inventory'; el('[data-rescue]').hidden = menu !== 'rescue';
    el('[data-capacity]').hidden = menu !== 'inventory'; el('[data-capacity]').textContent = state.capacity;
    el('[data-panel-save]').textContent = state.busy ? `操作处理中 · ${state.save}` : state.save;
    el('[data-rescue-detail]').textContent = view.rescue?.detail || '救援信息等待同步';
    el('[data-rescue-submit]').disabled = state.busy || !view.rescue?.required || !view.rescue?.enabled;
    el('[data-storage]').hidden = !view.storage;
    el('[data-storage-label]').textContent = view.storage?.label || '营地仓库';
    rowList(el('[data-items]'),view.inventory?.items,'store'); rowList(el('[data-stored]'),view.storage?.items,'take');
    // Authority may remove/disable the active operation. Give keyboard users an
    // immediate, always enabled destination instead of a detached node or BODY.
    if (menu && !root.hidden && focusedOperation && (!focusedOperation.isConnected || focusedOperation.disabled || focusedOperation.closest('[hidden]'))) {
      el('[data-close]').focus({preventScroll:true});
      el('.expedition-panel-body').scrollTop = scrollBefore;
    }
    scheduleLayout();
  }
  el('[data-open]').onclick = () => { setMenu(menu === 'inventory' ? null : 'inventory'); emit({type:'toggleInventory'}); };
  const close = () => { setMenu(null); emit({type:'closeInventory'}); };
  el('[data-close]').onclick = close;
  el('[data-rescue-open]').onclick = () => setMenu('rescue');
  el('[data-attack]').onclick = () => emit({type:'attack'});
  el('[data-interact]').onclick = () => emit({type:'interact',id:view.nearby.id,action:view.nearby.action});
  el('[data-rescue-submit]').onclick = () => emit({type:'rescue'});
  const keydown = event => {
    if (!menu || root.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    if (event.key === 'Tab') {
      const buttons = [...el('.expedition-panel').querySelectorAll('button:not(:disabled)')].filter(b=>!b.closest('[hidden]'));
      const index = buttons.indexOf(document.activeElement);
      event.preventDefault(); event.stopImmediatePropagation(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
    }
  };
  window.addEventListener('keydown',keydown,true);
  return { update(next) {
    if (destroyed) return; view = next || {};
    const state = projectView(view);
    if (!state.visible) setMenu(null);
    else if (view.screen !== lastScreen) { if (view.screen === 'inventory' || view.screen === 'rescue') setMenu(view.screen); else if (lastScreen === 'inventory' || lastScreen === 'rescue') setMenu(null); }
    if (state.visible && view.rescue?.required && !rescueWasRequired) setMenu('rescue');
    if (!view.rescue?.required && menu === 'rescue') setMenu(null);
    lastScreen = view.screen; rescueWasRequired = Boolean(view.rescue?.required); render();
  }, destroy() { if(destroyed)return; setMenu(null); destroyed = true; cancelAnimationFrame(layoutFrame);resizeObserver.disconnect();window.removeEventListener('resize',scheduleLayout);window.removeEventListener('keydown',keydown,true);restoreToast(); root.remove(); } };
}
