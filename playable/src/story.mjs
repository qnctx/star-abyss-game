import { POINTS } from './layout.mjs';
import { calibrationMatches } from './calibration.mjs';

const CHAPTER_VERSION = 2;
const FIRST_CHAPTER_FLAGS = ['signal', 'entered', 'fuse', 'power', 'log', 'gateOpen', 'blackbox'];
const FLAG_NAMES = [...FIRST_CHAPTER_FLAGS, 'returned', 'echoCalibrated', 'capsuleCalibrated', 'riftClosed', 'complete'];
const RELAY_ORDER = [2, 1, 3];
const OPTIONAL_LOGS = ['echo', 'capsule'];
const POINT_IDS = new Set(POINTS.map(point => point.id));
const RECORDS = Object.freeze({
  arrival: {
    title: '00 · 登陆后 03 分钟',
    text: '你从着陆舱醒来。远方是一艘没有登记编号的坠毁舰，只有一条低功率求救信号还在重复。返回信标已启动；在拿到证据前，没有人会相信这里发生过什么。',
  },
  signal: {
    title: '01 · 提前抵达的声音',
    text: '中继缓存的时间比你的登陆早了 17 分钟。求救者使用你的声纹：“不要信任最后一条返航指令。进去，找到原始记录。”最后三个字被某种周期性的低音覆盖。信号确实来自那艘残骸，不是你的着陆舱。',
  },
  entered: {
    title: '02 · 破口朝向',
    text: '船体破口的金属向外翻卷，地面没有救援队经过的足迹。门框上的应急示意图仍能辨认：左侧货舱存放备用电芯，主廊的配电箱负责恢复中继室。舰内没有生命信号。',
  },
  fuse: {
    title: '03 · 未使用的备用电芯',
    text: '货舱里几乎所有设备都拆除了，只有一枚封装完好的电芯被摆在检修台上。封签日期是事故之后的第二天。将它接入主廊配电箱，可以恢复内层门锁和本地记录。',
  },
  power: {
    title: '04 · 仍有人值班',
    text: '电力恢复时，舰内广播说了一句“值班员已返回”。系统没有要求你的身份验证。右侧中继室亮起了三盏灯；内层密封门依然锁着，只接受人工中继校验。',
  },
  log: {
    title: '05 · 值班员的最后一页',
    text: '“乘员栏一直是空的。航向不是故障，是我们主动设定的。若返航系统再次用熟悉的声音说话，不要回答。\n人工开锁顺序：先裂，再环，最后星。\n二号中继是「裂」，一号是「环」，三号是「星」。按错会清空本次序列。黑匣子保留了未经改写的第一条航向指令。”',
  },
  gateOpen: {
    title: '06 · 密封门开启',
    text: '裂 → 环 → 星。校验通过后，门内传来一声短促的回响，仿佛有人比你先走了一步。原始记录舱在主廊尽头。没有新的生命信号。',
  },
  blackbox: {
    title: '07 · 原始航向',
    text: '黑匣子里没有求救记录，只有一条被重复执行的返航命令。命令的发出者仍是你的声纹，目的地却不是家园，而是你刚刚留下的返回信标。远处的信标开始闪烁。带回完整记录，才能关闭这条循环。',
  },
  returned: {
    title: '08 · 回执来自地下',
    text: '信标已切断自动返航上行链路，黑匣子原始记录保存在独立存储器中。求救声暂时停止，回执却显示：“接收完成，17 分钟前。”即使天线断开，回执仍在出现。源头不在轨道，而在地下。\n你的外勤终端已载入黑匣子的原始时钟。前往无名石碑与空的逃生舱，各取得一次新的现场相位样本；旧调查记录没有同一时钟基准，不能用于定位。两处采样可按任意顺序完成。靠近后打开现场调谐，对照终端显示的裂、环、星三路实测角度，以 15° 为步长调节补偿，使每路“实测 + 补偿”归零，再保存样本。360° 与 0° 等价。',
  },
  echoCalibrated: {
    title: '09 · 石碑不是纪念物',
    text: '以黑匣子的原始时钟重新测量，石碑的回波不是晚到，而是在提前播放另一端的动作。三道纹样是馈线标记，石碑只是地下回路露出地面的端点。\n石碑相位样本已校准。还需要逃生舱的独立样本才能交叉定位；单凭这一条回波，任何方向都可能通往同一个坐标。',
  },
  capsuleCalibrated: {
    title: '10 · 没有人乘坐过它',
    text: '对照原始时钟后，逃生舱的记录开始倒序播放。它从未执行逃生程序，而是在重复模拟你的抵达。座椅底部贴着人工维护规程：“先隔离上行，再以两端实测相位抵消返流。不可使用缓存样本。停止发送，不要回答。”\n逃生舱相位样本已校准。它与石碑样本一旦配对，即可定位地下回声源，并生成不发送新信号的反相隔离参数。',
  },
  riftClosed: {
    title: '11 · 不回答的那个人',
    text: '两处样本指向同一条地下裂隙。你遵照维护规程，确认上行已隔离，将石碑和逃生舱的实测相位反向配对，只切断返流，不向深处发送询问。\n裂隙中的光逐层熄灭。最后一段声音说：“我还没有抵达。”它第一次没有使用你的声纹。外勤终端保留了隔离记录；返回信标，离线封存黑匣子与这次测量，确认循环没有重新建立。',
  },
  complete: {
    title: '12 · 留给下一位抵达者',
    text: '信标在断网状态下完成了校验。黑匣子、两处实测相位和地下隔离记录被写入同一份离线证据包。没有收到提前 17 分钟的回执。\n你没有将这组坐标广播出去，只留下一个无声的定位标记。求救声终于停止；存储器里却多出了一段没有时间戳的呼吸声。调查至此完成。你仍可自由探索，证据和已发现的地点都会保留。',
  },
  echo: {
    title: '支线 · 无名石碑',
    text: '石碑表面没有文字，只有「裂、环、星」三个纹样。扫描回波晚了整整 17 秒，却回报你正在向前走；你已经停下。纹样与残骸中继台的标记相同，磨损程度却至少早了几个世纪。',
  },
  capsule: {
    title: '支线 · 空的逃生舱',
    text: '舱内没有遗体，也没有任何人的生活痕迹。座椅束带仍被扣成适合你体型的长度，铭牌与着陆舱完全一致。记录器只有一句话：“这一次，把原始记录带回来。”',
  },
});

export function createStory() {
  return { chapterVersion: CHAPTER_VERSION, flags: Object.fromEntries(FLAG_NAMES.map(name => [name, false])), sequence: [], logs: [] };
}

function remember(state, id) {
  if (!state.logs.includes(id)) state.logs.push(id);
}

function discover(state, flag) {
  state.flags[flag] = true;
  remember(state, flag);
}

// Only known data is restored. Journal prose always comes from this module, never a save.
export function restoreStory(raw) {
  const state = createStory();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return state;
  const flags = raw.flags;
  if (!flags || typeof flags !== 'object' || Array.isArray(flags)) return state;
  const currentChapter = Object.hasOwn(raw, 'chapterVersion') && raw.chapterVersion === CHAPTER_VERSION;
  for (const name of currentChapter ? FLAG_NAMES : FIRST_CHAPTER_FLAGS) {
    state.flags[name] = Object.hasOwn(flags, name) && flags[name] === true;
  }
  const f = state.flags;
  // The former ending is now the first return, never the ending of chapter two.
  if (!currentChapter) f.returned = Object.hasOwn(flags, 'complete') && flags.complete === true;
  f.fuse &&= f.entered;
  f.power &&= f.fuse;
  f.log &&= f.power;
  f.gateOpen &&= f.log;
  f.blackbox &&= f.gateOpen;
  f.returned &&= f.blackbox;
  f.echoCalibrated &&= f.returned;
  f.capsuleCalibrated &&= f.returned;
  f.riftClosed &&= f.echoCalibrated && f.capsuleCalibrated;
  f.complete &&= f.riftClosed;
  if (f.gateOpen) {
    state.sequence = [...RELAY_ORDER];
  } else if (f.log && Array.isArray(raw.sequence) && raw.sequence.length < RELAY_ORDER.length
    && raw.sequence.every((value, index) => value === RELAY_ORDER[index])) {
    state.sequence = [...raw.sequence];
  }
  state.logs = FLAG_NAMES.filter(name => f[name]);
  if (Array.isArray(raw.logs)) {
    for (const id of OPTIONAL_LOGS) if (raw.logs.includes(id)) remember(state, id);
  }
  return state;
}

export function objective(state) {
  const f = state.flags;
  if (f.complete) return { title: '回声回路已切断', detail: '离线证据已封存。没有新的回执，仍可自由探索地表。', target: null };
  if (f.riftClosed) return { title: '封存没有回执的证据', detail: '返回着陆点，在信标离线校验黑匣子与地下隔离记录。', target: 'beacon' };
  if (f.returned) {
    if (f.echoCalibrated && f.capsuleCalibrated) {
      return { title: '切断地下回声源', detail: '两处实测相位已交叉定位。前往地下回声源，将三路调谐至 180° 反相隔离返流，不发送新信号。', target: 'rift' };
    }
    const sampled = Number(f.echoCalibrated) + Number(f.capsuleCalibrated);
    return { title: '用真实的时间重新测量', detail: `现场相位 ${sampled}/2 · 前往${f.echoCalibrated ? '空的逃生舱' : f.capsuleCalibrated ? '无名石碑' : '无名石碑与空的逃生舱（顺序不限）'}，将三路调谐归零。旧日志不能替代这次测量。`, target: f.echoCalibrated ? 'capsule' : 'echo' };
  }
  if (f.blackbox) return { title: '把证据带回信标', detail: '返回着陆点，将黑匣子与返回信标隔离连接。', target: 'beacon' };
  if (f.gateOpen) return { title: '进入原始记录舱', detail: '密封门已开启。沿主廊深入，回收尽头的黑匣子。', target: 'blackbox' };
  if (f.log) {
    const next = RELAY_ORDER[state.sequence.length];
    return { title: '校验人工中继', detail: `先裂，再环，最后星 · ${state.sequence.length}/3 已接通`, target: `relay-${next}` };
  }
  if (f.power) return { title: '寻找开锁记录', detail: '进入主廊右侧的中继室，读取值班员记录。', target: 'log' };
  if (f.fuse) return { title: '恢复应急电力', detail: '将备用电芯接入主廊的应急配电箱。', target: 'power' };
  if (f.entered) return { title: '调查左侧货舱', detail: '舰内断电。在左侧货舱寻找备用电芯。', target: 'fuse' };
  if (f.signal) return { title: '走进坠毁舰', detail: '从舰尾正面的破口进入，调查求救声的来源。', target: 'breach' };
  return { title: '追踪失真的求救信号', detail: '靠近残骸前的中继器，核对这段使用你声纹的求救。', target: 'signal' };
}

export function interact(state, id, measurement) {
  if (!POINT_IDS.has(id)) return { message: '这里没有可操作的设备。', changed: false };
  const f = state.flags;
  const unchanged = message => ({ message, changed: false });
  const advance = (flag, message) => { discover(state, flag); return { message, changed: true }; };

  if (id === 'signal') {
    if (f.signal) return unchanged('中继仍在重复你的声音。记录已保存到调查日志。');
    return advance('signal', '声纹吻合。求救时间却比你的登陆早了 17 分钟。来源：前方坠毁舰。');
  }
  if (id === 'breach') {
    if (f.entered) return unchanged('破口可以直接通行。左侧货舱与右侧中继室连通主廊。');
    return advance('entered', '进入残骸。破口向外翻卷；左侧货舱的应急灯还在闪。');
  }
  if (id === 'fuse') {
    if (f.fuse) return unchanged('备用电芯已经回收。');
    if (!f.entered) return unchanged('先从船体破口进入货舱。');
    return advance('fuse', '已取出备用电芯。封签日期在事故之后。主廊的配电箱可以接入。');
  }
  if (id === 'power') {
    if (f.power) return unchanged('应急供电稳定。右侧中继室已经通电。');
    if (!f.fuse) return unchanged('配电箱缺少电芯。应急示意图指向左侧货舱。');
    return advance('power', '应急电力恢复。广播：“值班员已返回。”右侧中继室亮起了灯。');
  }
  if (id === 'log') {
    if (!f.power) return unchanged('记录终端没有电力。先恢复主廊的应急供电。');
    if (f.log) return unchanged('开锁顺序：二号「裂」→ 一号「环」→ 三号「星」。完整记录可在日志中重读。');
    return advance('log', '值班记录：先裂，再环，最后星。对应二号、一号、三号中继。按错会清空序列。');
  }
  if (id.startsWith('relay-')) {
    if (!f.power) return unchanged('中继离线：需要应急电力。');
    if (!f.log) return unchanged('中继需要人工校验。先读取旁边的值班员记录，确认三个纹样的顺序。');
    if (f.gateOpen) return unchanged('中继校验已完成，内层密封门保持开启。');
    const number = Number(id.slice(-1));
    if (number !== RELAY_ORDER[state.sequence.length]) {
      const changed = state.sequence.length > 0;
      state.sequence = [];
      return { message: '相位不符。序列已清空；从二号「裂」重新开始。', changed };
    }
    state.sequence.push(number);
    if (state.sequence.length === RELAY_ORDER.length) {
      return advance('gateOpen', '裂 → 环 → 星。校验通过，主廊内层密封门已开启。');
    }
    return { message: `${number === 2 ? '「裂」' : '「环」'}已接通 · ${state.sequence.length}/3。${state.sequence.length === 1 ? '下一步：一号「环」。' : '下一步：三号「星」。'}`, changed: true };
  }
  if (id === 'blackbox') {
    if (!f.gateOpen) return unchanged('原始记录舱被密封。需要先完成中继校验。');
    if (f.blackbox) return unchanged(f.returned ? '黑匣子已在返回信标隔离保存。外勤终端携带着它的原始时钟基准。' : '黑匣子已在你的随身容器中。把它带回返回信标。');
    return advance('blackbox', '黑匣子已回收。原始指令的目的地，竟是你的返回信标。带回记录，停止自动返航。');
  }
  if (id === 'beacon') {
    if (f.complete) return unchanged('离线证据已封存，回声回路保持断开。你可以继续探索地表。');
    if (!f.blackbox) return unchanged('返回信标运行中。需要坠毁舰的原始黑匣子，才能辨认求救信号。');
    if (f.riftClosed) return advance('complete', '离线校验通过。黑匣子与地下隔离记录已封存。这一次，没有提前抵达的回执。调查完成。');
    if (f.returned) return unchanged(f.echoCalibrated && f.capsuleCalibrated
      ? '两处实测相位已定位地下回声源。前往裂隙隔离返流，再回来封存证据。'
      : '信标上行已隔离。仍需石碑与逃生舱的新现场相位；旧日志不能替代校准。');
    return advance('returned', '信标上行已隔离，但地下仍在回传。第二阶段：带着原始时钟，重新校准石碑与逃生舱。');
  }
  if (id === 'rift') {
    if (f.riftClosed) return unchanged('地下返流已切断。不要重新发送信号；返回信标封存隔离记录。');
    if (!f.returned) return unchanged('裂隙的回声无法解析。先将黑匣子带回信标，隔离上行并取得原始时钟。');
    if (!f.echoCalibrated || !f.capsuleCalibrated) return unchanged('隔离参数不完整。需要石碑与逃生舱两处新采集的现场相位，不能使用旧日志。');
    if (!calibrationMatches(id, measurement?.values)) return unchanged('返流仍在持续。打开现场调谐，将裂、环、星三路的实测相位加补偿调至 180°，确认反相后再隔离。');
    return advance('riftClosed', '上行已隔离，两处实测相位反向配对。地下返流停止。带着隔离记录回信标，完成离线封存。');
  }
  if (OPTIONAL_LOGS.includes(id)) {
    if (f.returned) {
      const flag = id === 'echo' ? 'echoCalibrated' : 'capsuleCalibrated';
      if (f[flag]) return unchanged('这处现场相位已完成校准。实测样本保存在外勤终端，不需要重复采集。');
      if (!calibrationMatches(id, measurement?.values)) return unchanged('现场相位尚未对齐。打开现场调谐，将裂、环、星三路的实测相位加补偿调至 0°，对齐后保存新样本。');
      remember(state, id);
      const result = advance(flag, id === 'echo'
        ? '石碑现场相位已校准。它是地下回路的端点，不是纪念物。'
        : '逃生舱现场相位已校准。维护规程：先隔离上行，以两端实测相位抵消返流，不要回答。');
      result.message += f.echoCalibrated && f.capsuleCalibrated
        ? ' 两处样本匹配：地下回声源已标入地图。'
        : ` 还需要${id === 'echo' ? '逃生舱' : '石碑'}的新现场样本。`;
      return result;
    }
    if (state.logs.includes(id)) return unchanged('这处异常已记录。打开调查日志可重新查看。');
    remember(state, id);
    return { message: id === 'echo'
      ? '石碑上刻着裂、环、星。回波描述的却是 17 秒之后的你。调查记录已保存。'
      : '空舱铭牌与你的着陆舱一致。记录器：“这一次，把原始记录带回来。”', changed: true };
  }
  return unchanged('设备没有响应。');
}

export function getJournal(state) {
  const ids = ['arrival', ...FLAG_NAMES.filter(name => state.flags[name]), ...OPTIONAL_LOGS.filter(id => state.logs.includes(id))];
  return ids.map(id => ({ ...RECORDS[id] }));
}
