# 元婴测试实验室 TEST-LAB-R1

仅测试入口 `/test-lab.html`（同源转到 `/star-abyss.html?testLab=1`）启用。普通入口没有测试面板，不自动初始化元婴，也不访问测试存档。实验室自动开始/恢复独立测试档。

## 真实数据与可测范围

- 依据 `docs/cultivation/01_REALMS_AND_CULTIVATION.md`，元婴为 R4。用 `d3-combat.computeAttributes({realm:4,level:1})` 初始化真实 expedition actor：生命 155520、攻击 15552、防御 12960、真气 1600。不是 HUD 标签覆盖。
- 初始化仅作用于新测试 root；恢复保留实际生命、材料、敌人死亡、掉落、事务与检查点。用原 `createExpeditionRuntime`、`createSession` 和 IndexedDB 原子写入。
- 全新测试root在加载遮罩期间通过原runtime.tick运行18秒导演准备，产生真实spawn/检查点事务。仅该准备阶段把可见性视为遮罩不可见，保留原地形、可达性、保护区和距离判定。恢复档不重复生成；采集/战斗入口选择runtime中实际存在且未耗尽/存活的对象，缺少时说明原因，不跳到假目标。
- 预热await契约：每个50ms tick后等待 `runtime.busy === false` 才继续，最后await真实checkpoint成功。资源/actor不直接注入；每次spawn由原事务按generation幂等。只接受test-lab世界，玩家保持在保护营地；完成的root（simTime≥17.9）直接跳过。未完成/失败可用原“重试”重新打开同一link/root续做一轮，原director不重复生成已存在实例；事务错误中止准备，epoch失效立即退出。主控异步worker必须在提交/回调结束前保持busy=true，destroy应终止worker并关闭DB连接。
- 原调查全旗标、真实高空装备 progression（四份连续生态调查 + commissioned）、已修勘探车可用。元婴正式设计御器200m；高空/轨道明确为额外测试权限。
- 出生星现有盆地、平原、森林、湿地、海岸、海洋实景及四个盆地外勤区域可跳转。观景跳转默认离地30m并测试停悬，落地需要真实渲染支撑、非深水及 sweep 检查；返营优先寻找可站立的安全位置。
- 连续升空/下降仍使用原 planetRuntime.step。模拟速率0.25/1/2/4倍使用不超过50ms子步，不跨过碰撞检测；停悬是明确的测试冻结飞行位置功能，不宣称正式飞行能力。观景跳转后选择“恢复键盘飞行”使用原G/WASD控制。
- 战斗/采集/背包/仓储使用原入口：R攻击、H采集拾取、I背包、营地存取。元婴属性会快速击杀后天敌人，前摇、命中、尸体掉落规则不变。远方生境没有接入盆地战斗与仓储，面板明确说明。其他星球、宗门、御剑技能、宠物、跨星传送未伪造。

## 存档隔离

- localStorage 唯一键 `star-abyss-test-lab-v1`。
- IndexedDB 唯一数据库 `star-abyss-test-lab-expedition-v1`；通过现成 `openStorage` 参数注入，不修改 expedition-runtime。
- 主控性能集成需要worker时，同时传 `checkpointStorageName: TEST_LAB.db`；普通入口不传该参数，保留runtime默认。此树基线runtime未实现worker参数（会忽略额外参数），worker整合后的关闭/隔离由主控再复验。
- worldId/playerId 强制 `test-lab:` 前缀，拒绝正式ID。恢复也不会导入正式 link。
- 重置先关闭测试 runtime，关闭保存（screen=menu），只删除上述测试数据库和键，再刷新。不会调用 localStorage.clear，也不会枚举删除其他数据库；删除被其他标签页阻塞时保留键并显示原因，可关闭其他测试标签后重试。
- 独立入口资源均为同源相对路径；正式入口链接丢弃测试参数。

## 主控接入

只复制 SHA 清单所列交付文件，不覆盖本树同步来的源文件、资源、package文件或 `main.mjs`。主控自己接线。

`tools/test-lab-integrate.cjs` 包含逐条唯一字符串锚点变换；`docs/test-lab/main-integration.json` 是同一精确before/after清单。脚本全部锚点通过后才写main，对变动后的主控main若锚点不匹配会停止，不会部分写入。运行目录必须是要验收的隔离工作树。

接线位置：顶层导入lab/storage；读取存档前决定labMode及独立key；attachExpedition分支生成测试link并注入openStorage/独立checkpointStorageName；newGame初始planet reset后seed；control gate与simulate暂停条件包含labPanelOpen；三处planet.step改为labPlanetStep；启动处创建面板适配器并仅在labMode自动continueGame。面板打开且非加载中、sceneDirty=false时停止重复绘制；afterMove和attachExpedition完成时唤醒sceneDirty，不冻结资源加载。

## 验证步骤

1. `node --test playable/tests/test-lab.test.mjs`：境界公式/真实采集击杀提交/存储命名空间/重置失败边界。
2. `npm run build`：构建主控接线后的bundle。
3. 使用专属端口4188：cmd设置 `PORT=4188` 后运行 `node playable/tests/static-server.js`，禁止使用正式4173。
4. `node tools/test-lab-browser.cjs`：实际浏览器独立上下文，正式LS/IDB哨兵、逐生境跳转、飞行、真实背包、刷新与重置；输出browser-report.json及截图。
5. 人工进入test-lab.html，收起面板，实际WASD/G/F/R/H/I；右侧按钮或F2打开面板，滚动可见所有功能，Esc/F2关闭。鼠标被游戏捕获时用F2打开，安全释放捕获且不进入暂停。面板以原生dialog管理焦点，打开期间冻结玩法；1024×768及1440×900检查中文与按钮。

首次冷启动等待现有生物资源，加载完成前面板拒绝玩法修改；测试不绕过资源就绪门槛。
`labPreparing` 只在 `waitForWorldAssets` 已成功且runtime已创建后开启；此阶段暂停重复世界绘制，独立await循环与onChange刷新DOM继续运行，避免同步WebGL绘制挤占事务准备。准备结束/失败都会清除标记并唤醒sceneDirty；不冻结尚未完成的asset加载。

## 各地图当前内容（出生星的生境，不是六颗星球）

|入口|当前真实对象/地表|可测玩法边界|
|---|---|---|
|裂环盆地|原6公里盆地地形、岩谷、营地、坠舰、调查点、勘探车及现有外勤对象|原调查完成后自由探索；驾驶、战斗、材料采集、背包、营地仓储|
|长风平原|球面连续地形与平原/山麓材质|地形/地面支撑、导航、飞行、行星调查；不额外生成盆地战斗对象|
|河谷森林|连续地形、森林材质、现有树木生态模型（按坡度/陆地/LOD条件分布）|观景、树干碰撞、导航、飞行、原行星采样|
|浅滩湿地|湿地地形、水面、现有芦苇生态模型（按坡度/水深/LOD条件分布）|观景、浅滩/深水安全落地约束、飞行、原行星采样|
|潮汐海岸|岸线、水面、现有卵石生态细节（条件分布）|观景、岸线支撑、飞行、原行星采样|
|深蓝海洋|真实球面海面与海底地形场|海上飞行/观景；拒绝落到无陆地支撑的深水，不提供虚构游泳/海底战斗|
|背面/南北极|同一真实球面的对应坐标与当前种子地形|全球坐标与观景飞行；不宣称新的独立地图内容|
|四个外勤区域|营地东侧陨落带、断环外缘矿脉、镜阵月露洼地、石柱南侧碎晶坡；各自真实材料点与领地掠兽|只在盆地原session内测战斗/掉落/拾取与材料采集；回营存取物资|

本任务未创建或替换3D资产，复用SUPPORT-TERRITORY-R1现有内容。生态按距离与海拔卸载，高空观景不能据此误判地表物件不存在。
