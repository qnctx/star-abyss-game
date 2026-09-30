const fs=require('fs'),crypto=require('crypto');
const edit=(p,fn)=>fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')));
const doc='docs/development/ASCENSION-FLIGHT-COMBAT-R8.md';
fs.copyFileSync(doc,'docs/development/AERIAL-COMBAT-R8.md');
const baseline='artifacts/r8-release-baseline.json',b=JSON.parse(fs.readFileSync(baseline));
for(const p of ['playable/checkpoint-worker.js']){const hash=f=>fs.existsSync(f)?crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'):null;b[p]={live:hash('E:/myProject/star-abyss-game/'+p),local:hash(p)};}fs.writeFileSync(baseline,JSON.stringify(b,null,2));
edit('playable/src/test-lab.mjs',s=>s.replace("const names=", "const realmName=['后天','先天','灵海','金丹','元婴','化神','炼虚','合道','星劫','道源'][TEST_LAB.realm];\nconst names=")
.replace("document.title='星渊 · 元婴测试实验室（独立测试档）'", "document.title=`星渊 · ${realmName}测试实验室（独立测试档）`")
.replace("badge.textContent='测试版 · 元婴 R4 · F2 实验室'", "badge.textContent=`测试版 · ${realmName} R${TEST_LAB.realm} · F2 实验室`")
.replace('<h2>元婴测试实验室</h2>','<h2>${realmName}测试实验室</h2>')
.replace('独立测试档 · R4 元婴一级','独立测试档 · R${TEST_LAB.realm} ${realmName}一级')
.replace('<output id="test-lab-status"','<section><h3>境界与能力</h3><label>独立境界档<select id="test-lab-realm">${[4,5,6,7,8,9].map(r=>`<option value="${r}" ${r===TEST_LAB.realm?\'selected\':\'\'}>R${r} · ${[\'后天\',\'先天\',\'灵海\',\'金丹\',\'元婴\',\'化神\',\'炼虚\',\'合道\',\'星劫\',\'道源\'][r]}</option>`).join(\'\')}</select></label><button data-action="realm">进入该境界独立档</button><p>Shift + WASD 加速；炼虚起 Y 短虚步、Shift + Y 长距预览。空中 R 气刃，星劫起 R 破虚。近地自动限速；高空更适合比较加速。不同境界各自保存；正式成长链尚未开放全部高阶突破。</p><a href="./ascension-gallery.html" target="_blank">查看六境概念与 3D 模型</a></section><output id="test-lab-status"')
.replace('2,000 米 · 元婴上限','2,000 米 · 当前星球上限')
.replace('<button data-action="combat">前往战斗点</button>','<button data-action="combat">前往地面战斗点</button><button data-action="air-combat">前往空战点</button>')
.replace("if(name==='travel')", "if(name==='realm'){const url=new URL(location.href);url.searchParams.set('realm',dialog.querySelector('#test-lab-realm').value);location.href=url.href;return;}\n    if(name==='air-combat'){const target=api.runtime().view().enemies.find(e=>e.alive);if(!target)throw Error('当前没有存活掠兽，请重置当前境界测试档。');const x=target.x+14,z=target.z+14,y=terrainHeight(x,z)+12;commit(localToGlobal({x,y,z},planet.frame));const p=api.context().player;p.yaw=p.heading=Math.atan2(x-target.x,z-target.z);p.pitch=Math.atan2((target.y??terrainHeight(target.x,target.z))+1-(y+1.5),Math.hypot(x-target.x,z-target.z));api.afterMove();update('已悬停并瞄准真实掠兽。收起面板按 R 发动空战；WASD 可躲避红色反击，落地 H 拾取。');}\n    if(name==='travel')"));
edit('playable/src/main.mjs',s=>s.replaceAll('新建元婴测试档 ', '新建独立境界档 ').replaceAll('继续元婴测试档 ','继续独立境界档 ').replace('独立元婴测试档 · 已完成调查 / 开放飞行 · 正式进度保持隔离','独立境界测试档 · Shift 加速 / 炼虚起虚步 / 盆地空战 · 正式进度保持隔离').replace("textContent='元婴测试实验室'", "textContent=`R${TEST_LAB.realm} 境界测试实验室`"));
edit('playable/star-abyss.html',s=>s.replace('<kbd>飞行 C</kbd>', '<kbd>飞行 C</kbd>').replace('元婴飞行中按住下降 · 松开悬停','飞行中按住下降 · 松开悬停').replace('</dl>', '<div><dt><kbd>Shift</kbd></dt><dd>飞行加速 · 近地安全限速</dd></div><div><dt><kbd>Y</kbd></dt><dd>炼虚起短距瞬移 · Shift + Y 长距预览</dd></div><div><dt><kbd>空中 R</kbd></dt><dd>盆地气刃 · 星劫起破虚</dd></div></dl>'));
