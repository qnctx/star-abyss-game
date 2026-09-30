import { SURVEY_SITES } from './survey-sites.mjs';
import { calibrationMatches } from './calibration.mjs';

const IDS = SURVEY_SITES.map(site => site.id);
const has = (value, key) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, key);
const available = story => has(story?.flags, 'complete') && story.flags.complete === true;
const RECORDS = Object.freeze({
  'survey-west': {
    title: '远野 01 · 断环不是天线',
    text: '观测架的朝向沿着地表弯曲，接收端背对天空。它没有发射回路，留下的只是地层震动与时钟的差值。你用同一份原始时钟完成三路校准，把样本带回断网信标。\n离线比对发现，提前 17 分钟的分量也出现在与坠舰无关的地层记录里。这不能证明是谁先发出了声音；它只说明，坠舰可能不是现象的起点。一条维护索引指向东侧的埋沙镜阵。',
  },
  'survey-east': {
    title: '远野 02 · 镜面里的空白',
    text: '四面镜柱没有成像装置。它们把同一束微弱脉冲分送至不同长度的地下光路，再比较返回的间隔。最长光路不是最晚返回的一路。三路补偿对齐时，镜面中短暂出现一个没有人物的着陆点轮廓。\n封存后的原始数据只包含一段连续空白，画面没有被记录下来。不能把目击当成已经证实的事实。最后一条机械刻度标注了北面的倾斜石柱：在那里，没有接收回波的接口。',
  },
  'survey-north': {
    title: '远野 03 · 不等待回声的钟',
    text: '石柱内部是一组彼此隔离的计时单元，测量的是本地材料的变化，不向外发送，也不等待回声。你只读出三个现有通道，为它们设置相同的本地基准。\n回到信标后，这份静默样本与前两处记录出现同样的时间缺口。装置之间没有已知连接；也没有证据能说明，缺口究竟来自地层、时钟，还是观察它们的人。三份证据已经离线封存。',
  },
});
const OPENING = Object.freeze({
  title: '远野委托 · 封存之后',
  text: '地下返流已经切断。黑匣子的离线索引里仍有三处地表测量的校验位置，它们不属于坠舰设备。先前的维护者没有留下结论。\n从西侧断环观测架开始，只接收现场记录。每取得一个样本，都回到着陆信标进行离线比对和封存；下一处位置从已验证的索引中展开。不要重开上行，也不要把未经验证的推断发送出去。',
});
const ENDING = Object.freeze({
  title: '远野终记 · 留下问号',
  text: '三份远野样本与坠舰证据被分开封存。它们支持同一个异常，却没有给出同一个起源。你在结论栏写下：“尚未确定。没有必要用回答来换取答案。”\n信标继续安静地计时。地表仍然可以探索；已完成的测量不会再产生新的样本，也不会重新接通那条回路。',
});

export function createSurvey() {
  return { version: 1, archived: [], pending: null };
}

function clean(raw) {
  const state = createSurvey();
  if (!has(raw, 'version') || raw.version !== 1) return state;
  if (has(raw, 'archived') && Array.isArray(raw.archived)) {
    for (let index = 0; index < IDS.length; index++) {
      if (!Object.hasOwn(raw.archived, index) || raw.archived[index] !== IDS[index]) break;
      state.archived.push(IDS[index]);
    }
  }
  if (has(raw, 'pending') && state.archived.length < IDS.length && raw.pending === IDS[state.archived.length]) state.pending = raw.pending;
  return state;
}

export function restoreSurvey(raw, story) {
  return available(story) ? clean(raw) : createSurvey();
}

export function serializeSurvey(state) {
  return clean(state);
}

export function surveyView(state, story) {
  const unlocked = available(story), saved = unlocked ? clean(state) : createSurvey();
  const count = saved.archived.length, complete = unlocked && count === IDS.length;
  const current = unlocked && !complete ? SURVEY_SITES[count] : null;
  const pending = saved.pending;
  const summary = !unlocked ? '完成两章调查并离线封存后，展开远野索引。'
    : complete ? '远野证据已全部离线封存 · 3 / 3'
      : pending ? `携带 ${current.name} 样本 · 返回信标封存 · ${count} / 3`
        : `远野测量 ${count + 1} / 3 · ${current.name}`;
  const records = unlocked ? [{ ...OPENING }, ...saved.archived.map(id => ({ ...RECORDS[id] }))] : [];
  if (pending) records.push({ title: `待封存 · ${current.name}`, text: '三路现场相位已经对齐，原始样本保存在外勤终端。当前只确认了测量完整性，尚未与离线证据比对。返回着陆信标并按 E 封存，才能展开下一条索引。' });
  if (complete) records.push({ ...ENDING });
  const objective = !unlocked ? null : complete
    ? { title: '给未知留下一个问号', detail: '三份远野证据已离线封存。没有重开上行，仍可自由探索并重读调查档案。', target: null }
    : pending
      ? { title: '把现场样本带回静默信标', detail: `${current.name} 的三路测量已保存。返回着陆点按 E 离线封存，再展开下一条索引。`, target: 'beacon' }
      : { title: `远野调查 · ${current.name}`, detail: `离线索引 ${count + 1}/3 · 前往测量装置，落地并下车，对齐三路现场相位。只接收，不发送。`, target: current.id };
  return { available: unlocked, complete, pending, archivedCount: count, current, objective, knownIds: unlocked ? [...saved.archived, ...(current ? [current.id] : [])] : [], records, summary };
}

export function collectSurvey(state, id, story, measurement) {
  const view = surveyView(state, story);
  if (!view.available) return { changed: false, message: '先完成坠舰与地下返流的调查，将证据离线封存。此处装置保持休眠。' };
  if (view.complete || clean(state).archived.includes(id)) return { changed: false, message: '这处远野记录已经封存，重复测量不会产生新的样本。' };
  if (view.pending) return { changed: false, message: '已有一份现场样本待封存。先回返回信标完成离线比对，不混用时钟基准。' };
  if (!view.current || id !== view.current.id) return { changed: false, message: '此处索引尚未验证。先调查当前已公开的测量装置。' };
  if (!calibrationMatches(id, measurement?.values)) return { changed: false, message: '三路现场相位尚未对齐。完成调谐后再确认保存样本。' };
  state.pending = id;
  return { changed: true, message: `${view.current.name} 的现场样本已保存。返回着陆信标按 E 离线封存，下一处索引将在比对后展开。` };
}

export function archiveSurvey(state, story) {
  const view = surveyView(state, story);
  if (!view.available || !view.pending) return { changed: false, message: view.complete ? '三份远野证据已经封存。保留未知，不重新发送。' : '没有待封存的远野样本。' };
  const saved = clean(state);
  saved.archived.push(saved.pending);
  saved.pending = null;
  Object.assign(state, saved);
  const next = surveyView(state, story);
  return { changed: true, message: next.complete
    ? '三份远野证据已全部离线封存。异常仍未确定起源；远野终记已加入档案。'
    : `远野样本已离线封存 · ${next.archivedCount}/3。已验证下一条索引：${next.current.name}。` };
}
