(function (SA) {
  'use strict';

  // 游戏内说明书的唯一内容源。新增或改变玩法时，同步维护对应页和 docs/HTML5_PROTOTYPE.md。
  var C = SA.Config;
  function list(items) { return '<ul>' + items.map(function (item) { return '<li>' + item + '</li>'; }).join('') + '</ul>'; }
  function section(title, body) { return '<section class="guide-section"><h3>' + title + '</h3>' + body + '</section>'; }
  function grid(items) { return '<div class="guide-grid">' + items.join('') + '</div>'; }
  function costText(cost) { return Object.keys(cost).map(function (key) { return cost[key] + ' ' + C.resources[key].label; }).join(' / '); }
  function zoneCards() {
    var notes = {
      crash: '起点区域；无适应要求。Lv4 时氧耗还有额外减免。',
      cold: '高氧耗区域；建议适应 Lv2 后再让扫描导航进入。',
      heat: '高氧耗区域；适应低于 Lv2 时，放在这里的建筑会受高温侵蚀。',
      gravity: '最高氧耗区域；适应低于 Lv2 时，移动速度降至 70%。'
    };
    return '<div class="guide-zone-grid">' + Object.keys(C.zones).map(function (id) {
      var zone = C.zones[id];
      return '<section class="guide-zone-card"><h3>' + zone.label + '</h3><p>氧耗 x' + zone.pressure.toFixed(2) + ' · 建议 Lv' + zone.recommend + '</p><small>' + notes[id] + '</small></section>';
    }).join('') + '</div>';
  }
  function buildingCards() {
    return '<div class="guide-building-grid">' + C.buildOrder.map(function (id) {
      var building = C.buildings[id], unlock = C.unlocks[id];
      return '<section class="guide-building-card"><h3>' + building.label + '</h3><p>' + building.summary + '</p><small>成本：' + costText(building.cost) + (unlock ? ' · 解锁：' + costText(unlock) : '') + '</small></section>';
    }).join('') + '</div>';
  }
  function keyCards() {
    var keys = [
      ['WASD / 方向键', '移动；Shift 冲刺，但额外耗氧。'],
      ['1–5 + 左键', '武器、采集器、扫描器、建造、维修。左键只执行当前工具。'],
      ['G / F / Q', '选择下一次扫描类别 / 使用附近 O2 植株 / 使用 O2 Kit。'],
      ['B / T', '打开建筑目录 / 区域适应血清面板。'],
      ['X / U / Y', '回收附近建筑 / 在基地核心升级扫描器、靠近炮塔升级炮塔 / 解锁当前选中的建筑科技。'],
      ['P / 顶栏存档 / Esc', '快速保存自动档 / 打开自动档与三个手动档位 / 关闭面板或暂停游戏。']
    ];
    return '<div class="guide-key-grid">' + keys.map(function (entry) { return '<section><kbd>' + entry[0] + '</kbd><p>' + entry[1] + '</p></section>'; }).join('') + '</div>';
  }

  var pages = [
    {
      id: 'overview', label: '概览', title: '01 · 星渊迷航是什么',
      lead: '这是一个以探索、基地建设和撤离坚守为核心的生存原型。你从坠毁区出发，在氧气和夜袭压力下建立一条可持续的资源循环。',
      body: function () { return grid([
        section('最终目标', '<p>建造信号台并维持供能，让救援信号推进至 100%；随后守住强制夜晚的 180 秒撤离窗口。倒计时结束即胜利，基地耐久归零则失败。</p>'),
        section('推荐推进顺序', list(['采集铁与生物质，优先建立第一座炮塔。', '建造氧气站扩大安全探索半径，再建太阳能板提供能量。', '建造研究站生产蓝图，解锁高级防御，最后建造信号台。'])),
        section('昼夜与死亡', '<p>白天 300 秒、夜袭 150 秒。玩家缺氧或受伤后 3 秒在基地复活，恢复 90 秒氧气并获得短暂无敌；Day 1 首次死亡不掉落，之后会遗落约半数资源。</p>'),
        section('保持节奏', '<p>不要一次带太多资源远行：超过 25 kg 后移动变慢、耗氧增加。先铺补氧点和防线，再深入高压区域。</p>')
      ]); }
    },
    {
      id: 'explore', label: '探索', title: '02 · 探索、资源与采集',
      lead: '资源并非只用于建造：能量维持信号，蓝图解锁科技，扫描则负责把探索变成可读、可控的路线。',
      body: function () { return grid([
        section('资源用途', list(['<strong>铁：</strong>基础建造、维修与升级。', '<strong>生物质：</strong>基础建造、血清与 O2 Kit。', '<strong>虚空晶体 / 能量核心：</strong>高级建筑与高阶血清。', '<strong>能量：</strong>太阳能板产出；供研究站、减速场和信号台消耗。', '<strong>蓝图：</strong>解锁护盾发生器、减速场，并作为信号台材料。'])),
        section('采集与负重', '<p>按 <kbd>2</kbd> 切到采集器。白色虚线代表作业范围；把鼠标移到范围内资源上，出现黄色名称圈后左键，便会精确采集该节点，点击空处不会自动采集最近资源。当前所在区域可操作；跨区采集、植株和缓存则要求目标区域达到建议适应等级。红色虚线标签表示未适应区目标，无法跨区采集。地图边框之外不属于探索区域，不会生成、显示或允许操作资源。</p>'),
        section('扫描与地下资源', '<p>按 <kbd>3</kbd> 后左键开始一次持续扫描；初始范围 ' + C.scanner.baseRange + 'm，虚线圆环显示当前范围。扫描会跨工具持续：切到采集器后，采空当前目标或移动进入新目标范围时会自动续锁，无须再切回扫描器点击。当前所在区域的资源始终可锁定，跨区域目标则必须达到建议适应等级。扫描优先当前区域、再按距离排序。回到基地核心 ' + C.scanner.upgradeRange + 'm 内按 <kbd>U</kbd> 可升级扫描器，每级增加 ' + C.scanner.rangePerLevel + 'm。地表资源是实心圆，已揭示地下资源是菱形并带“地下”标识。按 <kbd>G</kbd> 只改变下一次扫描类别。</p>'),
        section('补给与缓存', '<p>靠近 O2 植株按 <kbd>F</kbd> 补氧；按 <kbd>Q</kbd> 使用氧气罐。信号里程碑会生成缓存，靠近即可自动回收。死亡掉落也可回收。</p>')
      ]); }
    },
    {
      id: 'zones', label: '区域', title: '03 · 区域与适应血清',
      lead: '区域压力以氧耗为核心。血清等级会降低该区压力；未达到建议等级时，扫描不会把你导航到高压区域。',
      body: function () { return zoneCards() + grid([
        section('血清怎么用', '<p>通过“血清”面板制作对应区域的下一等级配方。每个区域可升至 Lv4；资源不足时按钮会保留当前配方和成本提示。</p>'),
        section('探索原则', '<p>先在坠毁区建立补氧与防线，积累材料后再提高极寒、熔岩或重力区适应。区域压力是软惩罚，不是地图墙，但低适应远行的氧气成本很高。</p>')
      ]); }
    },
    {
      id: 'buildings', label: '建筑', title: '04 · 建筑与基地循环',
      lead: '建筑目录和本页使用同一份配置：用途、成本和解锁条件会一起维护。选择建筑后会自动切换至建造工具。',
      body: function () { return buildingCards() + grid([
        section('放置与维护', '<p>按 <kbd>4</kbd> 可在当前所在区域远程布置建筑，不受玩家距离限制；跨区部署则要求目标区域达到建议适应等级，地图边框之外不能部署，且不能贴近基地核心或与现有建筑重叠。熔岩区热适应低于 Lv2 时，预览和确认框会显示“熔岩侵蚀”警告与每秒损耗；已建建筑会持续显示橙色侵蚀环和耐久。左键提交位置后还会显示确认窗口，取消不会扣资源。建筑受损时顶部会显示耐久条，按 <kbd>5</kbd> 靠近维修；按 <kbd>X</kbd> 回收附近建筑，返还其成本的 50%。</p>'),
        section('炮塔升级', '<p>靠近炮塔按 <kbd>U</kbd> 查看或执行升级。最高 Lv3；每级提高伤害、射程和射速，HUD 会显示成本或缺少的资源。</p>')
      ]); }
    },
    {
      id: 'defense', label: '防御', title: '05 · 夜袭、信号与撤离',
      lead: '白天用于补给与扩张，夜晚则检验防线。信号台让游戏进入撤离目标，也会要求你持续补充能量。',
      body: function () { return grid([
        section('敌人与炮塔', '<p>敌人会优先接近玩家、基地或建筑；抵达基地或建筑后不会自毁，而是每 0.8 秒持续攻击。按 <kbd>1</kbd> 左键射击；炮塔会自动索敌、转向和开火。实际由武器或炮塔击杀时，日志会分别显示“武器击杀”或“炮塔击杀”，并获得铁与生物质。</p>'),
        section('防线搭配', '<p>炮塔负责输出；减速场降低范围内敌人的移动速度；护盾发生器为基地提供护盾并持续恢复。建筑受损可维修，熔岩区的低适应建筑会额外受侵蚀。</p>'),
        section('信号推进', '<p>信号台使用专属天线与脉冲波标识，世界内标签会显示“信号台 · 当前进度”。每 12 秒消耗 1 能量并推进 5% 信号，HUD 会显示在线或断能状态；每次推进会提示“信号台广播”。25%、50%、75% 和 100% 会触发无线电记录与缓存；能量耗尽时信号暂停。</p>'),
        section('撤离窗口', '<p>信号达到 100% 后进入强制夜晚，敌人会持续来袭。守住 180 秒即撤离成功；这段时间不能靠等待白天跳过。</p>')
      ]); }
    },
    {
      id: 'controls', label: '操作', title: '06 · 操作、面板与存档',
      lead: '所有面板都会暂停世界，防止在阅读或选择配方时误操作。说明按钮始终位于顶栏，不占用底部工具栏。',
      body: function () { return keyCards() + grid([
        section('面板规则', '<p>建筑与血清面板打开时，世界时间、氧气和敌人都会暂停。按 <kbd>Esc</kbd> 会优先关闭当前面板；没有面板时才打开暂停。</p>'),
        section('保存规则', '<p>按 <kbd>P</kbd> 或确认建造、换日、页面隐藏和刷新时会更新自动存档；标题页“继续”读取它。顶栏“存档”可打开存档管理：自动存档加三个独立手动档位，每格显示保存时间、天数和建筑数量；手动档位可按“改名”设置独立名称，覆盖保存与读取后仍保留。选择读取前会要求确认，避免覆盖未保存改动。存档保存在当前浏览器和当前本地文件路径的 localStorage 中。</p>'),
        section('手册维护约定', '<p>新增或修改玩法时，必须同步更新本手册的对应页面、建筑卡用途和 <code>docs/HTML5_PROTOTYPE.md</code>；验收结果则记录在 <code>docs/HTML5_VERIFICATION.md</code>。</p>')
      ]); }
    }
  ];

  function render(index) {
    var page = pages[index];
    if (!page) return '';
    return '<article class="manual-page"><h3 class="manual-page-title">' + page.title + '</h3><p class="manual-page-lead">' + page.lead + '</p>' + page.body() + '</article>';
  }

  SA.Guide = { pages: pages, render: render };
}(window.StarAbyss = window.StarAbyss || {}));
