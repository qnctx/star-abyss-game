# 星球接线独立只读审查

2026-09-16。审查 E:/myProject/star-abyss-game 最新主项目与 cb21 基线；未改产品或主项目文件。下面行号指主项目审查时的文件。先执行 `codegraph context expedition-runtime`（无有效上下文）和 `codegraph affected playable/src/main.mjs playable/src/expedition-runtime/index.mjs playable/src/layout.mjs`（无索引测试结果），随后精确 rg。cb21 当前 main 的关键接线仍与主项目一致，没有 planet 接线。

## 必须解决的阻断

| 位置 | 现状与必须改变的接口 |
|---|---|
| `playable/src/main.mjs:195`、`:279` | `serializeGame()` 仅写旧 player，`continueGame()` 无条件 `restorePlayer` 后 `restoreMobility`。应在旧 snapshot 顶层通过 `attachPlanet` 写独立 canonical；恢复顺序为旧 story/player/mobility → planet 恢复 → root 救援回执对账 → 允许移动。planet 的 renderer-relative 坐标绝不能写旧 player。 |
| `playable/src/movement.mjs:52`、`playable/src/mobility.mjs:47` | 旧恢复遇到越界就回出生点，且只保留地表上 4.5m 内的高度；载具 mounted 恢复还会覆盖 player.x/z。必须把这些恢复器限定用于旧盆地停泊 pose，不能先传 canonical 再尝试补救。 |
| `playable/src/expedition-runtime/index.mjs:10`、`:52`、`:160`、`:218` | root scene 的 x/z 严格在 ±3000 内。scene()/tick()/checkpoint() 使用 ctx.player。引入明确 `legacyActive` 或独立旧盆地 context，离开后 tick/action/checkpoint 都不能提交星球 render pose。仅让 playing=false 不足：main 暂停/菜单仍调用 checkpoint。 |
| `playable/src/main.mjs:245`、`:129`、`:151`、`:167` | setScreen 会主动 checkpoint；context、热键 action、可见物/特效更新均要遵循旧盆地激活条件。停泊位置在营地时若仍允许 action，会凭空远程存仓、采集；投影坐标归零也会使玩家看似回营地。 |
| `playable/src/d3-session/scene.mjs:21`、`:32` | scene v1 严格键白名单，player 只有 x/z/yaw/pitch，没有 y 或 extension bag。不能往旧 root.scene 塞 planet 字段，不能简单扩大 bounds 伪装球体；后者无法表示全局高度、切面与跨原点状态。 |
| `playable/src/main.mjs:144`、`playable/src/expedition-runtime/index.mjs:214` | rescue 回调与启动 receipt 修复必须同时重置 planet canonical 至营地、清除 flight velocity/airborne、刷新旧停泊 pose，并在一次 localStorage snapshot 中写入 rescueRevision 与新 planet 状态。否则 IndexedDB 救援成功后刷新会从旧 planet 字段复活到远方。 |
| `playable/src/layout.mjs:72`、`:114`、`playable/src/mobility.mjs:21` | 玩家与载具均被 WORLD.halfSize=3000 的硬边界挡住。星球过渡不能先要求走出旧边界再切换；须在边界前进入连续 canonical 移动，盆地碰撞查询保留墙/岩壁/封印语义并移除其范围外的隐形边界。 |
| `playable/src/main.mjs:434`、`:455`、`:502`、`:509` | 原 simulate 串行执行 dash、mobility、footing、旧外勤。planet 分支必须明确拥有位置积分与地面支撑，避免一次帧里再被旧 mobility/footing 拉回盆地。切换时清理速度和 held 输入；能量、负重、存活等权限要继续作用。 |
| `playable/src/scene.mjs:35`、`:450`、`playable/src/main.mjs:570` | 相机 far=11000，更新仍用旧 terrainHeight。渲染适配器必须提供相机 near/far、高度/局部上方向、浮动原点；否则 120km 半径星球与高空视野被裁切，曲面另一侧角色/相机仍站在世界 Y 上。 |

## 推荐的兼容持久化约束

保留原 localStorage key、expedition link、IndexedDB DB/worldId 和 root。旧 `player` 是最后一个安全盆地 pose（可在进入星球时停泊），顶层 `planet` 是权威当前位置、种子+generatorVersion/worldId、姿态和飞行状态。二者分工是适配已有存档，不能表现为传送换关；渲染与运动的盆地↔星球切换必须在同一个世界坐标位置连续完成。

旧 root.scene 不是全局玩家位置来源，正常 load 只能恢复战斗/库存，不得把 root.scene.player 强制覆盖 canonical。只有**新于本地 expedition.rescueRevision 的已提交 rescue receipt**才覆盖 canonical。回调必须幂等；如果本地写入失败，下一次仍由相同 receipt 重做。不能先持久化新 rescueRevision 再持久化 canonical，否则丢失重做信号。进入星球前应等旧 in-flight transaction 完成并 checkpoint，离开期暂停旧 spatial mutations；保留原 root 失败时报错而不重新初始化的保护（runtime:67-72）。

建议接口：`getLegacyContext()` 明确 `{player: parkedLegacyPose, legacyActive, mounted, airborne, dashing, playing, menu}`；`serializeGame()` 保留旧结构并 `attachPlanet(...)`；`reconcileRescue(pose,revision)` 同步两套位置和输入；`planetWorld.sample/advance/sweep` 只用 canonical。`sample` 的 AGL 应基于可支撑的岩顶/物体顶，而非仅裸地高度。

碰撞不可省略尺寸：旧人体 radius=0.42m、站立体高=1.85m（layout:6/114），载具 radius=1.1m、体高=1.3m（mobility:7）。planet sweep 必须验证整段运动与体积/脚底支撑，尤其高阶速度；切面转换方向约定要测试旧 W 为 -z、右为 +x，与 east/north 的映射一致。浮动原点只影响渲染，禁止写回 double canonical。

## 验证结果与可复用步骤

已在 E:/myProject/star-abyss-game 执行：

```text
node --test playable/tests/movement.test.js playable/tests/mobility.test.js playable/tests/d3-session.test.js
```

45/45 PASS。覆盖旧边界、旧飞行高度、载具与恢复、session CAS/救援/配置校验。这仅证明旧行为，因此恰好也证明不能直接复用旧 restore 处理星球坐标；不是新星球验收。

集成后补充必要回归：

1. 原无 planet 存档 → 相同 story/inventory/vehicle/player 恢复；不创建第二 root。
2. 走过 2999.58m 边界、4000m 过渡、跨 chunk/浮动原点，再原路回旧盆地；位置连续且墙/岩顶碰撞仍有效。
3. 地面远方与高空分别 save→刷新；canonical、海拔与朝向不回出生点；legacy parked pose 一直合法。
4. 离开盆地后暂停/菜单/pagehide，旧 root 无 invalidScenePose；H/R/存仓不能操作停泊点；不生成盆地追击幻影。
5. 救援根提交成功、本地写入故障 → 刷新重放 receipt，最终停在营地且 planet 不回远方；重复刷新不重复救援/奖励。
6. sweep 未 ready、海面/悬崖/岩壁高速穿越失败关闭；返地时脚底与同一 sample 碰撞面一致。
7. 原 4173 用户存档不参与测试；用隔离 test world 与专用预览检查中文 HUD 无遮挡，以及高空完整星球不被 far plane 裁切。

