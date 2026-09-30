# DEV-D1-R2 · 修复 TEST-D1-R1 的墙侧寻路与空资源提示

2026-09-12。R2开发修复交付，等待总控冻结后另建全新 **TEST-D1-R2**。开发回归 **13/13**；原独立Node用例原样重放 **9/9**（修复前复现8/9）；真实浏览器完成下表操作。**这是开发证据，不代替新任务的独立验收。**

## R2 范围与修复

- 来源：主项目 `docs/development/reports/TEST-D1-R1.md`，独立证据 `artifacts/tests/TEST-D1-R1/`。F01为P2阻断项，F02为P3。本次只改本D自有目录、自有测试与本报告。
- F01：旧AI每帧用敌人位于墙中心哪侧来反转目标，造成墙侧振荡。新增 `navigation.mjs`，对扩张碰撞半径后的岩墙角点建立确定性可见路径，选取最短可达路径的下一点；保留原0.15米每步上限、扫掠碰撞、演员阻挡与保护圈。路径由已保存姿态推导，不向I白名单添加字段，不直接写HP或根。玩家在保护圈内时敌人停止追踪，伤害授权仍拒绝圈内攻击。
- F02：新增 `SceneGame.interaction()`，HUD和实际F共用距离、遮挡、当前资源实例及源容器剩余实物判断。最后一份后显示“青蕨草已采尽”或“战利品已取尽”，不再继续显示可采/可拾的F提示。空操作只记录状态，不转移或生成物资。
- 入口新增 `serve-r2.cjs` / `start-r2.cmd`，默认4182、默认世界 `D1-expedition-R2`；原生日志仅写 `evidence-r2/`。没有修改A-R2/B-R1/C-R2/I-R2九个依赖，没有改旧主游戏或构建旧包。

## R2 验证与复现步骤

在本工作区用cmd运行：

```bat
node --test playable/tests/d3-scene.test.js
node playable/src/d3-scene/r2-tools.cjs independent
node playable/src/d3-scene/check-r2.cjs
node playable/src/d3-scene/r2-tools.cjs audit
node playable/src/d3-scene/serve-r2.cjs
```

开发13项包括原10项以及新增三项：四组墙侧固定站位在原400×0.05秒限制内受击、期间重载及逐步碰撞断言；草药采尽/重载/返回/重复F；真实击杀后尸体取尽/重载/返回/重复F。原独立9项仅把import路径指向当前D模块，没有删断言、改超时或变更测试站位；源SHA与替换说明在 `evidence-r2/independent-provenance.json`，修复前失败在 `baseline-independent-r1.tap`，修复后在 `independent-r1.tap`。

实际浏览器从新世界用键盘WASD步行、空格攻击、F交互和鼠标按钮完成；观察仅从DOM读取权威快照，没有调用游戏内部方法、设置位置/生命或导入伪造战斗存档。暂停保存后按50k字符分块读取JSON，避免工具截断或数值对象转传舍入。证据下列文件均位于 `playable/src/d3-scene/evidence-r2/`，截图与JSON同名。

|实操|结果|证据前缀|
|---|---|---|
|新世界走到墙前中央|玩家(0,-7.4894)，掠兽实际绕左侧接近，HP120→57|browser-wall-center|
|墙右侧原地等待|位置(2.7972,-7.4894)不变，2.9666模拟秒，HP48→39|browser-wall-right-before/after|
|墙左侧原地等待|位置(-6.3007,-7.0204)不变，3.7664模拟秒，HP57→48|browser-wall-left-before/after|
|另建新世界实际走向原报告站位|位置(1.9803,-7.4978)不变，4.2998模拟秒，HP111→93，敌从墙右侧接近|browser-original-station-before/after|
|草药最后一份|F采3份后显示已采尽，包草3，耗尽事件1|browser-herb-before/empty|
|实际刷新、离开、返回、重复F三次|刷新完整根一致，离开无采集提示，返回显示已采尽，库存/事件/director/drops不变|browser-herb-reload/away/revisit-repeat|
|空背包实际击杀|有效三次断浪斩20/20/8，敌0，死亡事件1，真实血液2|browser-corpse-before|
|最后一份战利品及实际刷新/离开/返回/重复F|包血2，已取尽提示，刷新完整根一致，重复交互库存/事件/director/drops不变|browser-corpse-empty/reload/away/revisit-repeat|

精确原报告玩家坐标(1.9690999999998169,-7.531399999999913)、敌(4.29,-9.01)在新增Node中固定复现；浏览器最近站位距报告约3.5厘米，未声称两个角色浮点坐标完全重合。左侧浏览器证据在墙外侧，墙前左侧(-2.05,-7.53)及前中(0,-7.53)的20秒固定追击另由Node覆盖。浏览器按键步进受帧率影响，以保存坐标和模拟时间为准，没有放宽独立400ticks断言。

`check-r2.cjs`只读检查上述JSON：三组等待均位置逐字段相同、20秒内掉血；中央站位受击；草药/尸体各自刷新完整根严格一致、返回重复F的库存/事件/导演/掉落严格一致。结果在 `browser-checks.json`。提示文字由实际选择器等待及PNG验证。全部Node及JSON证据断言通过，未重新宣称R1所有浏览器功能在R2逐项复测；同档救援、满包回滚等原10项Node仍通过。

## R2 冻结与交接

- R2清单：`playable/src/d3-scene/version-r2.json`。包含当前自有文件、测试、报告、新证据、保留的旧证据及9依赖/Three哈希；不自哈希。启动只用 `start-r2.cmd` 或 `serve-r2.cjs`。
- R1完整源代码、测试、报告和证据冻结在 `C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-D1-R1`，47自有文件+9依赖全量校验。R1清单SHA仍为 `7a12281c3e284986a3ccccbd31fdc06b52f3e6798df83add8b59d5523cb285eb`。
- 本地原 `version.json`、`runtime.json`、`evidence/`逐字未动；审计结果 `evidence-r2/r1-unchanged.json`。原R1清单描述冻结副本，不能拿它验证已经修复的当前model/app/test/report。原 `verify.cjs` / `serve.cjs`为历史保留，不应在本R2交付中运行，以免写入旧证据目录。
- 本轮所有实现与证据均冻结后交回总控；请另建全新TEST-D1-R2实际验收F01、F02及关键旧闭环。当前未接入主入口，未做D2或E。

---

# 以下为 R1 历史交付记录（R1独立验收已失败；当前结论以上述R2记录为准）

# DEV-D1-R1 · R0真实3D战斗、材料与背包

2026-09-12。开发交付完成并冻结，等待总控另建全新TEST-D1独立实操验收。**开发Node 10/10；已实际浏览器操作战斗、战败同档救援、有限采收、满包拒绝、存箱后拾取、刷新与碰撞。开发自测不等于独立通过，也不代表嵌入原主游戏。**

## 身份、范围与来源

- 正式任务：`01a094f4-f011-7893-b92b-4005f9a918c8`；总控：`01a094be-fe94-7c23-9b24-13f777c81d8d`。
- 工作区：`C:/Users/HUAWEI/.codex/worktrees/b53c/star-abyss-game`；detached HEAD，基线 `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`。交付为未提交文件，基线本身不表示版本。
- 已读权威主项目CONTROL的D1全文及后续I-R2协调、TASKS、DEV-A/B/C/I与TEST-I-R1/TEST-I-R2；cultivation07/19/20/27；实际全局 `C:/Users/HUAWEI/.codex/AGENTS.md`。使用精确搜索与局部源码，未建立CodeGraph索引。
- 只新增自有 `playable/src/d3-scene/`、`playable/tests/d3-scene.test.js`、本报告；9个模块文件仅按主项目集成清单复制/核验为只读依赖。没有改主目录、main/input/camera/package/game.js、公共资产或A/B/C/I实现，没有构建旧包、收费生成、密钥读取、提交或推送。

## 交付文件、版本与哈希

|文件（playable/src/d3-scene/内）|作用|
|---|---|
|model.mjs|场景几何/扫掠碰撞、C空间查询、真实授权、AI与攻击时序、根execute适配|
|app.mjs、index.html、scene.css|Three场景、实际键鼠操作、中文HUD、库存/错误/日志与权威根观察|
|serve.cjs、start.cmd|独立本地HTTP入口|
|dependencies.cjs、dependencies.json|集成清单来源及逐文件SHA核验|
|runtime.json|Three路径、包版本文件与SHA-256|
|verify.cjs、check-evidence.cjs|Node自测/冻结、只读验证真实浏览器证据|
|evidence/|JSON、TAP、真实截图，逐文件见version.json|
|version.json|全部自有文件相对路径、字节、SHA-256及9依赖和Three哈希；清单不自哈希|

另有 `playable/tests/d3-scene.test.js` 和本报告，二者哈希均在version.json。冻结后不继续改实现、测试或已保存证据。

最终依赖 **A-R2/B-R1/C-R2/I-R2**。只读文件为d3-combat/{fixed,index}.mjs、d3-inventory/index.mjs、world-director/{definitions,director,rng}.mjs、d3-session/{index,indexeddb,scene}.mjs，所有逐文件哈希见dependencies.json及version.json。

I-R2经全新TEST-I-R2通过、总控集成后才接线，来源 `E:/myProject/star-abyss-game/docs/development/versions/INTEGRATED-I-R2.json`。替换本地I-R1前确认旧哈希一致，未覆盖未知改动。关键最终SHA：

- I index：`ef2a19df4ee209864cf318df0e87b6e36673ef14f8cc3913362bfed879e0c687`
- I scene：`f7d5c9a1fd5d5a9075a5d064af65c032f4db08e818a6dabbead02fbeb430a0a2`
- I IndexedDB：`60e180a2e4485b567b99c4cd42d7b65f2fc75b8b6fcbd65007620cf217236309`

Three **0.180.0** 只读使用 `E:/myProject/star-abyss-game/node_modules/three/build/three.module.js` 与 `three.core.js`；package.json仅核对版本/哈希。三文件SHA见runtime.json。人物、刀、掠兽、草药、箱、岩墙和树均为自有代码创建的三维几何，无额外模型/贴图文件、无整仓复制。

## 可玩的范围与实际按键

R0平地试炼：玩家HP120/攻击12/物防10/电容100；一只HP48/物防2/攻击12的掠兽；固定Q1青蕨草3份；敌人固定Q1血液2份，只由I在真实HP0死亡事务中创建实物。

- 点击“继续”后WASD移动；左右箭头转向、上下箭头俯仰；拖动鼠标调整视角。
- 空格或左键断浪斩样板：A使用WS01的6/1.3/0预算，前摇0.35秒、有效窗口0.2秒、后摇0.4秒、CD5秒、电容6、3米/100度扇形。方向起手固定，命中时重查距离与遮挡。没有按钮直接扣敌血。
- 掠兽真实绕墙接近、0.8秒蓄力、近距攻击、受击闪色、死亡翻倒。攻击走A普通物理攻击；玩家物防10时实际失血9，末击只扣剩余生命。
- F每次采一份、拾一份，或靠近蓝色箱存一份。背包2格/300毫升/300克，每份100毫升/100克；箱容量也有限。所有物资走B transfer与I根事务。箱当前仅提供存放交互，未提供取回菜单。
- P暂停保存，V切第一/第三视角；按钮可重载、救援、保存验证日志。V模式是页面显示偏好，刷新回第三视角；实际位置/yaw/pitch同根保存。
- 青色营地圈半径3.5米，敌人不能进入，圈内双方不结算攻击。玩家真实HP0后点击救援，同worldId/playerId回(0,12)，HP/电容恢复，保留库存、敌人伤势、资源、尸体与历史；不是新建试炼替代救援。

这是可玩白盒，未做加工、宠物、完整WS01削韧/成长、完整掉落概率、自动换代、精美骨骼动画或完整装备经济。第一视角已切换和转向，本轮实战伤害在第三视角；未把第一视角整场实战或旧游戏全部功能算通过。

## API、根数据与授权边界

model.mjs导出PLAYER/WALLS/POINTS/SAFE/WS01/BITE/definitions，distance/normalizeYaw/free/lineClear/move/inArc/initialScene/spatial/materialize/makeRoot及SceneGame。SceneGame提供initialize/load/tick/attack/interact/checkpoint/rescue，actor/pos/alive供视图观察；内部session为真实I.createSession。

1. 初始化只用I.createRoot和真实IDB.initialize，已有worldId不覆盖。初始无奖励库存；两次I.spawn使用C实际instance/member ID创建有限资源与敌人。若spawn成功而映射checkpoint前中断，只按保存的C成员ID和创作出生点恢复缺失映射，不重生成C实例或奖励。
2. scene严格为I-R2白名单的version/time/player/enemies/pending/cooldowns/hurt/logs；敌人键为实际C成员ID，AI表现由位置、A HP、pending/hurt派生。所有cast/hit/transfer/spawn附scene；checkpoint与rescue也只走I.execute。**没有D自有CAS写根或直接修改A HP。**
3. 施放同根保存committed pending；命中同根保存resolved pending。只有提交返回/权威load后的A HP与库存驱动已确认结果。A exact、casts/hits与子状态原样经I保存，不拆出旧子态独立回写。
4. 授权读取当前真实场景与同revision根：存活、保存的施放、前摇/有效窗、起手方向、扇形距离、岩墙、保护圈、交互距离与源容器。未知动作、越时、背后/远距/穿墙/死目标拒绝；UI不能传任意伤害数值。
5. spatial读取实际创作落点、玩家位置/视向、岩墙、活动成员占用、尸体实物余量、保护圈和预算。地形是明确可绕行的连通平地，free检查边界和矩形障碍，不是全true适配。C首次生成亦查45米、可见性与占用。本片不自动补下一代，耗尽/死亡令牌保留。
6. 模拟dt最多0.05秒；保存及暂停不推进模拟。纯移动/视向每0.5模拟秒checkpoint，业务立即提交，暂停补一次保存。突然刷新未完成的纯移动回到最近已提交checkpoint；完整一致证明针对明确暂停保存后的根，未声称浏览器强杀能保存未提交帧。
7. 异常后权威load恢复scene并显示错误，不补写旧子态。满包volumeFull保留原物，存箱后可再取。D的故障传播/全根回滚由Node内存CAS注入失败验证；真实IDB abort另由已验收I-R2证明，本轮未在D页面人工注入IDB abort。
8. 单机可信执行范围，不宣称防开发者工具任意篡改内存/存档；未承诺跨设备/进程安全、坏档迁移或长运行账本回收。

## 实际命令与结果

cwd为本报告工作区；cmd.exe、Node v22.14.0。

```bat
node playable/src/d3-scene/dependencies.cjs
node --test playable/tests/d3-scene.test.js
node playable/src/d3-scene/verify.cjs --integration
node playable/src/d3-scene/check-evidence.cjs
node playable/src/d3-scene/serve.cjs
```

依赖9/9 SHA一致；最终Node **10 tests / 10 pass / 0 fail / 0 skipped**，集成组默认执行。七项空间/授权测试覆盖扫掠防穿墙、侧路、扇形/距离/遮挡、真实C查询、有限初始根、演员占用、保护圈、前摇/有效窗口/死亡目标；三项集成组用真实A/B/C/I与显式内存CAS，验证部分/最终采收、失败回滚、存箱/重载、绕墙AI、20/20/8伤害、一次死亡、满包尸体、真实玩家死亡/同根救援、旧施放中断。内存测试不冒充IDB。

model/app/serve执行node --check退出0；git diff --check退出0，但新增未跟踪文件不在其覆盖内。TAP/退出结果见evidence/node-tests.tap、node-result.json；check-evidence只读解析全部JSON并重新断言浏览器前后根。

最终 `node playable/src/d3-scene/verify.cjs --integration --freeze` 再跑Node并生成version.json。冻结后独立测试应在自己的目录保存结果，直接node --test不会写本交付；勿在冻结副本运行会改证据的verify或原开发POST。

## HTTP入口与真实浏览器步骤

实际服务 **http://127.0.0.1:4181/**，只绑定本机；也可运行playable/src/d3-scene/start.cmd。端口占用时在cmd先设置D1_PORT再启动；不同origin是不同IDB。数据库 `star-abyss-D1-v1`，最终默认worldId `D1-expedition-R1`。参数?world=独立测试ID可新建不覆盖旧档的测试世界，不是救援入口。

正式实操世界：http://127.0.0.1:4181/?world=D1-browser-final。使用CUA真实键盘、鼠标、按钮，未用evaluate调用战斗/改血/改包；观察只读DOM中的权威根。“保存验证日志”由页面原生POST完整操作记录。浏览器为Codex内置Chromium，UA见run JSON。

|实际操作|结果|evidence文件|
|---|---|---|
|WASD走近，F首次采收|余量3→2、包1、events0、quality1|02-final-partial.json/png|
|继续F两次|余量0、包草3、恰一resourceDepleted|03-depleted.json|
|9.5米空格起手，P暂停，真正tab.reload|电容100→94、敌48；前摇完整根逐字一致|04-windup.json/png、05-windup-refresh.json|
|继续模拟，远距落空、敌绕墙接近|原远距cast无命中；敌到1.9米，玩家每次失血9|run-1789207684365.json及完整A账|
|合法空格两次|48→28→8，实际每次20|06-first-hit.json/png、run记录revision122|
|真实被击至0|包草3保留，敌仍8|07-defeated.json/png|
|实际点击同档救援|同world/player，HP120/电容100；inventory/director/drops一致，旧casts全部中断，敌仍8|08-rescue-native.json、08-rescue.png|
|重新走近原敌并出保护圈空格|8→0，恰一次defeatCommitted、固定血液2；敌旧前摇不伤复活玩家|09-defeated-enemy.json/png|
|满包靠近F|volumeFull，366,264字符完整根不变，尸体血液仍2|10-full-pack.json/png|
|箱F两次，回尸体F两次|箱草2，包草1/血2，尸体实物清空|11-unloaded.json、12-collected.json/png|
|真正tab.reload|revision190、488,013字符完整根逐字一致；耗尽/死亡各1，敌0、尸体空|13-refresh.json/png|
|空尸体再F|总物资仍5、事件仍2，提示靠近有效对象|revision191，任务CUA输出|
|连续W至岩墙，再250次W|x=-1.743,z=-7.481前后不变，未越墙前界-7.55|14-wall.json/png|
|V第一视角、鼠标拖动，再V|位置不变，yaw0→1.8、pitch0.2→0.28|15-first-person.png及任务输出|
|640×768、768×768、1440×900|中文完整、主要按钮可见可点，侧栏可滚动|16-final-640.png、17-final-768.png、18-final-1440.png|

开发中的失败与修正如实保留：cmd node -e引号失败、Git Bash不可用，改自有cjs；初版相对CSS/JS 404补base后重载；I-R1缺checkpoint时unsupportedOperation并保持暂停，待独立通过I-R2后接线；默认quality3与Q1名不符，显式quality1后新建正式世界重做实操；一次等待选择器超时只记录实际距离，不冒称到达；后期DOM单字符串传输截断200k，改50k分块读取，并从页面原生完整导出恢复两份截断JSON。救援对象经工具传输时随机种子末位发生0.9677854813635349→0.9677854813635348改写，原08-rescue.json仅保留作工具传输记录；正式08-rescue-native.json直接从页面原生POST的revision126/128生成，并重新严格断言inventory/director/drops完全一致。所有最终JSON已解析、权威证明已重新断言，不用截断前缀或传输舍入作证。01-partial.png及ui-640-before-I2.png是早期准备证据，不作为最终闭环证明。

browser-console.json保存实际error/warn查询。未验证手机、浏览器进程强杀/配额耗尽、第一视角整场伤害、跨标签并发或旧主游戏操作。原扫描/闪避/趴卧/双视角/载具源码未改，不能把未触碰说成已实机回归。

## 交回总控和后续

请按version.json核对自有文件和9依赖，冻结明确版本后**另建全新TEST-D1**，实际操作战斗/战败救援/满包恢复/刷新/碰撞并留证。开发10/10及截图供定位，不当最终独立验收；TEST使用自己的服务/证据目录，勿改本交付。

主入口接线另立切片：对接现有输入/相机/角色与SceneGame，继续只经I.execute；C查询映射到真实主世界；检查原扫描/闪避/趴卧/载具路由及存档迁移，再独立实机验收。D2加工先补I.consume/加工事务及独立测试；同宠双模式E另派。本D停止扩展，不集成主游戏，不宣称D2/E完成。
