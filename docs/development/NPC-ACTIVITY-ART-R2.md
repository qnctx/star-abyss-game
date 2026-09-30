# NPC 局部短步态 R2

2026-09-25。先查看既有生成概念图 N01/N03/N04/N05-concept-v1.png 与 su-he-reference-v1.png，再在原五个真实 GLB 网格上建立腿部蒙皮。没有新增付费生成、替换人物体貌或修改原 GLB。

## 交付与接入

- `playable/src/progression-quests/npc-rig.mjs`：保留前六骨，新增双侧 thigh/knee/ankle，12 骨局部蒙皮。衣摆中心使用连续左右混合权重，膝踝分段平滑。保留纹理与材质；销毁 rig 不关闭源 GLTF 共享纹理。
- `playable/assets/camp-v2/actors/camp-step.mjs`：Blender 构建脚本生成的 48 帧腿部动作，完整周期位移 0.32 米，支撑阶段脚在角色局部匀速后移，摆动阶段抬脚约 3.5 厘米。
- `playable/assets/camp-v2/actors/npc-activity-source.blend`：五个原人物网格、可编辑骨架、各自 49 帧循环 Action。Blender 的苏禾骨骼显示辅助 Icosphere 排除在身高测量和导出内容之外。
- `tools/art/camp-v2/actors/build_activity.py`：离线重建源文件、动作数据与 CPU 渲染，不调用云服务。
- `docs/art/camp-v2/actors/short-step-preview.png`：原五个角色的动作预览。

调用 `createNPCRig(gltf,{height})` 后，由场景负责 `rig.root` 的位置与朝向。每帧调用 `rig.update({dt,time,speed,turn,working,lookYaw,talking})`。speed 为实际平面移动米/秒（推荐 0.22），停止时为 0；turn 为转向弧度/秒；working 在停步时使胸与双臂进入轻工作动作。dt 为秒。速度决定循环相位，停止后平滑回中；方向不通过旋转整个网格来伪造待机。默认 stride=.32 与动作数据一致，接入应保留默认值。

## 已执行验证

`node tools/art/camp-v2/actors/verify_activity.mjs`：加载五个原始 GLB 的真实顶点，CPU 执行 Three.js 蒙皮。五个角色均为 12 骨；每人 4,331–6,249 个腿部顶点移动超过 5 毫米；最大顶点位移小于 0.15 米；无无效权重、NaN；停止三秒后腿骨角度小于 1e-8；工作姿态双臂响应；rig 不改变场景根位置与朝向。结果保存在 `docs/art/camp-v2/actors/cpu-validation.json`。

使用 `D:/blender/blender.exe -b -t 6 --python tools/art/camp-v2/actors/build_activity.py` 构建并查看预览：五个角色比例正常、衣摆连续、交替膝弯与抬脚清晰，原材质保留。

## 场景验收步骤

1. 进入营地，观察四任务 NPC 与苏禾：静止时腿回中；短距离活动时应交替屈膝抬脚，身体与四肢保持完整。
2. 跟随一个 NPC 完成短移、缓转、工作与停留周期，确认实际 speed 与步态一致，原互动仍可触发。
3. 观察衣摆、靴底与地形接触，尤其斜坡和转弯；本片段提供低幅局部步态，不含逐角色人工拓扑重制、地形足部 IK 或布料模拟。坡面接触与场景朝向由集成方继续视觉验收。
