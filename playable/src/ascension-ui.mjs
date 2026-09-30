export function createAscensionUI({onOpen,onCommit,doc=document}){
 const style=doc.createElement('link');style.rel='stylesheet';style.href='./css/ascension.css';doc.head.append(style);
 const dialog=doc.createElement('dialog');dialog.id='ascension-preview';dialog.setAttribute('aria-label','长距虚步预览');
 dialog.innerHTML='<h2>长距虚步</h2><p class="ascension-result"></p><p>方向取当前视线。确认时会再次核验路径、落点、灵息和冷却。</p><div class="ascension-actions"><button data-confirm>确认瞬移</button><button data-cancel>取消</button></div>';
 doc.body.append(dialog);let preview=null;
 function close(){preview=null;dialog.close();onOpen(false);}
 dialog.querySelector('[data-cancel]').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.querySelector('[data-confirm]').onclick=()=>{const item=preview;close();if(item)onCommit(item.ticket);};
 return {get open(){return dialog.open;},close,show(result){preview=result;dialog.querySelector('.ascension-result').textContent=result.ok?`距离 ${Math.round(result.ticket.request.distance)} 米 · 消耗灵息 ${result.energyCost}% · 冷却 ${result.cooldown} 秒 · 落点离地 ${Math.round(result.destination.agl)} 米`:result.message;dialog.querySelector('[data-confirm]').disabled=!result.ok;onOpen(true);dialog.showModal();},destroy(){dialog.remove();style.remove();}};
}
