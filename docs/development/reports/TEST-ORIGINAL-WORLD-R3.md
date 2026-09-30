# TEST-ORIGINAL-WORLD-R3

结论：**PASS，限 WORLD 显示与静态查询范围**。R2 W01 蓄力足底穿地、W02 整尸悬空在本版独立重放中均已修复。不是 CORE 业务、AI、动态载具或整合版本通过；R2 历史结论仍为 FAIL。

## 唯一受测版本与隔离

独立树：`C:/Users/HUAWEI/.codex/worktrees/4c37/star-abyss-game`。冻结根：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries`。初始 tracked 干净，HEAD 见 initial-hashes.json；逐 SHA 验证 ORIGINAL-BASE-R1 的187文件与 DEV-ORIGINAL-WORLD-R3 的19文件后备份原 HEAD 文件并装入。没有把其他开发树当作集成源。

version-r3.json SHA256：`eb2fc0a93cf481ead76e4778d7fc7135feba8d6dd13cc415b621c82aae721547`。index：`1478c6864b7b5c1b840e96cbe4ee21aabb093ab338e5b55216cd18b56626d3bd`；definitions：`22113b8ab0ea745b1a9945f8dbfae71fe4e3e3bb28b99abdc96ad317d91894e7`；queries：`015bffc9abc81e153acc4f65b87ce2eb62e75344d535bad6442f837ea17c8100`。后两者与 R2 相同。

已读本版正式 DEV 报告及 `E:/myProject/star-abyss-game/docs/development/reports/TEST-ORIGINAL-WORLD-R2.md`，后者 SHA256 `ab0246a5e1478eb2d3a711a1bf142cf1e4c9d80a315908bfc497f335fd34c8ed` 验证一致。旧证据和脚本只读；复用的4项回归明确标在下文，不称新增独立测试。Three、原角色及装备只读依赖哈希见 readonly-dependencies.json。

## 独立几何验证

独立新脚本没有读取 hoof.userData.contact 作为判断依据。重建原 `PlaneGeometry(6000,6000,260,260)`，按原高度生成真实 Float32 顶点；从实际 index 建立三角空间索引，以真实三角顶点重心插值求接触。四地16点另以完整地形 mesh 的 Three Raycaster 交叉检查，误差小于1e-7m，并检查网格接缝两侧。模型测量使用全部真实 mesh 顶点及 matrixWorld，不以生产 terrainHeight 输出直接判通过。

336组姿态：4地点 × 原位置/偏移(7.29,-11.31) × 7朝向 × idle/patrol/chase/return/windup/dead；每组33个完整周期采样，共44,352次蹄测量。另精确重放 R2 的4地点×5朝向×time 0/0.17×windup/dead，共80组，营地旧失败坐标(95,87)包含在内。

| 检查 | 独立结果 |
| --- | --- |
| idle / windup 四蹄最低净空 | -0.0000000412 ~ +0.0000005355m；四脚均在±4cm |
| patrol / chase / return 蹄底 | -0.0000000418 ~ +0.0650005355m；每帧至少两脚在±4cm，摆脚上抬最多约6.5cm |
| dead 整尸最低顶点 | -0.0000000392 ~ +0.0000005305m；满足整尸±4cm，未要求侧卧全部蹄接地 |
| 腿部连接 | 真实腿段两个端点连接蹄心及 torso 坐标系的髋点，误差小于1e-6m |
| 移动坐标边界 | 四地各181帧，跨地形网格、变化 yaw 和 patrol→chase→return，最低接触与至少两脚支撑通过 |

死亡、恢复与连续性：4地×3朝向，每序列500帧，chase→windup→dead→idle，交替1/60、1/120、1/30秒。全模型每帧测量，首帧/过渡/稳定/恢复均无超过±4cm的最低点误差；最大绝对接触误差小于0.0000004m。view 深冻结或逐项冻结后传入，未写权威坐标、HP或集合。

补充连续性边界为4地×3朝向×3状态切换×6种dt。相同时间切换姿态无顶点瞬移；逐次减半dt到1/480，位移向零收敛。30fps倒地/恢复初段的极端顶点可移动约0.35993m；曾使用未经需求指定的0.35m固定阈值产生探索性失败，已在 exploratory-threshold.json 透明记录并用时间步收敛检查替代。这里通过的是无有限距离跳变，不评价倒地动作快慢的美术偏好。

LOD补充：敌人恰好360m与缺失两类离开，idle/windup/chase/dead四种重入，重入全顶点与全新当前快照完全相同；下一帧静态位移0、chase最大约1.058cm。另测时间倒退、替换instanceId快照可恢复当前尸体接触。未用可见首帧从旧姿态重放。invalid player/null集合不扩展为新契约。

## 回归与执行结果

开发冻结原测试11/11通过，仅作为回归。独立最终11/11通过，其中7项为本轮新验证（independent.mjs六项、continuity.mjs一项），4项由R2独立脚本复用并重跑（墙门、生命周期、岩石、状态边界）。合计22/22；开发11项没有替代新增验收。developer-tests.tap、independent-final.tap为最终日志。

回归覆盖：原墙门/道具实际3D盒射线及开闭门 LOS、无效坐标/半径拒绝；40块原静态岩石、80个真实渲染表面采样及穿岩 LOS；缺失隐藏、采尽残留、资源240/敌人360/掉落180m严格LOD；2000次不同掉落ID更替后几何/材质引用有界；两次dispose只释放一次且保留旁系scene对象。原岩石模块在本树由原源重新打包，不把R2旧编译产物当本版源。开发文档4 geometry/8 material仅核对，与本轮资源生命周期结论分开。

原开发测试会重写自身三角测量JSON，执行后已把运行输出另存 developer-triangle-measurements.json，并恢复本树该证据文件至冻结字节；产品源未编辑。

## 本版原游戏真实浏览器

专用 cua_repl、自有 `http://127.0.0.1:43273/playable/star-abyss.html`。最初 chrome 不可用，按工具返回选择本任务 in-app browser。没有私有CDP、evaluate改状态、派发输入事件、内部advance或设置人物位置。浏览器工具没有发出本轮停止指令。

served.json记录原 `./game.js?v=c2-idle-fix-20260909` 确实替换成 `/world-preview.js`，实际 DOM scripts 相同，canvas.dataset.worldModule=`expedition-world`，近处worldVisible=4。served bundle 22,847,888字节，SHA256 `05e3a0173246f6820bcc870954537e5c3c7516d00d720faf6712204820764e44`。HTTP200和原画面本身没有单独作为挂载证据。预览使用冻结preview-r3.cjs，在内存构建原main，并从E盘只读取资产；没有写原game.js。

本版实际操作：开始调查(0,190)，原=前进后W停在(0,4)，原拖动转131°，经(64,60)到营地(87,80)；短步近看后停于(89,85)，转111°检查。近距离观察了明确标记“WORLD表现姿态样本（无战斗结算）”的idle/windup/chase/return/patrol；截图能看到不同步态时刻的腿与蹄位置，蓄力时躯干俯倾而支撑脚保留地面接触。原V切第三人称，原角色与矿簇/掠兽同场。再原拖动转23°，步行至(98,65)，原F回收动力耦合芯，HUD出现返回勘探车安装部件。route-log.json保留包括短步后HUD变化的观察记录，不把UI坐标采样当连续轨迹精测。

截图：camp-idle.png、camp-windup.png、camp-chase-a/b.png、camp-return.png、camp-patrol.png、camp-original-avatar.png、original-f-recovery.png。这些都是R3本版采集，开发截图不充当独立实机证据。固定1280×720近景中控件可操作，底部按钮可见；默认面板曾变窄，辅助selector会与原目标区重叠，未将窄屏响应式UI列为通过，未改产品CSS。截图使用完整tab viewport保存，避免面板裁切。结束恢复默认viewport。

**本版仅营地实走；四地点地形覆盖是本版独立三角几何证据。** R2报告中东/北/西长距离原输入实走仅为历史，不能作为R3重走。死亡/恢复为独立Three fixture实测，没有本版浏览器真实击杀。姿态selector只是表现样本，不是实际AI追击/命中/战斗结算。

持续驾驶、真实AI/路径、动态车阻挡、真实敌人根状态与采集/奖励/库存/存档、完整原任务/门禁以及CORE整合均未测。F回收原部件不代表上述新业务通过。本机只有短时renderer统计（末次约16.65ms、151calls、383958triangles），非长时P95/低端机或性能优化证明。浏览器最终error/warn为空。

## 复跑、完整性与清理

在本树运行：

1. `node --test playable/tests/expedition-world.test.js`，预期11通过；会写本树开发测量证据，恢复冻结该文件后才做完整性封存。
2. `node --test artifacts/tests/TEST-ORIGINAL-WORLD-R3/independent.mjs artifacts/tests/TEST-ORIGINAL-WORLD-R3/continuity.mjs artifacts/tests/TEST-ORIGINAL-WORLD-R3/regression.mjs artifacts/tests/TEST-ORIGINAL-WORLD-R3/state-boundaries.mjs artifacts/tests/TEST-ORIGINAL-WORLD-R3/rocks.mjs`，预期11通过。
3. 原浏览器复跑可用 `set WORLD_PREVIEW_PORT=43273` 后运行 `node playable/src/expedition-world/preview-r3.cjs`，必须使用原入口和原输入，并再次核验served挂载。

最终final-hashes.json逐项核验冻结源与本树206个清单文件均一致，外manifest条目与初始逐项记录一致；R2报告及只读依赖SHA未变。没有修改冻结根、E盘主项目、原bundle或被测产品源码。

本轮测试页已原Esc暂停后关闭，自有43273服务已停止并确认ECONNREFUSED，viewport已reset，没有停止其他服务。报告/脚本/截图/测量/TAP/日志/原HEAD备份由 `artifacts/tests/TEST-ORIGINAL-WORLD-R3/evidence-manifest.json` 完整覆盖（清单本身由外部SHA引用，避免自哈希循环）。本轮结束，不扩展功能。
