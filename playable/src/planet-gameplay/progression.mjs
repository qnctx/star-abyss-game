// Pure extension: never mutates the original story, inventory, or vehicle.
export const SURVEY_ROUTE = Object.freeze(['plains', 'forest', 'wetland', 'coast']);
const names = ['平原与山麓', '河流与森林', '湿地', '海岸'];
export function createProgression() { return { surveys: [], commissioned: false }; }
export function prerequisites(context) {
  return context?.story?.flags?.complete === true && context?.mobility?.vehicle?.repaired === true;
}
export function restoreProgression(raw, context) {
  const state = createProgression();
  if (!prerequisites(context)) return state;
  // Only a contiguous prefix counts. A future/coast-only save cannot skip growth.
  for (const id of SURVEY_ROUTE) {
    if (!Array.isArray(raw?.surveys) || raw.surveys[state.surveys.length] !== id) break;
    state.surveys.push(id);
  }
  state.commissioned = state.surveys.length === SURVEY_ROUTE.length && raw?.commissioned === true;
  return state;
}
export function progressionView(state, context) {
  const checked = restoreProgression(state, context);
  if(Number.isInteger(context?.realm)&&context.realm>=4)return {unlocked:true,action:'fly',title:'元婴自身飞行 · 离地最高 2,000 米',biome:null};
  if (!prerequisites(context)) return { unlocked: false, action: 'legacy', title: '完成原调查并修复勘探车', biome: null };
  const next = checked.surveys.length;
  if (next < SURVEY_ROUTE.length) return { unlocked: false, action: 'survey', title: `沿地表前往${names[next]}，停车步行采样`, biome: SURVEY_ROUTE[next] };
  if (!checked.commissioned) return { unlocked: false, action: 'commission', title: '携带四份生态样本返回营地，完成生态调查', biome: null };
  return { unlocked: false, action: 'realm', title: '生态调查完成 · 达到元婴 R4 后领悟自身飞行', biome: null };
}
export function progressAction(state, action, context, sample) {
  const view = progressionView(state, context);
  const reject = reason => ({ changed: false, reason });
  if (!sample?.ready || sample.grounded !== true || !Number.isFinite(sample.agl) || Math.abs(sample.agl) > .15 ||
      !Number.isFinite(sample.waterDepth) || sample.waterDepth > .15 || context?.mobility?.vehicle?.mounted ||
      context?.mobility?.flight?.airborne || context?.mobility?.jump?.airborne) return reject('unsafe-ground');
  if (action === 'survey' && view.action === 'survey' && sample.biome === view.biome) {
    state.surveys = [...restoreProgression(state, context).surveys, sample.biome];
    state.commissioned = false;
    return { changed: true, reason: 'sample-recorded' };
  }
  if (action === 'commission' && view.action === 'commission' && sample.atService === true) {
    state.commissioned = true;
    return { changed: true, reason: 'flight-commissioned' };
  }
  return reject('prerequisite');
}
