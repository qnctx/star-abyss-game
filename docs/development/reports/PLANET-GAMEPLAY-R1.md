# 星球探索与高空飞行 · R1 独立模块交付

工作区：`C:/Users/HUAWEI/.codex/worktrees/9b63/star-abyss-game`。日期：2026-09-16。

## 范围与结果

新增纯玩法模块、真实球面场适配器和可运行测试。没有修改主项目、4173、共享 main/scene/layout、原任务、角色或资产；没有创建白盒小场景。总控负责接入共享主循环。所有图像与3D由美术/架构任务按图片先行流程交付。

读取基线：主项目 AGENTS.md、PLANET-CONTROLLER-HANDOFF.md、mobility.mjs、camera.mjs、story.mjs、main.mjs 保存/恢复/模拟路径、layout.mjs 碰撞与世界边界、expedition-runtime 的保存入口。没有可调用 codegraph 工具，采用精确搜索。仅复制架构 coordinates/field 两文件用于真实接口测试，不交付覆盖它们。

## 实现文件

- `playable/src/planet-gameplay/progression.mjs`：原 `story.flags.complete` 和修车前置；plains→forest→wetland→coast 地表步行采样；返回服务点整备后解锁高阶飞行。海岸采样包含海洋观察，不需要游泳或潜水。普通探索可继续，锁的是高阶飞行。
- `playable/src/planet-gameplay/flight.mjs`：离地高度控制12→420m/s、4→180m/s升速；海拔/半径控制大陆与全球相机参数；2.5R上限；最大50ms子步；耗能、失能下降、碰撞/缺块停止、落地交还原移动循环。
- `playable/src/planet-gameplay/runtime-world.mjs`：使用架构实际球心double坐标、tangentFrame、field接口；不自行算经度；沿切向推进后保留径向海拔；0.25m线段地形采样、侧向检查和外部solid sweep；旧盆地负高程强制干燥，优先使用field.waterHeight真实水面。
- `playable/src/planet-gameplay/save.mjs`：兼容架构planet信封，追加gameplay.version/progression/energy/surfaceVehicle；未知版本或不匹配seed/radius只读，缺块pending，地下/水中状态unsafe，绝不回写覆盖；恢复空中存档清除按键并缓降。
- `playable/src/planet-gameplay/index.mjs`：统一导出及旧输入yaw到east/north的转换。
- `playable/tests/planet-gameplay.test.mjs`、`planet-runtime-world.test.mjs`：23项Node测试。

## 与总控约定的接入点

```js
import { createRuntimeWorld, restorePlanet, attachPlanet, createFlight,
  createProgression, progressionView, progressAction, stepFlight,
  flightControls, cameraEnvelope, clearFlightInput } from './planet-gameplay/index.mjs';

const world = createRuntimeWorld({
  field, // 同渲染/地形架构createPlanetField实例
  loaded: position => scenePlanet.isReady(position, 20),
  sampleTerrain: (position, raw) => {
    const rendered = scenePlanet.sampleRenderedSurface(position);
    return rendered.ready ? { ...raw, ...rendered } : null;
  },
  solidSweep: (from, to, radius) => sweepOriginalAndPlanetSolids(from, to, radius),
  serviceAt: position => isAtOriginalCamp(position),
});
```

回调中的 `scenePlanet`、`sweepOriginalAndPlanetSolids`、`isAtOriginalCamp` 是总控需绑定的现有场景能力，不能用始终true的假实现替代。近地采样必须使用实际渲染三角支撑高度；远空可使用场的高度，但loaded规则仍应确认可用的覆盖LOD。`solidSweep`返回`{ready,clear}`，涵盖原门、船舱、岩壁、停放车辆及新生态实体；任一缺失都停止本子步。

1. **新游戏**：createProgression、createFlight(world.legacyToCanonical(player))。保持原低空助推/载具行为；未commissioned不可把高空模块的launch交给新玩家。
2. **恢复**：先恢复/验证原story、原mobility停车快照，再调用restorePlanet(raw,{story,mobility},world,world.legacyToCanonical)。对`incompatible/invalid/unsafe/pending`暂停继续和自动保存，给出可操作提示；pending等地块就绪后重试原raw，绝不重新创建位置。只有`legacy/restored`返回可写会话。
3. **坐标权威**：有planet保存时，planet.position是真实位置。旧restorePlayer会裁切高空和±3000边界，不可用它恢复星球位置。离盆地时原player/mobility保留parking快照，原expedition tick/action/visual停用，返盆地再恢复；救援回调需同步重建planet flight/position并清输入。此方案由总控实现。
4. **每帧**：原地面循环移动后同步session.flight.position到canonical位置。非mounted、非跳跃、非舱内，且progressionView(...).unlocked或flight.active时调用stepFlight(session.flight,flightControls(controls,player.yaw),dt,unlocked,world)。`handled=true`时禁止再调用stepMobility移动同一玩家；结果position回写渲染姿态。若step结果`handled=false`则沿用原移动。暂停/失焦调用clearFlightInput并保持位置。
5. **交互**：在非菜单且玩家按调查键时，用world.sample(canonical)传progressAction。action为survey/commission。context={story,mobility}。拒绝空中、坐车、未加载、深水采样；成功后立即保存。主任务未complete时保留原objective，新objective作为旁路/完成后的自然延续。
6. **相机**：cameraEnvelope只返回连续参数，不改玩家坐标。保留原first/third/vehicle选择和近距离boom碰撞，按场景径向up转向。continent/globe是LOD和视野的平滑因子，不能换场景/传送。near/far/fov/position变化需在同一世界相机实现并重做boom sweep。
7. **保存**：原snapshot完成后调用attachPlanet(snapshot,session,world)，顶层version仍1，原story/player/mobility/expedition等逐字段保留。星球地面载具另存session.surfaceVehicle={position球心,yaw物理朝向,battery,mounted}；其位置须为接地基座，不是车座。恢复会验证接地、dry、mounted位置与玩家一致；不重建维修奖励。

架构attachPlanetPosition已确认保留gameplay。游戏整备解锁不依赖菜单布尔开关，load时按原story/repair与连续样本前缀重新验证。存档不是反作弊系统，不对客户端手改提供安全承诺。

## 验证步骤

在本工作区执行：

```text
node --test playable/tests/planet-gameplay.test.mjs playable/tests/planet-runtime-world.test.mjs
```

23/23通过。覆盖新玩家不跳成长、采样顺序/返营、空中/水中拒绝采样、AGL与海拔分离、相机连续、帧步长上限、耗能着陆、全路径碰撞、缺块阻断、负海拔干盆地、真实field原盆地接地、跨经度/近极点、连续40km切向运动海拔误差、canonical保存、车辆状态、原存档字段保留和未来版本拒绝写入。TAP存放报告同目录 `PLANET-GAMEPLAY-R1.tap`。

集成后仍需原生验收：原调查完整跑通→修车→沿连续地形到各生态→海岸观察→返营整备→正常升空见大陆/球体→中途保存刷新→连续下降落地→出盆地驾驶后刷新→返回盆地继续旧任务/外勤。交付未声称这些浏览器链路已经通过。

## 风险与限制

- 本模块未发布也未接共享main；高空相机视觉、实际按键和UI可点击性由总控原生验证。
- 420m/s与180m/s升速、耗能0.003每秒是可调初值；120km半径下全景升高需要较长时间，不能用瞬移掩盖。需要总控用真实路线/玩法时长继续平衡。
- 地表sweep为0.25m采样加四侧检查，不是解析连续碰撞证明；极薄物体必须solidSweep接真实网格/胶囊连续碰撞。完整地形路径每步有成本，高空应由总控结合LOD/保守高度界优化后做浏览器性能验收。
- 若渲染LOD替换造成支撑变化超过0.15m，车辆恢复可能unsafe；应在恢复期间锁住目标高精地块，不能偷偷回营或掉到海底。
- 远海失能下降最终会停在安全海面上方；本阶段没有游泳/水中救援模块，主循环应提示返岸/调用既有救援，不能把无功能海底当可着陆地面。

文件SHA清单见 `PLANET-GAMEPLAY-R1.manifest.json`。其中architectureDependencies只用于复现测试，不得覆盖架构任务的更新。
