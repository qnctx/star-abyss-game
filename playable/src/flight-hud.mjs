const showNumber = value => Number.isFinite(value) ? Math.round(value).toLocaleString('zh-CN') : '—';

/** Uses the authoritative planet HUD. Call after the regular UI refresh. */
export function createFlightHUD(doc = globalThis.document) {
  const hud = doc.getElementById('hud');
  const objective = hud?.querySelector('.objective');
  const mobility = doc.getElementById('mobility-status');
  if (!hud || !objective || !mobility) throw new Error('Flight HUD requires the playing HUD');

  let stylesheet = doc.getElementById('flight-hud-style');
  if (!stylesheet) {
    stylesheet = doc.createElement('link');
    stylesheet.id = 'flight-hud-style';
    stylesheet.rel = 'stylesheet';
    stylesheet.href = './css/flight-hud.css';
    doc.head.append(stylesheet);
  }

  const toggle = doc.createElement('button');
  toggle.type = 'button';
  toggle.className = 'flight-objective-toggle';
  toggle.setAttribute('aria-controls', 'objective-detail target-range');
  toggle.hidden = true;
  objective.append(toggle);

  const readout = doc.createElement('div');
  readout.className = 'flight-readout';
  readout.setAttribute('role', 'group');
  readout.setAttribute('aria-label', '自身飞行状态');
  readout.hidden = true;
  const altitude = doc.createElement('p');
  const speed = doc.createElement('p');
  const energy = doc.createElement('p');
  const flightHint = doc.createElement('p');
  const ability = doc.createElement('p');
  const controls = doc.createElement('p');
  controls.textContent = 'G 升 · C 降 · Shift+方向键 加速 · Ctrl 微移｜左键拳脚 · 按住右键格挡 · R 气术 · V 视角';
  const combatStatus=doc.createElement('p');combatStatus.className='air-melee-status';combatStatus.hidden=true;
  readout.append(altitude, speed, energy, flightHint, ability, controls,combatStatus);
  mobility.append(readout);

  let expanded = false;
  const setExpanded = value => {
    expanded = value;
    doc.body.classList.toggle('flight-objective-expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.textContent = expanded ? '收起任务' : '任务详情';
  };
  const onToggle = event => { event.stopPropagation(); setExpanded(!expanded); };
  toggle.addEventListener('click', onToggle);
  setExpanded(false);

  function update(planet,combat) {
    const active = planet?.active === true && hud.hidden !== true;
    doc.body.classList.toggle('flight-active', active);
    toggle.hidden = !active;
    readout.hidden = !active;
    if (!active) { setExpanded(false); return; }
    altitude.textContent = `离地 ${showNumber(planet.agl)} / ${showNumber(planet.maxAgl)} 米`;
    speed.textContent = `${planet.boosting?'加速':'常规'}航速 ${showNumber(planet.speed)} 米/秒`;
    const vertical = Number.isFinite(planet.verticalSpeed) ? planet.verticalSpeed > .3 ? '上升' : planet.verticalSpeed < -.3 ? '下降' : '悬停' : '状态未知';
    energy.textContent = `灵息 ${showNumber(planet.energy)}% · ${vertical}`;
    flightHint.textContent = planet.energy < 10 ? '灵息不足 10%，暂不可加速' :
      planet.agl < 350 ? '低空限速 · 升高后逐渐提速' : '按住 Shift+W 加速前飞';
    ability.textContent=planet.blinkShort?`${planet.realmName} · Y ${planet.blinkShort}m / Shift+Y ${planet.blinkLong}m${planet.blinkCooldown>0?' · 冷却'+Math.ceil(planet.blinkCooldown)+'秒':''}`:'炼虚解锁虚步 · R 空战';
    const melee=combat?.aerialMelee,opponent=melee?.opponents?.find(e=>e.alive!==false),names={jab:'左刺拳',cross:'右直拳',kick:'上挑踢',uppercut:'上挑踢'};
    combatStatus.hidden=!melee;
    if(melee){const now=combat.time||0;const action=now<(melee.stunUntil||0)?'受击硬直':melee.guardBroken?'破防':melee.guarding?'正面格挡':melee.move&&now<(melee.end||0)?names[melee.move]||melee.move:'近战就绪';const event=melee.events?.filter(e=>e.end>now&&['block','parry','guardbreak','impact','launch','whiff'].includes(e.kind)).at(-1),labels={block:'格挡',parry:'弹反',guardbreak:'破防',impact:'命中',launch:'击飞',whiff:'落空'};combatStatus.textContent=`${action}${melee.combo?' · 连段 '+melee.combo:''}${opponent?' · 陪练生命 '+Math.ceil(opponent.hp/Math.max(1,opponent.maxHp)*100)+'%':''}${event?' · '+labels[event.kind]:''}`;}
  }
  function destroy() {
    update(null);
    toggle.removeEventListener('click', onToggle);
    toggle.remove();
    readout.remove();
  }
  return {update, destroy, elements:{toggle,readout,altitude,speed,energy,controls,flightHint}};
}
