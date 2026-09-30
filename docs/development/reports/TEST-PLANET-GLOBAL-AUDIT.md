# Planet global integration independent audit

## 最终独立复核：10/10 PASS，既有发现全部关闭

本审查者重新执行完整 `node --test playable/tests/planet-global-audit.test.mjs`，退出码 0；10 tests、10 pass、0 fail，62.657 秒。未增加范围或修改测试断言。

最新两个缺陷均实测关闭：全球 3.6m/s 行驶中拒绝下车；未 commission 的背面地面按 G 保持在负 X 半球，不再回退旧切平面物理。代码同时确认 main 径向步行条件包含 `!flightUnlocked()`，未解锁 G+Shift 仍进入体力结算；runtime reset 清理旧速度。太阳能停车恢复、真实加速/刹车/倒车电耗、地图远标点保存清除、背面与极区保存、同帧重定位 undo、东行四个落点均在同一次完整测试中通过。

最终测试 SHA256：`65b20ce69c4a4e429131612e1f6c6af5af65004046328488dba7813c87388f48`。
核对产品 SHA256：runtime `5b1e87020897814545ab972e5cde6b7dad8bc4bb3efe3bc4993b89b944212bfa`；main `7af7266c18296d46d7ab311b3ce451a2762f3daf2e33e4b9d23229ee776cb425`。

范围仍为真实 Node/Three 集成验证；不宣称全程 6km→34km 连续驾驶、浏览器原生外观或完整星球游戏验收。下列失败段落均为修复前历史证据，以本节最终结果为准。

## 停车恢复与主循环修正后独立复核

原 7 项全部 PASS，包括 solar。代码确认 main 已将负重过滤前移到 planet step 前，径向步行按剩余体力分段并调用 updateStamina/成长/脚步音；未把代码审查冒称浏览器负重实测。

新增真实 runtime 车辆测试 PASS：8 帧每帧 0.05s 加速后速度 3.6m/s，耗电等于真实 canonical 总位移×0.01；3 帧刹车停稳；30 帧倒车上限 10m/s。地图目标补测 PASS：选真实 `survey:coast`→save/reset，custom 目标 ID 与球面距离精确保留；清除→save/reset 不复活旧目标。

新增两项确认缺陷，产品未修改，保留失败测试：

1. `--test-name-pattern=global.moving`：真实全球车速 3.6m/s，vehicleAction 返回 true 下车。原 mobilityAction 在速度>2 时明确拒绝，全球版本缺少停稳判定。
2. `--test-name-pattern=uncommissioned.global`：真实背面干地、未整备高空装备，G 输入使 runtime.step 返回 false。测试随后调用真正 stepMobility（与 main 的 fallback 相同 API）及 syncGround，canonical 玩家从负 X 背面被移至正 X。根因径向地面分支排除 lift，而未解锁高阶分支返回 false，引入旧切平面低空物理。全球拒绝起飞应仍 handled，不能交还旧位置积分。

总计当前独立文件 10 项：分批执行 8 PASS、2 FAIL；未把分批结果称为一次完整运行。没有改主控代码或放宽有效断言。

## 后续有界路线审核：新增真实回归

未解锁高阶飞行，分别在真实 field 的 8/17/27/34km route 地面启动，在每处执行主循环相同的 `planet.step → 返回false → stepMobility`：均产生 0.0225m 驾驶位移、非阻挡、实际 adapter AGL 约 0；原 `mobilityAction('dismount')` 安全下车，再保存/恢复通过。命令 `node --test --test-name-pattern=uncommissioned playable/tests/planet-global-audit.test.mjs`，PASS。这是四个真实落点的局部链验证，**不是**从 6km 连续驾驶到 34km 的全程证据，也未模拟沿途树木和全部路线。

新增已复现缺陷：全球径向分支丢失原停车太阳能充电。真实背面 dry ground，保存中车辆 battery=0/mounted=false；`runtime.step({},1/60)` 连续 60 次均 handled=true，battery 仍为 0。旧 mobility.mjs:138 在步行帧给停泊车辆充电，但 main 的 planet handled 分支提前 return，runtime 自身未结算。命令 `node --test --test-name-pattern=solar playable/tests/planet-global-audit.test.mjs` FAIL：`global handled branch must preserve parked vehicle recharge`。影响耗尽电池后停车恢复的既有闭环。

另有明确代码接线问题（尚未浏览器实测）：main.mjs simulate 的 planetRuntime.step+return 位于 canSprint/canTakeOff/overloaded 控制过滤之前。因此飞行/全球径向步行不受原负重裁决；该分支也未调用 updateStamina，而 runtime 径向 sprint 直接给 7m/s。建议负重过滤前移，按真实径向运动结果结算地面体力与停泊恢复。未把这两项冒称原生验证。产品未修改；新增 solar 回归保留失败等待修复。

## R3 后复核结果：5/5 PASS

运行 `node --test playable/tests/planet-global-audit.test.mjs`，退出码 0，5/5 PASS，约 27 秒。仅审查测试与报告变更；产品修复由总控及架构完成。

本轮证据 SHA256：runtime `29fa9363e361c1143e2773aa06b2d9ed440a51c6337100cec2e7ffca4fd73293`；test `55360b8cdcd8b458bb9bb7cbf9b53c3cbf3a756dd0d1c6b660ee3e68a770e00c`。

- 背面同 XZ 服务点现在正确拒绝。
- 背面真实三角地面恢复→步行发生位移→起飞→保存→恢复全部通过；仍在负 X 半球，旧盆地停泊 pose 与 canonical 车位不丢失。
- 极点前轮 unsafe 是测试把海底当陆地：北极高度 -2047.005813m、水深 2047.005813m。现保留严格断言，实际海底存档必须 unsafe；另从真实 field 搜索距北极 35 度以内干地完成恢复、保存与非盆地判定。南极高度 729.389689m、水深 0、AGL 0，直接在精确极点验证通过。没有放宽水深/碰撞约束。
- 背面旧船舱 XZ 投影实测 `insideWreck(...)===true`，但高阶起飞成功，证明正面门控实际有效。
- 同一背面地面 canonical 载具 mounted 恢复→驾驶耗电→下车→保存→恢复保留负 X 车位→再次上车精确回车位，全链通过。
- 原同帧 parent rebase→save→finishScene 四次及最终 restore 无漂移仍通过。

这些是独立 Node/Three 几何与状态集成证据，不替代浏览器 WebGL 外观、交互 HUD、原用户存档验收。下文保留 R3 前失败与诊断，便于追溯。

2026-09-16，cb21。仅新增本报告与 `playable/tests/planet-global-audit.test.mjs`；未修改产品或主项目用户存档。测试使用真实 `createPlanetRuntime`、Three.Scene、field/terrain/gameplay，不替换地形或 mock readiness。

单独服务点复现后的证据 SHA256：runtime `dd1507884e227e4ef040dceaa39711084e08268cb570eeeb014b8be6edf6505c`；audit test `9ddb22db276f16f09a929fcf42ad354772bc32c070bf80016292505b0c110429`。产品正由总控并行修改，后续重跑应重新记录版本。

## 第一轮结果（架构 R3 到达前）

`node --test playable/tests/planet-global-audit.test.mjs`：4 项中 1 PASS、3 FAIL。其中两项直接受已知背面/极区 terrain readiness 阻断；首项 readiness 在总控修正高空 raw sample 后，已单独重跑确认服务点误判。不能将后续尚未执行到的地面移动/保存断言计为通过。

### 确认缺陷：营地服务点使用有歧义的 XZ 投影

`planet-runtime.mjs` 的 `createRuntimeWorld.serviceAt` 仅计算 `hypot(local.x, local.z-190)<14`，没有 canonical 距离/正面条件。真实样本 canonical `{-130000,-190,0}` 位于背面高空，adapter 返回 `ready:true, atService:true`。高度样本用于绕开已知地面 LOD 阻断；这不是声称高空已经实际 commission（progression 仍要求 grounded），但相同背面地面投影也没有正面门控。

复现：`node --test --test-name-pattern=opposite-meridian playable/tests/planet-global-audit.test.mjs`，FAIL：`antipodal XZ projection must not grant camp service`，实际 true、期望 false。建议 canonical 营地距离或 `legacyActive` 等价球面所有权判定；不要单用 XZ。

### PASS：同帧重定位、保存、恢复

高空非正面 canonical、真实 parent/child Group 与 camera 加入同一 Three.Scene；连续四次 `updateScene → save → finishScene`。绘制期父位置确实移动超过 1000m，undo 后误差小于 1e-8，child 本地位置不变；canonical save 严格相等，再 reset 严格相等。本轮没有发现正常单次 draw/finish 协议中的累计漂移。

### 等待架构 R3 的断言

- 背面 ground `prepare` 可见 sample，但 `reset` 仍报 pending，尚未进入 landed→walk→takeoff→save/restore 与 canonical parked vehicle 的断言。
- 极点 `prepare` 尚未 ready，因此不能证明极点恢复通过。
- 原 `planet-integrated-runtime.test.mjs` 同样在 backside reset pending 失败，是同一前置问题，未重复修改。

### 代码审查发现，尚待独立执行确认

`planet-runtime.step` 在非 active 起飞前无条件 `insideWreck(player.x,player.z)`；背面 canonical 转换至 anchor-local 后可能与旧船舱 XZ 相同，即使 `radialFrame` 已正确判背面，仍可能禁飞。应限定旧船舱实际所在 canonical 半球/高度，而非扩大旧盆地范围。R3 就绪后用干燥背面船舱投影地面复现。

`restoringSurfaces` 只在 reset 的停车位置验证暂存，finally 清理，未发现它常驻绕过新 LOD 的证据。`stream` 刷新会清除 heightCache；但车位验证临时 terrain.update(v)→terrain.update(player) 的 readiness 与旧局部缓存是否始终一致，需 R3 后继续验证。当前报告不称完整星球验收通过。
