// Exploration unlocks knowledge; adapting it is an explicit, safe-ground action.
// Resource pools stay normalized at 100. Upgrades change drain, never refill them.
import { ENDURANCE } from './endurance.mjs';
export const EVOLUTION = Object.freeze({ maxLevel: ENDURANCE.maxLevel, restSeconds: 3, maxFootDistance: 100_000_000, maxFootSpeed: 12 });
const BODY_TIERS = [
  { name: '呼吸适应', distance: 200, milestone: '完成初次信号调查', earned: f => f.signal === true },
  { name: '肌纤维重塑', distance: 500, milestone: '回收坠舰核心证据', earned: f => f.blackbox === true },
  { name: '低重力稳态', distance: 800, milestone: '完成两处异常的现场校准', earned: f => f.echoCalibrated === true && f.capsuleCalibrated === true },
];
const EQUIPMENT_TIERS = [
  { name: '回路重排', milestone: '恢复坠舰供电', earned: f => f.power === true },
  { name: '共振散热', milestone: '回传核心证据并完成石碑校准', earned: f => f.returned === true && f.echoCalibrated === true },
  { name: '玄壳闭环', milestone: '完成深层异常的现场调查', earned: f => f.riftClosed === true },
];
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const levelOf = value => Math.floor(clamp(finite(value), 0, EVOLUTION.maxLevel));
const distanceOf = value => clamp(finite(value), 0, EVOLUTION.maxFootDistance);
const flagsOf = story => story?.flags || {};
const isSafeGround = context => context?.grounded === true && context?.mounted === false;

export function createEvolution() {
  return { bodyLevel: 0, equipmentLevel: 0, footDistance: 0, restTime: 0 };
}

function tierRequirements(tier, state, story) {
  return [
    ...(tier.distance ? [{ label: `实际地面步行 ${tier.distance} 米`, met: state.footDistance >= tier.distance, current: Math.floor(state.footDistance), target: tier.distance }] : []),
    { label: tier.milestone, met: tier.earned(flagsOf(story)) },
  ];
}

function earnedLevel(tiers, state, story) {
  let level = 0;
  for (const tier of tiers) {
    if (!tierRequirements(tier, state, story).every(requirement => requirement.met)) break;
    level++;
  }
  return level;
}

export function restoreEvolution(raw, story) {
  const state = createEvolution();
  if (!raw || raw.version !== 1 || typeof raw !== 'object' || Array.isArray(raw)) return state;
  state.footDistance = distanceOf(raw.footDistance);
  state.bodyLevel = Math.min(levelOf(raw.bodyLevel), earnedLevel(BODY_TIERS, state, story));
  state.equipmentLevel = Math.min(levelOf(raw.equipmentLevel), earnedLevel(EQUIPMENT_TIERS, state, story));
  return state;
}

export function serializeEvolution(state) {
  return { version: 1, bodyLevel: levelOf(state.bodyLevel), equipmentLevel: levelOf(state.equipmentLevel), footDistance: distanceOf(state.footDistance) };
}

export function recordEvolutionMotion(state, motion, delta) {
  if (!Number.isFinite(delta) || delta <= 0) return;
  const distance = motion?.distance;
  const groundFoot = motion?.mode === 'foot';
  const validDistance = Number.isFinite(distance) && distance >= 0 && distance <= EVOLUTION.maxFootSpeed * delta + 1e-5;
  if (groundFoot && validDistance && motion.moving === true && distance > .0005) {
    state.footDistance = distanceOf(state.footDistance + distance);
  }
  // No credit for flying, riding, teleporting or a blocked movement attempt.
  // Pause/menu callers do not tick this function; rest intent is never persisted.
  const stationary = groundFoot && validDistance && motion.moving === false && distance <= .0005;
  state.restTime = stationary ? Math.min(EVOLUTION.restSeconds, finite(state.restTime) + delta) : 0;
}

export function evolutionStats(state) {
  const bodyLevel = levelOf(state?.bodyLevel), equipmentLevel = levelOf(state?.equipmentLevel);
  const sprintDuration = ENDURANCE.durations[bodyLevel], flightDuration = ENDURANCE.durations[equipmentLevel];
  return { bodyLevel, equipmentLevel, sprintDuration, flightDuration, sprintDrain: ENDURANCE.capacity / sprintDuration, flightDrain: ENDURANCE.capacity / flightDuration };
}

function branchView(id, state, story, context, stats) {
  const body = id === 'body', tiers = body ? BODY_TIERS : EQUIPMENT_TIERS;
  const level = body ? stats.bodyLevel : stats.equipmentLevel;
  const durations = ENDURANCE.durations;
  const completed = level === EVOLUTION.maxLevel;
  const restRemaining = Math.max(0, EVOLUTION.restSeconds - finite(state.restTime));
  const requirements = completed ? [] : [
    ...tierRequirements(tiers[level], state, story),
    { label: '落地并离开交通工具', met: isSafeGround(context) },
    body
      ? { label: '原地站稳休息 3 秒', met: restRemaining <= 1e-7, current: EVOLUTION.restSeconds - restRemaining, target: EVOLUTION.restSeconds }
      : { label: '靠近返回信标或已供电的配电终端', met: context?.canCalibrate === true },
  ];
  const ready = !completed && requirements.every(requirement => requirement.met);
  const missing = requirements.filter(requirement => !requirement.met);
  const status = completed ? '已完成全部进化' : ready ? (body ? '已适应环境，可以确认进化' : '校准条件满足，可以升级玄壳') : missing.map(requirement => requirement.label).join('；');
  return {
    id, title: body ? '身体进化' : '装备进化', level, maxLevel: EVOLUTION.maxLevel,
    currentName: level ? tiers[level - 1].name : (body ? '初始体能' : '初始玄壳'),
    nextName: completed ? null : tiers[level].name,
    currentDuration: durations[level], nextDuration: completed ? null : durations[level + 1],
    ready, completed, actionLabel: completed ? '已达最高阶段' : body ? '确认身体进化' : '执行装备校准', status, requirements,
    roadmap: tiers.map((tier, index) => ({ level: index + 1, name: tier.name, duration: durations[index + 1], completed: index < level, current: index + 1 === level, next: index === level, requirements: tierRequirements(tier, state, story) })),
  };
}

export function evolutionView(state, story, context = {}) {
  const stats = evolutionStats(state);
  return {
    body: branchView('body', state, story, context, stats),
    equipment: branchView('equipment', state, story, context, stats),
    footDistance: distanceOf(state.footDistance),
    restRemaining: clamp(EVOLUTION.restSeconds - finite(state.restTime), 0, EVOLUTION.restSeconds),
    stats,
  };
}

export function evolve(state, branch, story, context = {}) {
  if (branch !== 'body' && branch !== 'equipment') return { changed: false, message: '未知的进化路线。' };
  const view = evolutionView(state, story, context)[branch];
  if (view.completed) return { changed: false, message: `${view.title}已达到当前最高阶段。` };
  if (!view.ready) return { changed: false, message: `暂不能${branch === 'body' ? '进化' : '校准'}：${view.status}。` };
  state[branch === 'body' ? 'bodyLevel' : 'equipmentLevel'] = view.level + 1;
  const duration = Number(view.nextDuration.toFixed(1));
  return { changed: true, message: `${view.nextName}完成：满${branch === 'body' ? '体力冲刺' : '能量助推'}时长提升至 ${duration} 秒，当前${branch === 'body' ? '体力' : '能量'}不变。` };
}
