# R2 独立 CPU 初审（2026-09-25）

范围：只读审查与 CPU 验证；营地主场景仍在集成中，因此本文不是最终验收。未运行浏览器、GPU 或发布服务，未修改生产文件。

## 已验证

- `node --test playable/tests/flight-r2.test.mjs`：6/6 通过，覆盖真实米位移、2000m AGL、镜头接口与六面 chunk 选择。
- `node tools/art/flight-r2/verify-flight.mjs`：通过。五组 Blender 动作与运行时 19 骨骼顺序一致，关键帧有限且归一化，左右侧倾、缓入缓出及尾迹预算有断言。
- 自写 `artifacts/r2-independent-flight.mjs` 对真实球面适配器在 2000m 起点按 W、四个朝向各步进 5 秒：四次均移动约 1576m，末速 420m/s，100/100 步返回 `flight`，AGL 未超过 2000m。结果在 `artifacts/r2-independent-flight.json`。这证明 CPU 路径已修复基线的高空不动问题，不能代替帧率、视野和加载的实机验证。
- 源码接线：`playable/src/scene.mjs:458` 从 planet controller 提供 `innateFlight`，`playable/src/avatar.mjs:227-260` 将速度/侧倾混入角色骨架，`playable/src/scene.mjs:509` 驱动尾迹；`playable/src/planet-runtime.mjs:183` 的 `stepFlight` 结果进入玩家位置。

## 需跟进的发现

1. **P2，一人称手部视觉目标尚未由源码满足。** `playable/src/planet-runtime.mjs:267` 在一人称隐藏整个 `avatar`，`playable/src/scene.mjs:481` 又在 innateFlight 激活时隐藏 equipment，因此当前能看到的仅可能是 `scene.mjs:509` 的细尾迹，缺少参考目标中下缘的双手。应由美术/场景实现代理处理，最终须游戏内截图判断遮挡与可读性。
2. **P1 待复核，营地建筑台阶可能阻断地面路径。** `artifacts/r2-independent-camp.mjs` 无 GPU 重载三栋实际 GLB，并用 `createCampV2Scene` 的真实三角碰撞做探针。地面高设 0 时，三栋入口正前方和 N01/N02/N03 的 home 点均有约 0.757m 的平台支撑，但从地面脚高 0 的玩家胶囊查询均 `blocked=true`（见 `artifacts/r2-independent-camp.json`）。原步行 `playable/src/mobility.mjs:215-221` 在未抬升时走 `collides()`，需要集成代理以真实地形和 `movePlayer` 路径确认能上台阶、到 NPC、穿过指挥与医疗门洞。单点探针不能证明实际路径必定失败；当前营地仍在集成，本项不是最终阻断结论。
3. **营地与动态坐标接线待完成。** 初审时 `main.mjs` 尚未创建 `createCampV2Scene`；`progression-quests/runtime.mjs:8` 预留 `npcPositions`，当时 `main.mjs:165` 未提供；N02 授权与 near 仍用静态 `PHYSICIAN`。实现代理已确认这些是正在处理的半成品，不计入最终缺陷，完成后应由下一轮独立复验。

## 旧测试与本轮区分

- `node --test playable/tests/planet-gameplay.test.mjs playable/tests/planet-gameplay-r2.test.mjs` 当前 12/21，通过日志为 `artifacts/r2-independent-old-flight.tap`。九项失败主要断言旧 12m/s 近地速度、30–300km 轨道高度、旧加速度或未达元婴也可解锁，和本轮 2km/48–420m/s/元婴门槛不同；另有旧夹具在着陆时要求浮点位置严格等于 0。不能把这些旧断言当成本轮通过，也不宜用其直接判定本轮飞行回归。
- 对话/场景/任务组合 CPU 测试当前 15/18。失败的两项 `quests.test.mjs:68,80` 仍用旧 N01 `(-9,188)` 授权位置；`scene.test.mjs:28` 仍要求动态 NPC 本体生成可站立顶面，而新的活动胶囊只负责侧碰撞。它们与 R2 营地坐标及碰撞设计不一致，须由实现代理更新测试期望后重跑。此前 `NPC-DIALOG-R2.md` 的 18/18 是坐标变更前的结果。

## 必须实机验证

在最终接线及受控构建后，独立于实现代理检查：30m 与 2000m 持续 W 的真实位置/速度、四向转弯和悬停；V 双视角的角色大小、下缘手部、尾迹遮挡及地表空白；三栋建筑从地面上台阶、开门、进入、NPC 活动与碰撞同步；任务/医师/商店交互判定跟随实时 NPC 位置；对话在大、中、小及矮视口的中文、滚动、关闭按钮；帧时、draw calls、跨区加载、保存重载与原六公里玩法。
