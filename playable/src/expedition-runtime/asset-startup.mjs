// Each caller owns its request epoch. A resolved old promise never grants admission.
export async function waitForWorldAssets(visual,{retry=false,isCurrent=()=>true}={}){
  const promise=retry?visual.retry():visual.ready;
  const state=await promise;
  if(!isCurrent())return false;
  if(state?.status!=='ready'||visual.assetStatus?.status!=='ready'){
    throw new Error('生物模型加载失败，玩法已暂停。请重试，或返回菜单稍后继续。');
  }
  return true;
}

export function createAssetStartupPanel({onRetry,onMenu}){
  const overlay=document.createElement('div');
  overlay.id='expedition-startup';
  overlay.style.cssText='position:fixed;inset:0;z-index:10000;display:none;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;background:rgba(4,12,18,.86);overflow:auto;pointer-events:auto';
  const panel=document.createElement('section');
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','外勤加载');
  panel.style.cssText='width:100%;max-width:460px;max-height:100%;overflow:auto;padding:24px;box-sizing:border-box;background:#10232d;color:#e6f7fa;border:1px solid #5d98aa;border-radius:12px;font:16px/1.7 sans-serif;overflow-wrap:anywhere';
  const title=document.createElement('h2');title.textContent='正在准备外勤';title.style.margin='0 0 12px';
  const message=document.createElement('p');message.setAttribute('role','status');
  const actions=document.createElement('div');actions.style.cssText='display:flex;flex-wrap:wrap;gap:12px';
  const retry=document.createElement('button'),menu=document.createElement('button');
  retry.textContent='重试加载';menu.textContent='返回菜单';
  for(const button of [retry,menu]){button.type='button';button.style.cssText='min-height:44px;padding:10px 18px;font:inherit;white-space:normal;cursor:pointer';actions.append(button);}
  retry.onclick=onRetry;menu.onclick=onMenu;panel.append(title,message,actions);overlay.append(panel);document.body.append(overlay);
  document.addEventListener('keydown',event=>{
    if(overlay.style.display==='none')return;
    event.stopPropagation(); // Original input permits menu shortcuts even while disabled.
    if(event.key!=='Tab')return;
    event.preventDefault();
    const buttons=retry.hidden?[menu]:[retry,menu],index=buttons.indexOf(document.activeElement);
    buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus({preventScroll:true});
  },true);
  document.addEventListener('focusin',event=>{
    if(overlay.style.display!=='none'&&!overlay.contains(event.target))(retry.hidden?menu:retry).focus({preventScroll:true});
  });
  return {update({visible,loading,error}){
    const opening=visible&&overlay.style.display==='none';
    overlay.style.display=visible?'flex':'none';
    title.textContent=error?'外勤暂未就绪':'正在准备外勤';
    message.textContent=error||'正在加载生物模型和外勤存档，请稍候。加载完成前移动与战斗已暂停。';
    retry.hidden=loading;retry.disabled=loading;
    if(visible&&loading&&document.activeElement===retry)menu.focus({preventScroll:true});
    if(opening)(loading?menu:retry).focus({preventScroll:true});
  }};
}
