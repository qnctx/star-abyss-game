# 星球玩法 R2：轨道速度与安全高空快速碰撞

日期：2026-09-16。工作区：`C:/Users/HUAWEI/.codex/worktrees/9b63/star-abyss-game`。

## 交付结论

仅修改自己的 `flight.mjs`、`runtime-world.mjs`，新增R2测试与报告。**32/32 Node测试通过**。地表→240km→落地的连续50ms步长积分为 **465秒（7分45秒）**：上升219.8秒、下降245.2秒。未传送、未改变积分过程中的位置来压缩时长。这里是模块仿真时长，不是浏览器FPS或完整任务链原生通过证明。

原玩法前置/采样/整备解锁、存档codec、主控main/scene/layout都没有修改。主项目及4173保持不动。R1文件已按原manifest逐项校验后冻结在 `artifacts/deliveries/PLANET-GAMEPLAY-R1`；R2冻结为 `artifacts/deliveries/PLANET-GAMEPLAY-R2`。

## 速度与加速度

| 范围 | 水平 | 上升 | 下降 | 加速度 |
|---|---|---|---|---|
| AGL≤80m | 12m/s | 4m/s | 2–24m/s、随接地减速 | 原水平18、垂直12m/s² |
| AGL80–1600m | 原平滑12→420m/s | 原平滑4→180m/s | 原近地上限24m/s | 保留原18/12 |
| AGL1600–3000m | 保持420m/s | 保持180m/s | 连续24→180m/s，并施加提前制动上界 | 保留原18/12 |
| AGL和海拔均3000–30000m | 连续420→2000m/s | 连续180→2000m/s | 连续180→2000m/s | 水平18→450、垂直12→500 |
| AGL和海拔均≥30000m | 2000m/s | 2000m/s | 2000m/s | 水平450、垂直500 |

轨道过渡使用 `ramp=smoothstep(3000,30000,min(AGL,altitude))`，再用 `1-(1-ramp)^3`，边界值和一阶趋势连续。设计先保留1600–3000m的既有巡航层，再从3000m平滑提速，到30000m达到完整轨道速度。高海拔低离地的山顶不会直接获得轨道速度。

下降的提前制动使用低空12m/s²刹车能力和到1600m边界的距离，并预留一个最大50ms子步的巡航位移，确保穿过边界时速度已回到24m/s。不同dt（120/60/20Hz）、正常供能与完全失能下降均验证落地、不穿地、无近地高速残留。松开上升键先按加速度约束消除上升惯性，再下降；不是瞬间反向。

## 安全高空碰撞契约

架构任务公开 `field.maxSurfaceHeight:number|null`（R3）。本模块**不猜测常数**：

- 无自定义legacyHeight时架构证明上界为5085m。
- 有legacyHeight但未传legacyMaxHeight时必须返回null，快速路径禁用。
- 有已证明legacyMaxHeight时，上界为 `max(5085, (R+hMax)*sqrt(1+2*(blendEnd/R)^2)-R)`。
- 架构证明包括噪声、大陆抬升、河谷、海面、所有凸混合及旧切平面径向转换。总控已确认其旧地形310m上界；由总控传 `legacyMaxHeight:310`，本模块不替主控写死。

新导出：

```js
segmentClearsSurface(from, to, radius, maxSurfaceHeight, clearance = .9)
```

函数求完整线段上离球心最近的点，只有其半径**严格大于** `R+bound+clearance`（另加保守浮点裕量）时返回true。两端高于地表不构成证明：横穿球体、切近保护壳、非法/无界数字都不能走快速路径。

adapter.sweep在此条件成立时跳过所有地形密采，但**仍调用一次solidSweep并服从其ready/clear**。函数没有为树/船/动态实体提供上界；主控不得仅根据地表上界跳过任意实体。对旧盆地/树的solidSweep剔除需要它们自己的已证明包围体或高度上界。

近地、无bound、线段接触保护壳时保留R1的0.25m路径采样与侧向检查。缺块、未加载、地形障碍和实体障碍仍失败关闭。高空step仍读取起点/终点表面，下降时还会做一次终点贴地查询；因此现有loaded/sampleTerrain契约不变。实测测试断言：一个2000m/s、50ms真实球面步至多3次sampleTerrain回调，sweep内部0次密集地形查询，solidSweep1次。不是宣称WebGL帧率提高到某个值。

## 主控接入

1. 用R2冻结目录替换两文件 `playable/src/planet-gameplay/flight.mjs` 与 `runtime-world.mjs`。`index.mjs`原有export-star自动导出segmentClearsSurface，无需改。
2. 架构field至少使用R3；本次测试依赖的field SHA为 `3fd591951e2913a820976767c8e5ba2a34f157ad19e9d1cf7b283dd83d538985`，由架构交付，不从玩法目录覆盖。
3. `createPlanetField({legacyHeight:legacyTerrainHeight,legacyMaxHeight:310,...})`仅适用于总控已经证明该310上界的既有地形。如之后地形变更需重新证明。
4. 原主控solidSweep若仍按0.3m循环，需单独利用实体包围体剔除，否则仍有该部分开销。可复用segmentClearsSurface的整段球心距离算法，**bound必须包括要剔除的实体，不只是地表**。
5. 本切片不处理R1发现的背面地面归属、远距停车恢复或相机浮动原点修复；这些保持主控R2独立复验范围。

## 验证

```text
node --test playable/tests/planet-gameplay.test.mjs playable/tests/planet-runtime-world.test.mjs playable/tests/planet-gameplay-r2.test.mjs
```

32/32通过；TAP：`docs/development/reports/PLANET-GAMEPLAY-R2.tap`。

保留23项R1测试，新增9项覆盖：近地参数不变/轨道过渡连续、完整240km往返时长/有界加速度、null/NaN/Infinity bound拒绝、整段弦线净空、保留solidSweep、无上界高空缺块拒绝、近地薄脊/未加载回归、200条确定随机弦线与密采参考对照、多帧率/失能制动、真实球面步查询次数。

## 限制

低空0.25m地形采样仍不是解析连续碰撞证明；极薄实体由solidSweep负责。bound正确性是架构与主控输入契约，不能以有限随机抽样代替数学上界。可玩时长为理想无遮挡垂直往返，不包含玩家停留、UI、流式等待、地表任务路程。浏览器接入后的原生手感、视角、FPS与真实完整飞行链仍需主控验证。

精确SHA与绝对路径清单：`PLANET-GAMEPLAY-R2.manifest.json`。冻结目录中manifest.files只含本切片两源码、一新增测试、报告与TAP；architectureDependencies及regressionDependencies是复现依赖，不可覆盖总控或架构的新改动。
