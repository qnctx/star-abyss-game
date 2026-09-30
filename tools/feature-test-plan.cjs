const fs = require('node:fs');
const path = require('node:path');
const {discoverCpuTests} = require('./cpu-test-files.cjs');

// A shared file may cover multiple interacting mechanics. Keep those regression
// tests together instead of filtering by fragile human-readable test titles.
const FEATURES = {
  cockpit: {label:'驾驶第一人称、同车仪表与视角存档',rules:['vehicle-camera','driving-direction','input','look-control'],browser:['vehicle-cockpit']},
  prone: {label:'趴卧骨架、第一人称与下车转向',rules:['prone-redesign','character-retarget','look-control','tactical-control'],browser:['desktop-posture','vehicle-cockpit']},
  movement: { label:'行走、冲刺、动作与足音', rules:['movement','look-control','tactical-control','stamina','gait','footing','audio','authored-motion','input','avatar-shapes','gait-performance','idle-stability','render-budget','rock-render-chunks'], browser:['locomotion','desktop-controls','desktop-posture','avatar-visual','gait-visual','c2-directional'] },
  controls: {label:'桌面键位、慢走恢复与姿态',rules:['movement','input','look-control','tactical-control','stamina','mobility'],browser:['desktop-controls','desktop-posture']},
  posture: {label:'蹲伏、趴下与跳跃',rules:['input','tactical-control','mobility','character-retarget'],browser:['desktop-posture']},
  dash: { label:'调查解锁、矢量闪避与三维特效', rules:['dash','dash-effect'], browser:['dash-integration'] },
  scan: { label:'扫描生命周期与世界坐标特效', rules:['scan-effect','equipment-control'], browser:['scan-vfx'] },
  vehicle: { label:'修车、驾驶、环视、停车与存档', rules:['mobility','driving-direction','vehicle-route-planner'], browser:['mobility','exploration-r2'] },
  flight: { label:'低空助推、限高、耗能与着陆', rules:['mobility','growth-movement'], browser:['mobility'] },
  map: { label:'标点、导航、地图与独立面板', rules:['navigation','physical-world','meteor'], browser:['exploration','exploration-r2','map-r3'] },
  evolution: { label:'条件升级、续航、防刷与资源守恒', rules:['evolution','growth-movement'], browser:['evolution'] },
  story: { label:'两章主线、黑匣子返回与远野调查', rules:['story','survey','vehicle-route-planner'], browser:['star-abyss','investigation'] },
  calibration: { label:'相位谜题、错误输入与窄屏操作', rules:['calibration'], browser:['calibration-ui','investigation','investigation-visual'] },
};

function parseArgs(args) {
  const flags = new Set(['--list','--headed','--rules-only','--plan']);
  const unknown = args.find(a=>a.startsWith('--') && !flags.has(a));
  if (unknown) throw Error(`未知选项 ${unknown}`);
  const names = args.filter(a=>!a.startsWith('--'));
  if (names.length > 1) throw Error('一次选择一个玩法，完整验证请用 all。');
  const name = names[0] || 'all';
  if (name !== 'all' && !FEATURES[name]) throw Error(`未知玩法 ${name}；使用 --list 查看。`);
  return { name, list:args.includes('--list'), headed:args.includes('--headed'), rulesOnly:args.includes('--rules-only'), plan:args.includes('--plan') };
}

function createPlan(root, options) {
  const directory = path.join(root,'playable/tests');
  const files = fs.readdirSync(directory);
  const selected = FEATURES[options.name];
  const rules = options.name === 'all' ? discoverCpuTests(root) : selected.rules.map(n=>`playable/tests/${n}.test.js`);
  const browser = options.rulesOnly ? [] : options.name === 'all' ? files.filter(f=>f.endsWith('.spec.js')).sort() : selected.browser.map(n=>`${n}.spec.js`);
  for (const file of rules) if (!fs.existsSync(path.join(root,file))) throw Error(`测试目录缺少 ${file}`);
  for (const file of browser) if (!files.includes(file)) throw Error(`测试目录缺少 ${file}`);
  if (!rules.length || (!options.rulesOnly && !browser.length)) throw Error('测试清单为空，不允许作为通过。');
  return { ...options, label:selected?.label || '全部已实现玩法', rules, browser:browser.map(f=>`playable/tests/${f}`) };
}

function assessBrowser(report) {
  const tests=[];
  function walk(suite) { for (const s of suite.specs || []) tests.push(...s.tests || []); for (const s of suite.suites || []) walk(s); }
  walk(report || {});
  const status = { total:tests.length, passed:0, blocked:0 };
  for (const test of tests) {
    // expected failures, retries/flakes and skipped tests cannot green a gate.
    const result = test.results || [];
    if (test.status === 'expected' && test.expectedStatus === 'passed' && result.length === 1 && result[0].status === 'passed') status.passed++;
    else status.blocked++;
  }
  status.ok=status.total>0 && status.blocked===0 && !(report?.errors?.length);
  return status;
}

function releaseStatus(plan, stages, browser, unchanged) {
  if (!unchanged || stages.some(s=>s.exitCode!==0)) return 'FAILED';
  const required = plan.rulesOnly ? ['build','rules'] : ['build','rules','browser'];
  if(required.some(name=>stages.filter(stage=>stage.name===name&&stage.exitCode===0).length!==1)) return 'FAILED';
  if (plan.rulesOnly) return 'RULES_ONLY_NOT_RELEASE';
  if (!browser?.ok) return 'FAILED';
  return plan.name === 'all' ? 'AUTOMATION_PASSED_MANUAL_REVIEW_REQUIRED' : 'FEATURE_PASSED_NOT_RELEASE';
}
module.exports = { FEATURES, parseArgs, createPlan, assessBrowser, releaseStatus };
