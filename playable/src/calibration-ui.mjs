const CHANNEL_NAMES = ['裂', '环', '星'];

function wavePath(angle) {
  const radians = angle * Math.PI / 180;
  return Array.from({ length: 97 }, (_, index) => {
    const x = index * 5;
    const y = 60 - Math.sin(index / 96 * Math.PI * 4 + radians) * 33;
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(2)}`;
  }).join(' ');
}

function channelMarkup(name, index) {
  return `<article class="calibration-channel" data-channel="${index}">
    <header class="calibration-channel-heading"><div><span class="calibration-channel-number">0${index + 1}</span><h3>${name}通道</h3></div><span class="calibration-channel-state">等待调谐</span></header>
    <div class="calibration-wave-wrap">
      <svg class="calibration-wave" viewBox="0 0 480 120" preserveAspectRatio="none" role="img" aria-label="${name}通道目标与补偿后的实测波形">
        <path class="calibration-wave-grid" d="M0,20H480M0,60H480M0,100H480M0,0V120M120,0V120M240,0V120M360,0V120M480,0V120" />
        <path class="calibration-wave-reference" fill="none" /><path class="calibration-wave-measured" fill="none" />
      </svg>
      <div class="calibration-wave-key"><span><i class="calibration-reference-key"></i>目标波形</span><span><i class="calibration-measured-key"></i>补偿后实测</span></div>
    </div>
    <dl class="calibration-readings"><div><dt>原始相位</dt><dd class="calibration-source">—</dd></div><div><dt>目标相位</dt><dd class="calibration-target">—</dd></div><div><dt>相位残差</dt><dd class="calibration-residual">—</dd></div></dl>
    <div class="calibration-adjustment"><label for="calibration-channel-${index}">相位补偿</label><output for="calibration-channel-${index}" class="calibration-value">0°</output></div>
    <input id="calibration-channel-${index}" class="calibration-slider" type="range" min="0" max="345" step="15" value="0" aria-label="${name}通道相位补偿" aria-describedby="calibration-equation-${index}">
    <div class="calibration-range-scale" aria-hidden="true"><span>0°</span><span>每格 15°</span><span>345°</span></div>
    <div class="calibration-step-controls"><button type="button" class="calibration-step-minus" aria-label="${name}通道补偿减少 15 度">− 15°</button><button type="button" class="calibration-step-plus" aria-label="${name}通道补偿增加 15 度">＋ 15°</button></div>
    <p id="calibration-equation-${index}" class="calibration-equation">原始相位 + 补偿 = 当前相位</p>
  </article>`;
}

/** The rules own all values and completion checks; this terminal only renders them. */
export function createCalibrationUI({ change, confirm, cancel }) {
  const element = document.createElement('section');
  element.id = 'calibration-screen';
  element.className = 'screen overlay calibration-overlay';
  element.hidden = true;
  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-labelledby', 'calibration-title');
  element.setAttribute('aria-describedby', 'calibration-instruction');
  element.innerHTML = `<div class="calibration-shell">
    <header class="calibration-header"><div><p class="calibration-eyebrow">FIELD RESONANCE / 现场调谐</p><h2 id="calibration-title">被动相位终端</h2></div><span class="calibration-safety"><span aria-hidden="true">◇</span>仅接收 · 上行已断开</span></header>
    <div class="calibration-scroll">
      <div class="calibration-brief"><div><p class="calibration-mode" id="calibration-mode">同相采样</p><p id="calibration-instruction"></p><p class="calibration-howto">拖动三路滑块，或按 ±15° 微调。让实测线与目标线重合；三路残差都为 0° 后再确认。</p></div><div class="calibration-quality"><span>波形吻合</span><strong id="calibration-quality">0<small>%</small></strong><div class="calibration-quality-track"><span id="calibration-quality-fill"></span></div><span id="calibration-channel-count">0 / 3 通道对齐</span></div></div>
      <div class="calibration-channels">${CHANNEL_NAMES.map(channelMarkup).join('')}</div>
      <p class="calibration-note"><span aria-hidden="true">◇</span>本地补偿不会开启新的上行信号。没有倒计时，取消无惩罚；未确认的调谐不会写入调查记录。</p>
    </div>
    <footer class="calibration-footer"><p id="calibration-feedback" role="status" aria-live="polite">等待三路波形对齐。</p><div class="calibration-actions"><button type="button" id="calibration-cancel" class="quiet-button"><kbd>Esc</kbd> 暂离终端</button><button type="button" id="calibration-confirm" class="primary-button" disabled>确认现场样本 <span aria-hidden="true">↗</span></button></div></footer>
  </div>`;
  document.querySelector('main').append(element);
  const select = selector => element.querySelector(selector);
  const nodes = CHANNEL_NAMES.map((_, index) => {
    const card = select(`[data-channel="${index}"]`);
    const node = selector => card.querySelector(selector);
    const range = node('input');
    range.addEventListener('input', () => change(index, Number(range.value)));
    node('.calibration-step-minus').addEventListener('click', () => change(index, (Number(range.value) + 345) % 360));
    node('.calibration-step-plus').addEventListener('click', () => change(index, (Number(range.value) + 15) % 360));
    return { card, range, status: node('.calibration-channel-state'), source: node('.calibration-source'), target: node('.calibration-target'), residual: node('.calibration-residual'), value: node('output'), equation: node('.calibration-equation'), reference: node('.calibration-wave-reference'), measured: node('.calibration-wave-measured'), wave: node('svg') };
  });
  const confirmButton = select('#calibration-confirm');
  confirmButton.addEventListener('click', () => { if (!confirmButton.disabled) confirm(); });
  select('#calibration-cancel').addEventListener('click', cancel);
  let previousSignature = '';

  function update(view) {
    if (!view) return;
    const signature = JSON.stringify(view);
    if (signature === previousSignature) return;
    previousSignature = signature;
    element.dataset.mode = view.mode;
    select('#calibration-title').textContent = view.title;
    select('#calibration-instruction').textContent = view.instruction;
    select('#calibration-mode').textContent = view.mode === 'invert' ? '反相隔离 · 目标 180°' : '同相采样 · 目标 0°';
    select('#calibration-quality').firstChild.nodeValue = String(view.quality);
    select('#calibration-quality-fill').style.width = `${view.quality}%`;
    select('#calibration-channel-count').textContent = `${view.channels.filter(channel => channel.aligned).length} / 3 通道对齐`;
    confirmButton.disabled = !view.ready;
    confirmButton.firstChild.nodeValue = view.mode === 'invert' ? '确认反相隔离 ' : '确认现场样本 ';
    select('#calibration-feedback').textContent = view.ready
      ? view.mode === 'invert' ? '三路反相成立。确认后隔离返流。' : '三路相位一致。可以保存现场样本。'
      : '尚有通道未对齐：调整补偿，将每路残差归零。';
    view.channels.forEach((channel, index) => {
      const node = nodes[index];
      const phase = (channel.sourceAngle + channel.value) % 360;
      node.card.dataset.aligned = String(channel.aligned);
      node.status.textContent = channel.aligned ? '已对齐' : '待补偿';
      node.range.value = String(channel.value);
      node.range.setAttribute('aria-valuetext', `${channel.value} 度补偿，残差 ${channel.residual} 度`);
      node.source.textContent = `${channel.sourceAngle}°`;
      node.target.textContent = `${channel.targetAngle}°`;
      node.residual.textContent = `${channel.residual}°`;
      node.value.textContent = `${channel.value}°`;
      node.equation.textContent = `${channel.sourceAngle}° + ${channel.value}° → ${phase}° / 目标 ${channel.targetAngle}°`;
      node.reference.setAttribute('d', wavePath(channel.targetAngle));
      node.measured.setAttribute('d', wavePath(phase));
      node.wave.setAttribute('aria-label', `${channel.name}通道：补偿后 ${phase} 度，目标 ${channel.targetAngle} 度，残差 ${channel.residual} 度`);
    });
  }
  return { update, element };
}
