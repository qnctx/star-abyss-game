import { WORLD, WALLS, GATE, insideWreck, legacyTerrainHeight } from './layout.mjs';
import { MAP, createMapView, clampMapView, projectMap, unprojectMap, panMap, zoomMap } from './navigation.mjs';
import {createCartography} from './cartography.mjs';

const NS = 'http://www.w3.org/2000/svg';
const bearingNames = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const distanceText = n => !Number.isFinite(n) ? '—' : n >= 1000 ? `${(n / 1000).toFixed(2)} km` : `${Math.round(n)} m`;
const coordinateText = ({ x = 0, z = 0 }) => `X ${Math.round(x)} · Z ${Math.round(z)}`;

/** The UI reflects game state; no objectives or progress are simulated here. */
export function createUI(actions) {
  const byId = id => document.getElementById(id);
  const screens = Object.fromEntries(['menu', 'journal', 'pause', 'complete', 'calibration'].map(name => [name, byId(`${name}-screen`)]));
  const hud = byId('hud');
  let hasSave = false;
  let currentScreen = 'menu';
  let lastHeading = 0;
  const contentKeys=new Map();
  function updateParts(id,key,create){if(contentKeys.get(id)===key)return;contentKeys.set(id,key);byId(id).replaceChildren(...create());}
  let lastBodyHeading = 0;
  let mapPlayer = { ...WORLD.spawn };
  let mapPoints = [];
  const mapView = createMapView();
  let mapOptions = {};
  let mapMode = 'nearby';
  let followPlayer = true;
  let archiveTab = 'map';
  let basinAtlas=null;
  let drag = null;
  let toastTimer;
  let lastGrowth = null, lastStation = '', growthSignature = '';
  const call = name => actions[name]?.();
  const selectMapPoint=id=>id?.startsWith('exploration:')?actions.planetWaypoint?.({id}):actions.setWaypoint?.({pointId:id});
  const on = (id, fn) => byId(id).addEventListener('click', fn);
  const hideConfirmation = () => { byId('new-confirm').hidden = true; };
  on('start-button', () => {
    if (!hasSave) { call('start'); return; }
    byId('new-confirm').hidden = false;
    byId('cancel-new-button').focus();
  });
  on('continue-button', () => call('continueGame'));
  on('cancel-new-button', () => { hideConfirmation(); byId('start-button').focus(); });
  on('confirm-new-button', () => { hideConfirmation(); call('newGame'); });
  on('journal-button', () => call('toggleJournal'));
  on('records-button', () => call('openRecords'));
  on('pause-records-button', () => call('openRecords'));
  on('pause-evolution-button', () => call('openEvolution'));
  on('close-records-button', () => call('toggleJournal'));
  on('close-evolution-button', () => call('toggleJournal'));
  on('pause-journal-button', () => call('toggleJournal'));
  on('close-journal-button', () => call('toggleJournal'));
  on('pause-button', () => call('togglePause'));
  on('camera-button', () => call('toggleCamera'));
  on('walk-button', () => call('toggleWalk'));
  on('evolution-button', () => call('openEvolution'));
  on('evolve-body-button', () => actions.upgrade?.('body'));
  on('evolve-equipment-button', () => actions.upgrade?.('equipment'));
  on('track-calibration-button', () => call('trackCalibration'));
  on('track-transport-button', () => call('trackTransport'));
  on('resume-button', () => call('resume'));
  on('sound-button', () => call('toggleSound'));
  on('complete-journal-button', () => call('openRecords'));
  on('explore-button', () => call('resume'));
  on('map-planet', () => {mapMode='planet';drawMap();});
  on('planet-map-clear',()=>actions.planetWaypoint?.(null));
  byId('planet-map-image').addEventListener('click',event=>{
    const image=event.currentTarget.querySelector('svg');if(!image)return;
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(image.getScreenCTM().inverse());
    actions.planetWaypoint?.({x:point.x,y:point.y});
  });
  byId('planet-map-image').addEventListener('keydown',event=>{
    const target=event.target.closest('[data-target]');
    if(target&&(event.code==='Enter'||event.code==='Space')){event.preventDefault();event.stopPropagation();actions.planetWaypoint?.({id:target.dataset.target});}
  });
  on('map-zoom-in', () => { zoomMap(mapView, .7); drawMap(); });
  on('map-zoom-out', () => { zoomMap(mapView, 1 / .7); drawMap(); });
  on('map-nearby', () => { mapMode = 'nearby'; followPlayer = true; Object.assign(mapView, { ...mapPlayer, span: MAP.nearby }); clampMapView(mapView); drawMap(); });
  on('map-world', () => { mapMode = 'world'; followPlayer = false; Object.assign(mapView, { x: 0, z: 0, span: MAP.maxSpan }); drawMap(); });
  on('map-interior', () => { mapMode = 'interior'; followPlayer = false; Object.assign(mapView, { x: 0, z: -630, span: MAP.interior }); drawMap(); });
  on('map-center', () => { followPlayer = true; Object.assign(mapView, mapPlayer); clampMapView(mapView); drawMap(); });
  on('map-clear-waypoint', () => call('clearWaypoint'));
  const mapElement = byId('survey-map');
  const mapPosition = event => {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(mapElement.getScreenCTM().inverse());
    return { x: point.x, y: point.y };
  };
  mapElement.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const p = mapPosition(event);
    if (p.x < 25 || p.x > 575 || p.y < 25 || p.y > 575) return;
    drag = { x: event.clientX, y: event.clientY, point: p, moved: false, pointId: event.target.closest('[data-point-id]')?.dataset.pointId };
    mapElement.setPointerCapture(event.pointerId); event.preventDefault();
  });
  mapElement.addEventListener('pointermove', event => {
    if (!drag) return;
    const p = mapPosition(event);
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 5) drag.moved = true;
    if (drag.moved) { followPlayer = false; panMap(mapView, p.x - drag.point.x, p.y - drag.point.y); drawMap(); }
    drag.point = p;
  });
  mapElement.addEventListener('pointerup', event => {
    if (!drag) return;
    const selection = drag; drag = null;
    if (mapElement.hasPointerCapture(event.pointerId)) mapElement.releasePointerCapture(event.pointerId);
    const p = mapPosition(event);
    if (!selection.moved && p.x >= 25 && p.x <= 575 && p.y >= 25 && p.y <= 575) {
      if(selection.pointId)selectMapPoint(selection.pointId);else actions.setWaypoint?.(unprojectMap(p,mapView));
    }
  });
  mapElement.addEventListener('pointercancel', () => { drag = null; });
  mapElement.addEventListener('wheel', event => {
    event.preventDefault(); followPlayer = false;
    zoomMap(mapView, event.deltaY > 0 ? 1.18 : 1 / 1.18, mapPosition(event)); drawMap();
  }, { passive: false });
  mapElement.addEventListener('keydown', event => {
    const shift = { ArrowLeft: [35, 0], ArrowRight: [-35, 0], ArrowUp: [0, 35], ArrowDown: [0, -35] }[event.code];
    if (shift) { event.preventDefault(); followPlayer = false; panMap(mapView, ...shift); drawMap(); }
    else if (event.code === 'Enter') { event.preventDefault(); actions.setWaypoint?.({ x: mapView.x, z: mapView.z }); }
  });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (byId('new-confirm').hidden) {
      if (currentScreen === 'playing' || event.code !== 'Tab') return;
      if (['journal', 'calibration'].includes(currentScreen) && !event.shiftKey) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.repeat) call('toggleJournal');
        return;
      }
      const activeScreen = screens[currentScreen];
      const controls = [...activeScreen.querySelectorAll('button:not([disabled]), input:not([disabled])')].filter(button => button.getClientRects().length);
      if (!controls.length) return;
      const index = controls.indexOf(document.activeElement);
      if ((event.shiftKey && index <= 0) || (!event.shiftKey && (index < 0 || index === controls.length - 1))) {
        event.preventDefault(); event.stopImmediatePropagation();
        controls[event.shiftKey ? controls.length - 1 : 0].focus();
      }
      return;
    }
    if (event.code === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); hideConfirmation(); byId('start-button').focus(); }
    if (event.code === 'Tab') {
      event.preventDefault(); event.stopImmediatePropagation();
      (document.activeElement === byId('cancel-new-button') ? byId('confirm-new-button') : byId('cancel-new-button')).focus();
    }
  }, true);

  function svg(tag, attrs, text) {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function drawMap() {
    const planet=mapOptions.planet,globalMap=mapMode==='planet'&&planet;
    byId('planet-map-panel').hidden=!globalMap;
    document.querySelector('.map-content').hidden=!!globalMap;
    document.querySelector('.map-zoom').hidden=!!globalMap;
    byId('map-planet').disabled=!planet;
    byId('map-planet').setAttribute('aria-pressed',String(!!globalMap));
    byId('map-center').disabled=!!globalMap;
    if(globalMap){
      byId('map-title').textContent='裂环星 · 山川舆图';
      byId('planet-map-image').innerHTML=planet.svg;
      byId('planet-map-status').textContent=planet.status;
      const places=byId('planet-map-places');places.replaceChildren();
      for(const point of planet.model.legend){
        const button=document.createElement('button');button.type='button';
        button.textContent=`${point.number??''} ${point.label} · ${distanceText(point.distance)}${Number.isFinite(point.bearing)?' · '+Math.round(point.bearing)+'°':''}${point.status?' · '+point.status:''}`;
        button.addEventListener('click',()=>actions.planetWaypoint?.({id:point.id}));places.append(button);
      }
      for(const mode of ['nearby','world','interior'])byId('map-'+mode).setAttribute('aria-pressed','false');
      return;
    }
    const project = p => projectMap(p, mapView);
    if(currentScreen==='journal'&&!basinAtlas){
      basinAtlas=createCartography({width:600,height:600,columns:256,rows:256,levels:[-10,0,10,30,60,100,180,300],labels:false,reliefStrength:1.8,
        sample:(u,v)=>({height:legacyTerrainHeight((u-.5)*6000,(v-.5)*6000),biomes:{basin:1},waterDepth:0})});
      byId('map-terrain').innerHTML=basinAtlas.svg;
    }
    const terrainOrigin=project({x:-WORLD.halfSize,z:-WORLD.halfSize});
    byId('map-terrain').setAttribute('transform',`translate(${terrainOrigin.x} ${terrainOrigin.y}) scale(${WORLD.halfSize*2*MAP.pixels/mapView.span/600})`);
    const nav = mapOptions.navigation;
    const trackingColor = nav?.kind === 'task' ? '#275d63' : '#984c34';
    const structure = byId('map-structure'); structure.replaceChildren();
    const showInterior = !!mapOptions.entered || insideWreck(mapPlayer.x, mapPlayer.z);
    byId('map-interior').disabled = !showInterior;
    byId('map-interior').title = showInterior ? '查看已经进入的舰体结构和密封门' : '进入舰体后解锁内部测绘';
    byId('map-title').textContent = mapMode === 'interior' ? '舰内测绘 · 与实体墙体一致' : '裂环盆地 · 已知区域';
    const drawBox = (box, fill, stroke) => {
      const p = project({ x: box.x - box.w / 2, z: box.z - box.d / 2 });
      structure.append(svg('rect', { x: p.x, y: p.y, width: box.w * MAP.pixels / mapView.span, height: box.d * MAP.pixels / mapView.span, fill, stroke, 'stroke-width': .6 }));
    };
    if (mapPoints.some(point => point.id === 'breach')) {
      drawBox({ x: 0, z: -630, w: 100, d: 322 }, '#102b3640', '#416a79');
      if (showInterior) {
        for (const wall of WALLS) drawBox(wall, '#648896', '#7899a3');
        drawBox(GATE, mapOptions.gateOpen ? '#8ee4bf' : '#e6a770', mapOptions.gateOpen ? '#8ee4bf' : '#e6a770');
        if (mapView.span <= 700) {
          const door = project(GATE);
          structure.append(svg('text', { x: door.x + 13, y: door.y + 4, fill: mapOptions.gateOpen ? '#9be7c8' : '#e7b27e', 'font-size': 10 }, mapOptions.gateOpen ? '门已开启' : '密封门'));
        }
      }
    }
    const route = byId('map-route'); route.replaceChildren();
    if (nav?.target) {
      const from = project(mapPlayer), to = project(nav.target);
      route.append(svg('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, stroke: trackingColor, 'stroke-width': 1.5, 'stroke-dasharray': '6 7', opacity: .7 }));
      route.append(svg('circle', { cx: to.x, cy: to.y, r: 15, fill: 'none', stroke: trackingColor, 'stroke-width': 1.5 }));
      if (nav.kind === 'custom') route.append(svg('path', { 'data-testid': 'map-waypoint', d: 'M 0 -8 L 8 0 L 0 8 L -8 0 Z', transform: `translate(${to.x} ${to.y})`, fill: '#efc889', stroke: '#fff0d0' }));
    }
    const pointGroup = byId('map-points'); pointGroup.replaceChildren();
    const list = byId('map-point-list'); list.replaceChildren();
    mapPoints.forEach((point, index) => {
      const p = project(point);
      const selected = nav?.target?.id === point.id;
      // Surface navigation groups the wreck as one destination. Deck terminals
      // belong on the close-range interior chart, not in a pile of world markers.
      if (mapView.span > 700 && insideWreck(point.x, point.z) && point.id !== 'breach' && !selected) return;
      if (p.x >= 35 && p.x <= 565 && p.y >= 35 && p.y <= 565) {
        const marker = svg('g', { transform: `translate(${p.x} ${p.y})`, 'data-point-id': point.id, tabindex: 0, role: 'button', 'aria-label': `追踪${point.name}`, 'aria-pressed': String(selected), class: 'map-point' });
        marker.append(svg('title', {}, `${point.name}${point.status?' · '+point.status:''} · 点击追踪`));
        marker.append(svg('circle', { r: 14, fill: 'transparent' }));
        marker.append(svg('path', { d: 'M 0 -9 L 9 0 L 0 9 L -9 0 Z', fill: selected ? '#3c392e' : '#14313d', stroke: selected ? trackingColor : '#7bb7c5', 'stroke-width': 1.3 }));
        marker.append(svg('text', { x: 0, y: 3, 'text-anchor': 'middle', fill: '#e0eff1', 'font-size': 8, 'font-family': 'sans-serif', 'pointer-events': 'none' }, index + 1));
        marker.addEventListener('keydown', event => { if (event.code === 'Enter' || event.code === 'Space') { event.preventDefault(); event.stopPropagation(); selectMapPoint(point.id); } });
        pointGroup.append(marker);
      }
      const item = document.createElement('li');
      const button = document.createElement('button'); button.type = 'button'; button.dataset.pointId = point.id; button.setAttribute('aria-pressed', String(selected));
      button.addEventListener('click', () => selectMapPoint(point.id));
      const number = document.createElement('span'); number.className = 'point-index'; number.textContent = index + 1;
      const name = document.createElement('span'); name.className = 'point-name'; name.textContent = point.name+(point.status?' · '+point.status:'');
      const range = document.createElement('span'); range.className = 'point-distance'; range.textContent = distanceText(Math.hypot(point.x - mapPlayer.x, point.z - mapPlayer.z));
      button.append(number, name, range); item.append(button); list.append(item);
    });
    const p = project(mapPlayer);
    const player = byId('map-player'); player.replaceChildren();
    player.append(svg('circle', { cx: p.x, cy: p.y, r: 17, fill: '#97f2e813', stroke: '#96e8e35a', 'stroke-width': 1 }));
    player.append(svg('path', { d: 'M 0 -11 L 7 8 L 0 4 L -7 8 Z', transform: `translate(${p.x} ${p.y}) rotate(${lastBodyHeading})`, fill: '#20555a', stroke: '#fff2ce', 'stroke-width': 1, 'data-role':'body-heading' }));
    player.append(svg('path', { d: 'M 0 -18 L 0 -27', transform: `translate(${p.x} ${p.y}) rotate(${lastHeading})`, stroke: '#984c34', 'stroke-width': 2, 'data-role':'look-heading' }));
    const scale = (mapView.span / 1000).toFixed(mapView.span < 1000 ? 2 : 1);
    byId('map-scale').textContent = `${scale} km × ${scale} km`;
    byId('map-coordinates').textContent = coordinateText(mapPlayer);
    byId('map-zoom-level').textContent = distanceText(mapView.span);
    byId('map-zoom-in').disabled = mapView.span <= MAP.minSpan;
    byId('map-zoom-out').disabled = mapView.span >= MAP.maxSpan;
    for (const mode of ['nearby', 'world', 'interior']) byId(`map-${mode}`).setAttribute('aria-pressed', String(mapMode === mode));
    byId('map-tracking-name').textContent = nav?.target ? `${nav.kind === 'task' ? '调查目标' : '手动追踪'} · ${nav.target.name}` : '暂无追踪目标';
    byId('map-tracking-detail').textContent = nav?.target ? `${distanceText(nav.distance)} · ${coordinateText(nav.target)}${nav.arrived ? ' · 已到达附近' : ''}` : '仅显示已知地点；未知区域等待探索。';
    byId('map-clear-waypoint').disabled = !nav || nav.kind === 'task';
    mapElement.dataset.centerX = mapView.x; mapElement.dataset.centerZ = mapView.z; mapElement.dataset.span = mapView.span;
  }

  function setArchiveTab(tab) {
    archiveTab = tab;
    byId('toast').hidden = true;
    byId('map-feedback').textContent = '';
    byId('journal-screen').hidden = currentScreen !== 'journal' || tab !== 'map';
    byId('records-screen').hidden = currentScreen !== 'journal' || tab !== 'records';
    byId('evolution-screen').hidden = currentScreen !== 'journal' || tab !== 'evolution';
    byId('journal-records').hidden = tab !== 'records';
    document.querySelector('.map-section').hidden = tab !== 'map';
    byId('evolution-section').hidden = tab !== 'evolution';
    if (currentScreen === 'journal') byId(tab === 'map' ? 'close-journal-button' : 'close-' + tab + '-button').focus({ preventScroll: true });
    if (tab === 'map') drawMap();
    if (tab === 'evolution') renderEvolution();
  }

  function renderEvolution() {
    if (!lastGrowth) return;
    const signature = JSON.stringify([lastGrowth, lastStation]);
    if (signature === growthSignature) return;
    growthSignature = signature;
    byId('evolution-distance').textContent = `${Math.floor(lastGrowth.footDistance)} m`;
    byId('evolution-location').textContent = lastStation ? `${lastStation} · 校准工作点` : '野外 · 校准需靠近工作点';
    for (const branch of ['body', 'equipment']) {
      const data = lastGrowth[branch];
      byId(`${branch}-evolution-level`).textContent = `L${data.level} / ${data.maxLevel}`;
      byId(`${branch}-evolution-duration`).replaceChildren(document.createTextNode(data.currentDuration.toFixed(1) + ' '), Object.assign(document.createElement('small'), { textContent: '秒' }));
      const button = byId(`evolve-${branch}-button`);
      button.disabled = !data.ready; button.textContent = data.actionLabel + (data.nextDuration == null ? '' : ` · ${data.nextDuration.toFixed(1)} 秒`);
      byId(`${branch}-evolution-reason`).textContent = data.status + (branch === 'body' && !data.completed && lastGrowth.restRemaining > .01 ? `。返回探索再站定 ${lastGrowth.restRemaining.toFixed(1)} 秒；此页暂停计时。` : '');
      const roadmap = byId(`${branch}-evolution-roadmap`); roadmap.replaceChildren();
      for (const stage of data.roadmap) {
        const item = document.createElement('li'); item.dataset.level = stage.level;
        item.dataset.phase = stage.completed ? 'complete' : stage.next ? 'next' : 'locked';
        const head = document.createElement('div'); head.className = 'evolution-stage-heading';
        const title = document.createElement('strong'); title.textContent = `L${stage.level} · ${stage.name}`;
        const duration = document.createElement('span'); duration.textContent = `${stage.duration.toFixed(1)} 秒${stage.completed ? ' · 已完成' : ''}`;
        head.append(title, duration); item.append(head);
        const conditions = document.createElement('ul'); conditions.className = 'evolution-requirements';
        for (const requirement of stage.requirements) {
          const row = document.createElement('li'); row.classList.toggle('met', requirement.met);
          row.textContent = `${requirement.met ? '✓' : '○'} ${requirement.label}${Number.isFinite(requirement.current) && Number.isFinite(requirement.target) ? ` · ${Math.floor(requirement.current)} / ${requirement.target} m` : ''}`;
          conditions.append(row);
        }
        item.append(conditions); roadmap.append(item);
      }
    }
  }

  function setScreen(name, { returnScreen = 'playing' } = {}) {
    currentScreen = name;
    byId('records-screen').hidden = true;
    byId('evolution-screen').hidden = true;
    drag = null;
    for (const [key, element] of Object.entries(screens)) element.hidden = key !== name;
    hud.hidden = name !== 'playing'; hideConfirmation();
    if (name !== 'playing') { clearTimeout(toastTimer); byId('toast').hidden = true; }
    if (name === 'journal') {
      setArchiveTab(archiveTab);
      for (const [id,key] of [['close-journal-button','Tab'],['close-records-button','J'],['close-evolution-button','U']]) byId(id).replaceChildren(Object.assign(document.createElement('kbd'), { textContent: key }), document.createTextNode(returnScreen === 'pause' ? ' 返回暂停' : returnScreen === 'complete' ? ' 返回调查结果' : ' 返回探索'));
      drawMap();
    }
    if (name === 'playing') byId('world').focus({ preventScroll: true });
    else ({ menu: byId(hasSave ? 'continue-button' : 'start-button'), journal: byId('close-journal-button'), pause: byId('resume-button'), complete: byId('complete-journal-button'), calibration: byId('calibration-channel-0') })[name]?.focus({ preventScroll: true });
  }

  function update(view) {
    if(view.dash){
      const d=view.dash;
      const status=!d.unlocked?'调查求救信号后解锁':view.mobility?.mounted?'驾驶中不可用':view.mobility?.flightActive?'空中不可用':d.active?'矢量闪避中':d.cooldown>0?`冷却 ${d.cooldown.toFixed(1)} s`:`就绪 · 消耗 ${d.cost.toFixed(1)}% 体力`;
      byId('dash-hint').textContent=`E 闪避 · ${status}`;
      byId('dash-skill-status').textContent=d.unlocked?`已解析矢量指令 · ${status}`:'尚未解析：调查失真的求救信号，玄壳将识别其中的矢量控制指令。';
    }
    const objective = view.objective || {};
    byId('objective-title').textContent = objective.title || '探索裂环星';
    byId('objective-detail').textContent = objective.detail || '';
    byId('target-range').textContent = view.targetName && Number.isFinite(view.distance) ? `◇ ${view.targetName} · ${distanceText(view.distance)}` : '';
    if (view.player) byId('coordinates').textContent = view.planet?.coordinateLabel || coordinateText(view.player);
    lastHeading = ((view.heading || 0) % 360 + 360) % 360;
    byId('heading-name').textContent = bearingNames[Math.round(lastHeading / 45) % 8];
    byId('heading-degrees').textContent = `${String(Math.round(lastHeading) % 360).padStart(3, '0')}°`;
    lastBodyHeading=((view.bodyHeading||0)%360+360)%360;
    const bodyBearing=Math.round(lastBodyHeading)%360;
    byId('body-heading').textContent=`行进 ${bearingNames[Math.round(bodyBearing/45)%8]} ${String(bodyBearing).padStart(3,'0')}° · Alt 环视`;
    byId('location-name').textContent = view.location || '裂环星 · 荒原';
    const navigation = view.navigation;
    byId('navigation-hud').hidden = !navigation?.target;
    if (navigation?.target) {
      byId('navigation-hud').dataset.kind = navigation.kind;
      byId('navigation-name').textContent = navigation.target.name;
      byId('navigation-detail').textContent = navigation.arrived
        ? navigation.target.hint || (navigation.kind === 'custom' ? '已到达标点 · Tab 可更改' : '已到达附近 · 靠近后 F 调查')
        : `${distanceText(navigation.distance)} · ${Math.round(navigation.bearing)}° · 直线方位`;
      byId('navigation-arrow').style.transform = `rotate(${navigation.relativeBearing}deg)`;
    }
    const mounted = view.mobility?.mounted;
    const posture=view.player.posture||'stand';
    byId('walk-button').hidden=!!view.planet?.active;
    byId('walk-button').setAttribute('aria-pressed', String(posture==='crouch'));
    byId('walk-button').setAttribute('aria-label', 'C 蹲伏 / 起身；Z 趴下；按住 Ctrl 慢走');
    updateParts('walk-button',posture,()=>[Object.assign(document.createElement('kbd'), { textContent: 'C' }), document.createTextNode(posture==='crouch'?' 起身':posture==='prone'?' 转蹲伏':' 蹲伏')]);
    updateParts('camera-button',view.cameraMode,()=>[Object.assign(document.createElement('kbd'), { textContent: 'V' }), document.createTextNode(mounted ? view.cameraMode==='vehicle-first'?' 驾驶第一人称':' 驾驶追尾' : view.cameraMode === 'third' ? ' 第三人称' : ' 第一人称')]);
    byId('camera-button').setAttribute('aria-label', mounted ? view.cameraMode==='vehicle-first'?'切换驾驶追尾视角':'切换驾驶第一人称' : view.cameraMode === 'third' ? '切换为第一人称视角' : '切换为第三人称视角');
    const surface = byId('surface-status');
    surface.textContent = view.blocked ? '岩石 / 障碍阻挡 · 绕行' : mounted ? '地表行驶 · 舰内请下车' : view.mobility?.flightActive ? '低空越障 · 留意落点' : ({ gravel: '碎石地面', rock: '岩石表面', metal: '金属甲板', dust: '松散尘土' }[view.surface] || '碎石地面');
    surface.classList.toggle('blocked', !!view.blocked);
    const endurance = view.stamina;
    if (view.evolution) {
      lastGrowth = view.evolution; lastStation = view.stationName || '';
      const stats = lastGrowth.stats, readyCount = Number(lastGrowth.body.ready) + Number(lastGrowth.equipment.ready);
      byId('body-level-label').textContent = `体力 · L${stats.bodyLevel}`;
      byId('sprint-duration').textContent = `满值冲刺 ${stats.sprintDuration.toFixed(1)} 秒`;
      byId('flight-duration').textContent = `满能助推 ${stats.flightDuration.toFixed(1)} 秒`;
      byId('evolution-ready-count').textContent = String(readyCount);
      byId('evolution-ready-count').hidden = readyCount === 0;
      byId('evolution-button').classList.toggle('upgrade-ready', readyCount > 0);
      updateParts('evolution-button',readyCount>0,()=>[Object.assign(document.createElement('kbd'), { textContent: 'U' }), document.createTextNode(readyCount > 0 ? ' 可进化' : ' 进化')]);
      if (currentScreen === 'journal' && archiveTab === 'evolution') renderEvolution();
    }
    updateParts('stamina-number',Math.floor(endurance.value),()=>[document.createTextNode(String(Math.floor(endurance.value))), Object.assign(document.createElement('small'), { textContent: '%' })]);
    byId('stamina-fill').style.width = `${endurance.value}%`;
    byId('stamina-status').textContent = view.mobility?.flightActive ? '低空操控中 · 体力暂停恢复' : endurance.label;
    document.querySelector('.suit-status').classList.toggle('low', !endurance.canStart);
    document.querySelector('.suit-status').dataset.phase = endurance.phase;
    const travel = view.mobility;
    byId('foot-status').hidden = !!mounted;
    if (travel) {
      byId('mobility-status').dataset.mode = travel.mode;
      byId('mobility-label').textContent = mounted ? '巡迹 · 悬浮勘探车' : `玄壳 · L${view.evolution?.stats.equipmentLevel || 0}`;
      byId('flight-duration').hidden = !!mounted;
      updateParts('mobility-number',`${mounted}:${Math.floor(mounted?travel.speed:travel.energy)}`,()=>[document.createTextNode(String(Math.floor(mounted ? travel.speed : travel.energy))), Object.assign(document.createElement('small'), { textContent: mounted ? 'm/s' : '%' })]);
      byId('mobility-fill').style.width = `${Math.max(0, Math.min(100, mounted ? travel.battery : travel.energy))}%`;
      byId('mobility-status').classList.toggle('low', (mounted ? travel.battery : travel.energy) < 25);
      byId('mobility-detail').textContent = mounted ? travel.battery <= 0 ? '电池耗尽 · 下车等待回充' : `电池 ${Math.floor(travel.battery)}% · 下车停放回充` : travel.flightActive ? `离地 ${travel.altitude.toFixed(1)} / ${travel.maxAltitude} m · ${travel.energy <= 0 ? '耗尽，强制缓降' : '松开缓降'}` : travel.status;
      byId('mobility-hint').textContent = mounted ? 'Space 刹车 · 停稳后 F 下车' : 'Space 跳跃 · G 助推 · Q 扫描 · L 灯';
      if(!mounted&&view.planet?.unlocked){
        const p=view.planet;
        byId('mobility-label').textContent=`${p.realmName||'元婴'} · 自身飞行`;byId('flight-duration').hidden=true;
        updateParts('mobility-number',`planet:${Math.floor(p.energy)}`,()=>[document.createTextNode(`${Math.floor(p.energy)} %`)]);
        byId('mobility-fill').style.width=`${p.energy}%`;
        byId('mobility-detail').textContent=p.active?`离地 ${distanceText(p.agl)} / 2,000 m · ${Math.abs(p.verticalSpeed||0)<.2?'悬停':p.verticalSpeed>0?'上升':'下降'}`:`${p.realmName||'元婴'}御空就绪 · 营地可恢复灵息`;
        byId('mobility-hint').textContent=p.active?'G 上升 · C 下降 · 松开悬停 · V 视角':'G 起飞 · Space 跳跃 · 地面 C 蹲伏';
      }
      byId('track-transport-button').hidden = !!mounted || !view.transportKnown;
      byId('track-transport-button').textContent = travel.repaired ? 'T · 追踪停放的勘探车' : travel.coupler ? 'T · 返回勘探车安装部件' : view.partKnown ? 'T · 追踪附近的动力部件' : 'T · 追踪勘探车残骸';
      for (const [id, key, label] of [['movement-help', mounted ? 'W/S · A/D' : 'WASD', mounted ? '油门 / 转向 · 鼠标环视' : '移动 · 鼠标转向 · Alt环视'], ['speed-help', 'W+Shift', mounted ? '加速' : '疾跑'], ['lift-help', 'Space', mounted ? '刹车' : view.planet?.active ? '地面跳跃' : '跳跃']]) {
        updateParts(id,`${key}:${label}`,()=>[Object.assign(document.createElement('kbd'), { textContent: key }), document.createTextNode(` ${label}`)]);
      }
    }
    byId('scanner-status').textContent = ({drawing:'取出',using:'扫描',folding:'合拢',stowing:'收回'})[view.equipment?.phase] || (view.scannerCooldown > 0 ? `${view.scannerCooldown.toFixed(1)} s` : '就绪');
    byId('interaction').hidden = !view.interaction || !!mounted;
    byId('reticle').classList.toggle('active', !!view.interaction && !mounted);
    byId('interaction-name').textContent = view.interaction?.name || '';
    byId('interaction-hint').textContent = view.interaction?.hint || '';
    byId('capture-hint').hidden = !!view.locked;
    byId('capture-hint').textContent = view.captureStatus === 'pending' ? '正在恢复鼠标控制…' : view.captureStatus === 'blocked' ? '浏览器暂未允许鼠标捕获 · 按移动键或单击重试，也可按住左键拖动观察' : '点击画面控制视角 · 也可按住左键拖动观察';
    byId('sound-button').textContent = `环境音：${view.muted ? '关闭' : '开启'}`;
    byId('sound-button').setAttribute('aria-pressed', String(!!view.muted));
    if (view.complete) {
      const finished = view.survey?.complete;
      byId('complete-title').textContent = finished ? '未发出的观测记录' : '静默之后';
      document.querySelector('.completion-copy').textContent = finished
        ? '三份远野证据已离线封存。异常仍未确定起源。你在结论栏留下问号，没有重新接通上行。完整观测记录已加入档案。'
        : '回声源已经断联，原始证据完成封存。但黑匣子最早的那十七分钟，仍然没有解释。离线索引里留下三处远野观测坐标，下一次调查从那里开始。';
      byId('explore-button').textContent = finished ? '继续自由探索' : '开始远野调查';
      const seconds = Math.max(0, Math.round(view.elapsed || 0));
      byId('completion-time').textContent = `本次调查用时 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒 · 进度已保存`;
    }
  }

  function setJournal(entries) {
    const container = byId('journal-entries'); container.replaceChildren();
    byId('entry-count').textContent = entries.length;
    if (!entries.length) {
      const empty = document.createElement('p'); empty.className = 'journal-empty'; empty.textContent = '档案还是空白。\n靠近异常信号并按 F 调查。发现的记录会保存在这里。'; container.append(empty);
    }
    entries.forEach((entry, index) => {
      const article = document.createElement('article'); article.className = 'record';
      const number = document.createElement('p'); number.className = 'record-index'; number.textContent = `RECORD ${String(index + 1).padStart(2, '0')}`;
      const title = document.createElement('h4'); title.textContent = entry.title || entry.name || '未命名记录';
      const copy = document.createElement('p'); copy.textContent = entry.text || entry.body || entry.content || '';
      article.append(number, title, copy); container.append(article);
    });
  }

  let mapSignature = '';
  function setMap(player, points, options = {}) {
    mapPlayer = { x: Number(player.x) || 0, z: Number(player.z) || 0 };
    mapPoints = points.filter(p => Number.isFinite(p.x) && Number.isFinite(p.z));
    if(options.planet?.outside&&!mapOptions.planet?.outside)mapMode='planet';
    mapOptions = options;
    if (followPlayer) { Object.assign(mapView, mapPlayer); clampMapView(mapView); }
    byId('coordinates').textContent = coordinateText(mapPlayer);
    const signature = JSON.stringify([mapPlayer, mapPoints, options]);
    if (currentScreen === 'journal' && signature !== mapSignature) drawMap();
    mapSignature = signature;
  }

  function setHasSave(value) {
    hasSave = !!value;
    byId('continue-button').hidden = !hasSave;
    byId('start-button').classList.toggle('secondary-start', hasSave);
    byId('start-button').firstChild.textContent = hasSave ? '开启新调查 ' : '开始调查 ';
  }

  function toast(message) {
    clearTimeout(toastTimer);
    const element = byId('toast'); element.textContent = message; element.hidden = !message;
    if (currentScreen === 'journal' && archiveTab === 'map') {
      element.hidden = true;
      byId('map-feedback').textContent = message || '';
      return;
    }
    if (message) toastTimer = setTimeout(() => { element.hidden = true; }, Math.max(3500, Math.min(8000, message.length * 90)));
  }

  setScreen('menu'); setJournal([]); drawMap();
  return { setScreen, update, toast, setJournal, setMap, setHasSave, selectArchiveTab: setArchiveTab, isArchiveTab: tab => archiveTab === tab };
}
