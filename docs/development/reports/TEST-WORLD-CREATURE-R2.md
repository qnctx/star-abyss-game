# TEST-WORLD-CREATURE-R2 — FAIL（限定注入 loader 结构防御契约）

2026-09-13 开始，独立树 `C:/Users/HUAWEI/.codex/worktrees/9663/star-abyss-game`。只测试、不修产品、不付费、不提交、不改主游戏。报告及全部本轮证据由 `artifacts/tests/TEST-WORLD-CREATURE-R2/manifest.json` 覆盖 SHA256。

**R1 的 F1/F2 已独立复现并确认修复；F3 在本轮营地原生正反侧低视角和四地形几何范围内确认修复。完整承诺验收为 FAIL，仅因新增 B14：公开注入 loader 的有限错误逆绑定矩阵仍被放行为 ready。没有证据表明默认 main + 冻结 SHA 正常生产路径会加载该损坏状态。** 未将此结果扩大为正常冻结资产损坏或业务加载门阻断。

## 冻结与装载

唯一受测 WORLD 源是控制树 c0e3 的 `artifacts/deliveries/WORLD-CREATURE-R2`。version SHA256 为 `7dc36442a60761f23dc34573451c2d82c2d320a4d91a89051be8c2d5e9aa91f9`，31 清单文件全部匹配。只安装九 productPaths。GLB SHA 为 `39c6cc6ddafd84f9d269026618dec68f69eb6038bbd7810245a3376f22caf879`，rig-map 为 `8f6e54542099eec8554d56c68c32cea06a8509e8be6ff359aed7e160636b5ff5`，与 CREATURE-ART-V1 一致。

`setup.cjs` 参考 R1 独立装载脚本，复制冻结 ORIGINAL-BASE-R1 187 文件，按准确产品路径叠加 DEV-I-R3、UI-R3、WORLD-R3、CORE-R2，再叠加本 R2。最终 204 基础/产品路径，六套冻结源共360条。开发测试与预览单列辅助文件；没有取开发活动 main/runtime。Three r180 / Node v22.14.0 依赖只读来自原项目 node_modules；预览原角色非怪物媒体沿用原项目只读文件，不冒称本轮新资产。

结束 `final-integrity.json`：360冻结条目、204受测路径、CREATURE-ART-V1 39条、主R1旧证据259条全部复核，错误0。主R1报告 SHA 仍为 `03e20d00799c8a9c47ee36d7459783c2e2463dc168e20ede12bc540029c27df4`。两个4243资产URL均HTTP200、9,029,072字节且SHA匹配。旧开发图和R1图未计本轮复测。

## 新发现 B14：有限但不一致的 inverse-bind 未被结构校验拒绝

分级：**P2，注入 loader 契约缺陷**；默认生产路径不可达性边界明确保留。

`sandbox/bind-detail.mjs` 正常解析本版真实GLB，保留全部43002顶点/20骨/父链/权重，只在返回给公开 `createExpeditionWorld({loadAsset})` 前，把 LH_Lower 的 `skeleton.boneInverses[3].elements[13]` 从0.0472867787加2至2.0472867787。矩阵仍有限，可逆，行列式1.0000000797。无初始view时 `await ready` 返回ready/4；首次idle update不抛，后续状态仍ready。对正常同位置同姿态全部顶点比较，最大偏移 **1.6681736603m**，1818点偏移超过1cm。原始矩阵、状态、影响见 `bind-detail.json`。这是针对实际绑定数据的一处有限损坏，不是无限随机输入测试。

契约依据：冻结开发报告F1明确写“在无初始view时也完整检查…逆绑定矩阵…完成后才能ready”，以及“测试注入也必须经过结构校验”。`index.mjs` 导出的构造参数公开接受loadAsset；`creature-asset.mjs` 将该结果送入同一结构校验。`creature-validation.mjs` 对矩阵仅检查数量、有限和非奇异，没有核对绑定姿态一致性。因而这项结果不满足所声明的有限结构防御承诺。

可达性限制：未发现冻结main使用自定义loader；默认fetch路径先校验固定长度/SHA后由GLTFLoader解析。修改GLB字节会被SHA拒绝，本测试不绕过正常生产SHA去宣称默认路径损坏。注入loader测试故意把“传输完整性”与“解码后结构防御”分开；如果产品仅承诺受信loader，则可以收窄文档承诺，但当前冻结报告明确包含测试注入。已向主控早报，并继续同版必要检查；未切换开发修复。

## 独立结果

| 检查 | 结果 / 本版证据 |
|---|---|
| F1 缺Chest无view | PASS。真实解析后重命名Chest，ready failed，首次update不抛，状态保持failed，未开render实例。`independent-results.json` I03。 |
| F2 缺LF_Upper | PASS。failed前无visual/contact遗留；retry后每anchor恰一个visual和一个contact，4实例。`independent-results.json` I03b。 |
| 独立10种额外结构边界 | PASS。重复Chest、Sole_RH错误父节点、Tail02错误父链、非有限POSITION、负权重、权重总和0、越界三角索引、真实LF足底顶点绑定错误骨、重复skin成员、缺UV：无view failed、源geometry一次释放、空anchors、retry四实例且anchor身份不变。`boundary-results.json`。 |
| B14 有限错误逆绑定 | FAIL，仅上述注入路径。`boundary-results.json` 与 `bind-detail.json`。 |
| 字节/传输 | PASS。正确SHA接受、截短长度拒绝、同长度改字节SHA拒绝。结构变体用loader注入，不把SHA拒绝误算结构测试通过。 |
| staging第四实例失败 | PASS。最新view指向第四站，第四实例首次求解抛错；4私有骨架+1源骨架、20片contact geometry全部dispose，无anchor children，retry恰四实例。`boundary-results.json`。 |
| 并发retry/最新view | PASS。第一次同步loader失败后32个retry共用新promise，总loader调用2；loading中hurt被后来的dead覆盖，ready应用最新view；状态快照冻结。I01。 |
| 销毁迟到/共享释放 | PASS。disposed后迟到GLB不挂入场景，geometry/material/texture/Image.close各一次；未宣称取消底层网络。I02。 |
| 实例共享隔离/LOD换代 | PASS。四实例共享geometry/material，20骨每实例独立；100次LOD出入和40次身份换代保持mesh/skeleton/contact分配，换代不继承旧死亡姿态。I04。 |
| 真实三角面/实际蒙皮 | PASS。独立建立原6000/260 PlaneGeometry并使用其索引三角重心插值；4地点×新yaw .43/1.79/3.37/5.93，80普通姿态共320足底，112死亡/恢复全43002蒙皮顶点姿态（含角尾）。死亡时间步 .027/.113/.377/1.931，恢复1.948/2.039/2.401。I05。 |
| 足底/整尸测量 | 普通支撑足最低净空 -0.701～+0.126mm；整尸最低 -9.63e-9～3.85e-7m。直接getVertexPosition，不以bind POSITION代替。普通姿态无全网格扫描；稳定尸体缓存命中、yaw变化重新43002扫描。 |
| 接触阴影 | PASS限定接触语义。121时间点共240摆脚/244站立脚；明显摆脚隐藏面片，站立脚净空<3mm。面片透明、无depthWrite、renderOrder=1，49顶点地形+7mm，误差<10µm。`contact-extra.json`、B-swing。不声称所有透明排序场景通过。 |
| 原静态碰撞/权威只读 | PASS。4800采样、.42/.65/1.1半径、门两状态，与原collidesAtHeight一致；墙中心、门开闭、原岩中心检查。`static-extra.json`。原路线和墙门岩射线开发回归通过。 |

开发20项仅作回归。首次19/20有一项因测试证据输出目录不存在而ENOENT；创建目录后原文件不变完整20/20通过，原始和重跑TAP均保留。新增边界脚本首次亦修正两处测试器错误：anchor身份应在world.dispose前断言；足底变体应从rig-map选择真实足底索引，不能猜顶点336。错误版脚本/结果单列 `boundaries-harness-error.mjs` / `boundary-results-harness-error.json`，不判产品。最终额外边界13 PASS/1 FAIL。

## F3 本版原生视觉与支撑

使用computer-use技能和专用cua_repl，显式创建自有后台IAB `visible:false`，端口4243/tab1。原生开始调查前选择“仅表现样本 · idle”，暂停战斗业务。实际步行 `=` / `W` 停步、鼠标拖动、C/Z低视点、V切视角、L灯开关。未用CDP、dispatchEvent、写坐标/时钟或内部advance。没有操作别的任务页，没有设viewport覆盖。

路线记录：0/190→0/85；向东步行至251/86（工具工作期间自动步行造成超程，符合已发送的=），转西回109/86→87/86，转东近身到97/86。所有后续截图位置97/86稳定，采样HP120，未出现R1那类无法解释的位移/死亡或视口干扰。未把=自动步行的超程算产品缺陷。

本版营地西侧 `native-dead-side-low-lamp-on/off.png` 与东侧近处 `native-dead-reverse-low-close.png`、`native-dead-ground-stable.png`、`native-dead-reverse-low-lamp-off.png`：腿已明显屈曲收向腹部，躯干随侧滚落低，不再由伸展下侧脚托住整躯干。背甲、肩与髋的侧卧轮廓连续。低视角可见上侧腿/腹侧局部间隙，未将正常侧卧上侧腿离地判失败。极近图部分idle身体超出视野是取景过近，不作为UI裁切缺陷；`native-recovered-third-person.png` 提供整体恢复站姿。

`native-death-0..7.png`、`native-recovery-0..7.png` 与对应JSON记录真实墙钟/页面只读stats，观察到收腿侧滚和反向恢复；快速选择后的第一张可能仍是起始姿态，稳定图才用于最终形态判读。姿态样本不等于真实击杀或实际追击位移，短chase六帧也不能证明7.8m/s真实追击无脚滑。

`corpse-extra.json` 对四站×三个新yaw再次测全顶点，并按最大权重骨做描述分区。Pelvis区域最低约1.93～5.00cm，Spine区域约8.86～10.26cm；这类区域标记不是皮肤解剖边界，也不要求每片躯干完全压地。结合原生正反侧低视图，R1“站姿横倒/伸腿托高”判定已消除。**没有以全模型最低点为0或人为P10阈值作为F3单独通过依据。** 四站均有几何检查，原生步行视觉只覆盖营地，不声称走到其余三站或完成全地形美术验收。

已直接查看CREATURE-ART-V1概念图；本版模型保留双角、叠层背甲、长尾、四足爪形。原肩灯下甲片灰白洗亮但层片/关节仍可辨，关灯时暗甲与暗部边界可见；没有改灯、贴图或全局阴影。接触影偏淡是既定边界，不能拿影子掩盖几何。最终浏览器ready为4实例/43002顶点/35967三角/20骨，error/warn日志为空。

## 测量、复跑、清理

最终I06本机Node CPU采样（浏览器同时开着，非隔离基准）：120帧四实例chase中位4.857ms/P95 6.775ms；四只首次尸体总 **79.067ms**，每只43002全顶点；稳定每只0全顶点且cacheHits=1。当前机器采样高于开发约50ms，保留实测，未据此推导全平台失败或GPU帧率。Node跳过图像解码；浏览器真实PBR纹理另有原生截图。没有低端GPU或长时间运行认证。

在本证据sandbox复跑：

```text
node --test playable/tests/expedition-world.test.js playable/tests/world-creature.test.mjs playable/tests/creature-loading-r2.test.mjs
node independent.mjs
node boundaries.mjs
node bind-detail.mjs
node contact-extra.mjs
node corpse-extra.mjs
node static-extra.mjs
```

预期开发20通过；independent 7通过；boundaries 13通过/finiteWrongBind失败（退出码1）；其余输出本版测量。复跑开发用例前需创建 `playable/src/expedition-world/evidence/creature-r2`。测试装载、脚本、原始TAP/JSON、全部本版截图及报告均在manifest中，不沿用旧测试结果。

已关闭自有tab1，仅对自有服务session90549/4243发送Ctrl-C，退出完成；没有触及4173/4214/4217或其他页面。冻结源、旧证据、受测产品最终SHA全部一致。无主游戏修改，无提交。

真实击杀、命中/奖励/拾取、根存档重载、CORE新加载门均未由fixture验收；这些保持独立业务边界。最终 **FAIL仅限定B14公开注入路径的结构防御承诺**，正常冻结资产和R1三项修复在上述覆盖范围内通过。
