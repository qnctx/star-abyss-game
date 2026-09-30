export function createInput(canvas, handlers) {
  const doc = canvas.ownerDocument;
  const win = doc.defaultView;
  const held = new Set();
  let enabled = false, dragging = false, wasLocked = false, disposed = false;
  let captureWanted = false, unlockPending = false, request = null, captureStatus = 'free';
  let lastExternalUnlock = -Infinity, autoRun=false;
  let dragPoint=null, clickStart=null, mouseGuard=false;
  const guarding=()=>mouseGuard||held.has('KeyO');
  const canMelee=()=>handlers.canMelee?handlers.canMelee():!!handlers.isFlying?.();
  function setMouseGuard(value){const before=guarding();mouseGuard=value;if(before!==guarding())handlers.guard?.(guarding());}
  const movementKeys = new Set(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','ControlLeft','ControlRight','KeyG','KeyC','Space']);
  const actions = { KeyY:'blink',KeyP:'planet',KeyQ:'scan',KeyE:'dash',KeyB: 'dash', KeyF: 'interact', KeyL: 'light', KeyX: 'scan', KeyV: 'camera', KeyC: 'crouch', KeyZ:'prone', Equal:'autorun', KeyT: 'transport', KeyU: 'evolution', KeyJ: 'records', KeyM:'journal', Tab: 'journal', Escape: 'pause' };
  const isFreeLook=()=>held.has('AltLeft')||held.has('AltRight');
  function clear() { const free=isFreeLook();if(guarding())handlers.guard?.(false);mouseGuard=false;clickStart=null;held.clear();autoRun=false; dragging = false;if(free)handlers.freeLook?.(false); }
  function status(value) { captureStatus = value; if (!disposed) handlers.captureChanged?.(); }
  function captureFailed(attempt) {
    if (disposed || request !== attempt) return;
    request = null;
    if (enabled && captureWanted) status('blocked');
  }
  function capture() {
    if (disposed || !enabled || !captureWanted || doc.hidden) return;
    if (unlockPending) { status('pending'); return; }
    if (doc.pointerLockElement === canvas) { status('locked'); return; }
    if (request) return;
    if (!canvas.requestPointerLock) { status('unavailable'); return; }
    // Call inside the actual resume key/button event, while user activation is valid.
    const attempt = {}; request = attempt; status('pending');
    canvas.focus({ preventScroll: true });
    try {
      const result = canvas.requestPointerLock();
      result?.then(() => { if (disposed || !enabled || !captureWanted) release(); }, () => captureFailed(attempt));
    } catch { captureFailed(attempt); }
  }
  function release() {
    if (doc.pointerLockElement === canvas && !unlockPending) {
      // The DOM can acquire the lock before its queued change event is delivered.
      // Releasing that lock also settles the old request; it must not block resume.
      request = null;
      unlockPending = true; doc.exitPointerLock();
    }
  }
  function keydown(event) {
    if(event.metaKey)return;
    if(event.ctrlKey&&!['ControlLeft','ControlRight'].includes(event.code)&&!(enabled&&(held.has('ControlLeft')||held.has('ControlRight'))&&(movementKeys.has(event.code)||['AltLeft','AltRight','KeyZ','KeyC','KeyQ','KeyE','KeyV'].includes(event.code))))return;
    if(event.code==='AltLeft'||event.code==='AltRight'){
      if(enabled){event.preventDefault();const wasFree=isFreeLook();held.add(event.code);if(!wasFree)handlers.freeLook?.(true);}return;
    }
    // Movement still works while looking around; OS/browser Alt shortcuts do not
    // become gameplay actions (in particular Alt+Tab must remain untouched).
    if(event.altKey&&!(enabled&&isFreeLook()&&movementKeys.has(event.code)))return;
    if (event.code === 'Escape') {
      event.preventDefault();
      // Some browsers send Escape after their default unlock has already paused us.
      if (!event.repeat && win.performance.now() - lastExternalUnlock > 250) handlers.action('pause');
      return;
    }
    const interactive = event.target.closest?.('button,input,textarea,select,a');
    if (interactive && !enabled && !(['Tab','KeyM','KeyJ','KeyU'].includes(event.code) && interactive.tagName === 'BUTTON')) return;
    if (movementKeys.has(event.code) || actions[event.code]) event.preventDefault();
    if (event.repeat) return;
    if(enabled&&event.code==='KeyN'&&canMelee()){event.preventDefault();handlers.action('air-melee');return;}
    if(enabled&&event.code==='KeyO'&&canMelee()){event.preventDefault();const before=guarding();held.add('KeyO');if(!before)handlers.guard?.(true);return;}
    // If browser policy rejected a resume request, a fresh gameplay key can retry;
    // never poll or recapture on focus alone after the user leaves the window.
    if (enabled && captureWanted && (movementKeys.has(event.code) || actions[event.code])) capture();
    if(enabled&&['KeyW','KeyS','ArrowUp','ArrowDown'].includes(event.code))autoRun=false;
    if(enabled&&event.code==='Equal')autoRun=!autoRun;
    else if (actions[event.code] && (enabled || ['Tab','KeyM','Escape','KeyU','KeyJ'].includes(event.code)) && !(event.code==='KeyC'&&handlers.isFlying?.())) handlers.action(actions[event.code]);
    if (enabled && movementKeys.has(event.code)) held.add(event.code);
  }
  function keyup(event) { const free=isFreeLook(),before=guarding();held.delete(event.code);if(before!==guarding())handlers.guard?.(guarding());if(free&&!isFreeLook()){event.preventDefault();handlers.freeLook?.(false);} }
  function mousemove(event) {
    if(mouseGuard&&!(event.buttons&2))setMouseGuard(false);
    if(clickStart){clickStart.distance+=Math.hypot(event.movementX||0,event.movementY||0);if(Number.isFinite(event.clientX))clickStart.distance=Math.max(clickStart.distance,Math.hypot(event.clientX-clickStart.x,event.clientY-clickStart.y));}
    if (dragging && !(event.buttons & 1)) dragging = false;
    const locked=doc.pointerLockElement===canvas;
    if (enabled && (locked || dragging)) {
      // Some embedded browsers omit movementX/Y without pointer lock. Client
      // coordinates provide reliable drag deltas in both camera modes.
      const point=Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)?[event.clientX,event.clientY]:null;
      const dx=!locked&&point&&dragPoint?point[0]-dragPoint[0]:event.movementX||0;
      const dy=!locked&&point&&dragPoint?point[1]-dragPoint[1]:event.movementY||0;
      handlers.look(dx,dy);dragPoint=point;
    }
  }
  function pointerdown(event) {
    if (!enabled || event.target.closest?.('button,input,textarea,select,a')) return;
    if(event.button===2&&canMelee()){event.preventDefault();setMouseGuard(true);return;}
    if(event.button!==0)return;
    if(doc.pointerLockElement===canvas){if(canMelee())handlers.action('air-melee');return;}
    // Capture clicks never attack. Without pointer lock, a short stationary
    // click attacks on release while a drag remains camera control.
    clickStart={x:event.clientX||0,y:event.clientY||0,time:win.performance.now(),distance:0};
    dragging = true;dragPoint=Number.isFinite(event.clientX)&&Number.isFinite(event.clientY)?[event.clientX,event.clientY]:null; canvas.focus({ preventScroll: true });
    captureWanted = true; capture();
  }
  function pointerup(event) {
    if(event.button===2)setMouseGuard(false);
    if(event.button===0||event.button===undefined){
      if(enabled&&event.target===canvas&&clickStart&&clickStart.distance<5&&win.performance.now()-clickStart.time<350&&['blocked','unavailable'].includes(captureStatus)&&canMelee())handlers.action('air-melee');
      clickStart=null;dragging=false;
    }
  }
  function contextMenu(event){if(enabled&&canMelee())event.preventDefault();}
  function blur() { clear(); captureWanted = false; handlers.blur(); }
  function lockChange() {
    const locked = doc.pointerLockElement === canvas;
    const previouslyLocked = wasLocked, expectedUnlock = unlockPending;
    wasLocked = locked;
    dragging = false;
    if (locked) {
      clickStart=null;
      request = null; unlockPending = false;
      if (disposed || !enabled || !captureWanted) { release(); return; }
      status('locked');
    } else {
      unlockPending = false;
      if (expectedUnlock) {
        // Rapid Tab open/close can return before the programmatic unlock event.
        if (enabled && captureWanted) capture(); else status('free');
      } else if (previouslyLocked && enabled) {
        lastExternalUnlock = win.performance.now(); captureWanted = false;
        clear(); status('free'); handlers.blur();
      } else status(request && enabled ? 'pending' : 'free');
    }
  }
  function lockError() { if (request) captureFailed(request); }
  doc.addEventListener('keydown', keydown);
  doc.addEventListener('keyup', keyup);
  doc.addEventListener('mousemove', mousemove);
  doc.addEventListener('mouseup', pointerup);
  doc.addEventListener('pointerlockchange', lockChange);
  doc.addEventListener('pointerlockerror', lockError);
  canvas.addEventListener('mousedown', pointerdown);
  canvas.addEventListener('contextmenu', contextMenu);
  win.addEventListener('blur', blur);
  return {
    clear,
    setEnabled(value, { capture: shouldCapture = false } = {}) {
      enabled = value; clear(); captureWanted = value && shouldCapture;
      if (!value) { release(); status('free'); }
      else if (shouldCapture) capture();
    },
    get locked() { return doc.pointerLockElement === canvas; },
    get captureStatus() { return captureStatus; },
    get freeLook() { return isFreeLook(); },
    snapshot({ mounted = false } = {}) { return { forward: (!mounted&&autoRun)||held.has('KeyW') || held.has('ArrowUp'), backward: held.has('KeyS') || held.has('ArrowDown'), left: held.has('KeyA') || (mounted && held.has('ArrowLeft')), right: held.has('KeyD') || (mounted && held.has('ArrowRight')), turnLeft: !mounted && held.has('ArrowLeft'), turnRight: !mounted && held.has('ArrowRight'), sprint: held.has('ShiftLeft') || held.has('ShiftRight'), lift: mounted?held.has('Space'):held.has('KeyG'), jump:!mounted&&held.has('Space'), walk:held.has('ControlLeft')||held.has('ControlRight'), descend:held.has('KeyC'), leanLeft:false,leanRight:false,autoRun:!mounted&&autoRun }; },
    dispose() {
      disposed = true; enabled = false; captureWanted = false; clear(); release();
      doc.removeEventListener('keydown', keydown); doc.removeEventListener('keyup', keyup);
      doc.removeEventListener('mousemove', mousemove); doc.removeEventListener('mouseup', pointerup);
      doc.removeEventListener('pointerlockchange', lockChange); doc.removeEventListener('pointerlockerror', lockError);
      canvas.removeEventListener('mousedown', pointerdown);canvas.removeEventListener('contextmenu', contextMenu); win.removeEventListener('blur', blur);
    },
  };
}
