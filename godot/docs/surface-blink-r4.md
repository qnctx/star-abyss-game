# R8 / R9 地表瞬移模块

本 slice 只提供独立的 `scripts/native_surface_blink.gd`；Main、Ascension、Player、World 接线由各文件 owner 完成。它复用 `assets/martial-r4/impact-reference.png` 的 B 行：等待真实落点 → 0.8 秒源端收身开缝 → 安全悬浮高度到达 → 0.65 秒屈膝恢复。使用 `cast_martial_blink` / `cast_martial_arrival`，空中动作由 Motion 自动选择 `air_` 变体；不改共享 motion GLB 或待审核走跑。

| 境界 | 最大同径向距离 | 灵息消耗（满值 100） | 冷却 |
| --- | ---: | ---: | ---: |
| R8 星劫 | 75 km | 25 | 20 s |
| R9 道源 | 180 km | 35 | 25 s |

玩家须飞行并看向脚下星球（视线与向内径向点积至少 0.6）。当前版本只接受同径向的干燥实体地表，不接受远侧星球弦线、横移目的地或水面。World 必须真实准备并钉住路径与目标碰撞；模块不生成虚假 ready。

## 集成契约

- `setup(ascension: Node, world: Node3D, player: Node3D)`：添加到树后调用；绑定失焦取消。模块不自跑 physics。
- `advance(dt: float)`：由主游戏每个 physics 帧调用一次，传原游戏 dt。源动作读取 Player 自己的 `_cast_elapsed`；hitstop 或暂停不能使瞬移提前完成。
- `try_start() -> Dictionary`：Ctrl+Q 按下调用。立即失败返回 `{ok:false,pending:false,reason}`；受理返回 `pending:true`。同键再次调用取消。R/Q/载具/场景切换互斥由 Main 先调用 `cancel()`，不可让普通瞬移夺取同一组 route pins。真正开始源动作后，有对应方法时调用 `ascension.surface_blink_vfx(origin,"start")`；主模块收到取消／成功 resolved 后负责关闭源缝／播放目标缝。
- `cancel(reason="地表瞬移已取消")`、`is_pending()`；`resolved(result)` 仅异步完成或取消时发射。成功 result 含 origin、target、normal、distance、cost、cooldown、serial、arrival_started，可接已制作的对应 VFX。
- `snapshot()/restore(data)` 只保存 `version/cooldown_remaining/serial`；不保存准备中的场景坐标或动作。restore 释放准备并取消自身动作，不从墙钟推算冷却。

World 接口为 `prepare_surface_landing(origin:Vector3,max_distance:float,cast_id:String)->Dictionary`，cast_id 每次尝试唯一且同次准备／提交保持不变；返回 `ready/clear/target/normal/reason/ticket`。target 是地表上方约 0.8 米的安全位置，`surface_at(target)` 必须返回有效 `ready/water_depth/agl`，模块接受 AGL 0.65–1.20 米。ticket 是由 World 制作、Player 通过 `consume_surface_landing(ticket,current_scene,body_radius,body_height)` 消费的一次性 Dictionary；模块不自行伪造或绕过。`cancel_surface_landing(token)` 释放此尝试的 pin，等待阶段 token 为 `{cast_id}`，已签发时传完整 ticket，不夺取普通瞬移的 route pin。接口缺失会明确无扣费拒绝。准备按 0.1 秒采样、最多 12 秒，移动超过 0.45 米、朝向点积低于 0.985、受伤、境界/飞行改变、动作 serial 改变、origin revision 改变、失焦都会取消。

完整源动作结束时重做 prepare、干燥和地表支撑校验，再由 `Player.blink_to_prepared_surface(target,ticket)` 消费真实路径授权、检查角色体积并提交；只有返回 true 才扣灵息与启动冷却。目标自准备起变化超过 0.10 米则取消。原普通 `blink_to` 不变。新接口未到位时本模块明确失败，不绕过旧路径拒绝或先移动再回滚。

## 验证状态与步骤

2026-09-30已在获准的短headless独占窗口执行小型fake契约，53/53通过；实际runtime脚本check-only通过，尚未执行真实返地场景。修复了测试自己的Node.ready变量冲突、类型推断和未ready时不该提前签发票据的fake行为，生产模块未因该轮测试改动。契约通过不能作为真实碰撞、骨架动画或全游戏完成的证据。

1. 在获准的集中 parse 窗口执行 `Godot --headless --path godot --script res://tests/native_surface_blink_contract.gd`。检查境界/距离/灵息边界、完整动作前不提交、未 ready/移动/转向/受伤/取消/坐标更改不扣费、准备后新遮挡与 Player 拒绝、一次提交、剩余冷却恢复。
2. 用独立存档启动正常 physics 与默认相机。R8 在干燥陆地区上空 50–74 km、R9 在 179 km 处停稳并看向脚下，按 Ctrl+Q；正常速度录制等待、完整源动作、脚点到达和恢复，检查真实支持碰撞、皮肤姿态与 VFX 对应 B 行。
3. 分别用 R7、R8 超 75 km、R9 超 180 km、灵息 24/34、海上、建筑／树挡落点、路线新增遮挡测试拒绝；确认位置、灵息和冷却没有提交变化。
4. 准备与起手期分别移动、转向、被击、再次 Ctrl+Q、右键取消、失焦；未 ready 时等候超时。确认 route pin 被释放，无延迟瞬移。
5. 提交后保存并重载独立槽，确认已提交位置与剩余冷却。准备中保存重载必须回到原位置并放弃待提交目的地。检查正常 Q/R 和普通下降仍可使用。

真正的远路 collider readiness、干燥落点、Player 最终体积、视觉与性能由集成验证验收；这里没有将待完成接线标为通过。

## 真实 runtime 验收脚本（待执行）

`tests/native_surface_blink_runtime_verify.gd` 实例化真实 Main，使用唯一 `user://surface_blink_runtime_verify_<run>.json`，所有 Ctrl+Q、W 和 F5 均经真实输入事件。不会手动调用运动／技能 physics 过程，不关 Main、Player、Ascension、敌人或流式加载，也不清零冷却。每次夹具由公开 `restore_canonical` 校验并设置位置、境界、初始灵息及飞行姿态；报告明确这不是已飞行距离的证据。下一次成功用例前自然等待既有冷却。

在明确获准的独占 GPU 窗口运行：

```text
Godot --path godot --rendering-method gl_compatibility --script res://tests/native_surface_blink_runtime_verify.gd
```

传 `-- --remote` 增加真实远端陆地区 125 km 返地；该夹具先加载真实起点径向支撑，报告不会将它描述成冷缓存性能测试。传 `-- --no-capture` 可做无截图的逻辑运行，报告显式标记画面未验证。脚本尚未启动执行。

默认覆盖 R7 锁定、R8 在 125 km 拒绝、起手再次 Ctrl+Q 取消、W 移动取消、实体阻挡、签发后新增阻挡、R8/R9 各自 120 m 成功、R9 125 km 成功。有限等待为每次最多 20 秒模拟时间／45 秒墙钟；夹具最多 600 个 physics 帧／45 秒。成功信号即时读取落点实际射线 collider、角色体积、AGL、扣耗、冷却；后续 75 帧检查自然落地和无重复扣耗。阻挡用例创建醒目标识色的有限实体盒，仅为测试夹具，不是游戏成品资产。

输出保留在 `reports/surface-blink-runtime/<run>/`，包括默认玩家相机截图、明确标记的补充侧视、每三 physics 帧状态、实际落点／支撑 collider、energy/current/cooldown、physics frame、开始及结束源码和 GLB SHA-256、独立槽路径与用户默认档案未改动校验。截图生成仅说明取证完成，仍需实际检查姿态、VFX、中文 UI 与按钮遮挡，不能自动宣布画面合格。

### 2026-09-30 真实运行验证

`reports/surface-blink-runtime/1535947/runtime-verification.json`：9个case，138检查，failures为空；3719物理帧/61.983游戏秒。真实Ctrl+Q路径覆盖R7锁定、R8在125km超距、重复输入取消、W移动取消、初始实体占据、准备完成后的新障碍、R8/R9在120m落地及R9约125km返地。r9-125km-arrival起点before.agl=125002.097951898m，实际提交result.distance=124999.203125m，即时outcome/resolution AGL=0.80001425743103m，随后after.agl=0m（自然落地），干燥实体terrain collider和角色胶囊clear，消耗/CD各一次；真实F5保存含剩余CD。

高空初始位置通过restore_canonical布置；此报告证明真实高阶输入/票据/位移/碰撞，不证明靠G飞到125km。普通G/C125km往返由flight owner的独立报告验证。默认用户槽hash只是只读窗口观察，测试Main进入树前已绑独立slot。1060项共享脚本及生态资源前后hash相同（`reports/martial-r4/surface-runtime-r42-dependency-hashes.json`）。

实看默认起手/到达/沉降及辅助侧面图片，中文可读且到达后HUD更新正常；aperture细弱，动作与特效仍未获得视觉验收，功能通过不替代画面质量。当前运行进程已结束并释放窗口。

数值口径：当前runtime-verification.json SHA256为fc9c0c44341dc77da28d44205e39773561cff4516c6b74c404dd31587b4c55df。上述距离不是起点AGL；after是75帧后的落地状态，不能替代即时提交高度。原artifact与截图保留，核对未重跑引擎。
