# 元婴飞行动画与能量尾迹 R2

已审看 `docs/art/flight-r2/flight-reference.png`：保持原太空服造型，悬停时自然垂臂，巡航身体向前倾、手臂轻向后收，转向时躯干倾斜，腕部与脚踝仅保留纤细青色尾迹。未调用额外付费生成。

## Blender 源与运行时接线

`playable/assets/flight-r2/flight-r2.blend` 包含原 C2 角色网格及材质，按 `HUMANOID_RIG` 的 19 个骨骼名称、层级和位置创建可编辑骨架；五组动作分别为 hover、cruise、bank-left、bank-right、land。动作保存在独立 Blender Action/NLA 中，含每关节四元数关键帧和轻微呼吸起伏。

`flight-clips.json` 与 `flight-clips.mjs` 是这些 Blender 关键帧对应的运行时数据；四元数采用局部 XYZW。构建脚本为 `tools/art/flight-r2/build_flight.py`。运行时 `yuan-ying-flight-pose.mjs` 对关键帧做四元数插值，按实际速度、离地高度和 `turnBank` 混合巡航、悬停、倾斜和落地准备，每个 avatar 独立平滑接入/退出。地面步态、战技与载具继续使用原流程。

肩膀旋转由原来的约 1.5–1.74 弧度举臂改为约 -0.10 至 -0.26 弧度轻后收；巡航躯干前倾上限 0.53 弧度，随速度逐渐加入。低空48m/s与高空420m/s均使用真实速度驱动。

尾迹保留腕/踝真实骨骼发射位置，降低为 64 点与 128 个丝带三角、合计2个绘制调用，不增加灯光或贴图。丝带半宽从0.012米减到0.005米；第一人称仅保留12%腕部尾迹贡献并关闭踝部，避免遮挡视线。

## 验证

- CPU 构建：`D:\blender\blender.exe --background --factory-startup --python-exit-code 1 --python tools/art/flight-r2/build_flight.py`，已通过并保存源文件和数据。
- `node tools/art/flight-r2/verify-flight.mjs` 已通过：19骨骼名字/顺序一致、5动作关键帧有限且归一化、肩膀保持低位、左右倾斜方向、平滑入出与实例隔离、VFX预算。
- `node --check playable/src/avatar.mjs` 已通过。
- 已在总控授予的独占时段运行 `tools/art/flight-r2/render_flight.py` 并逐图审看 `docs/art/flight-r2/flight-blender-{hover,cruise,bank-right,land}.png`：完整原C2角色显示低垂手臂、巡航前倾、右转侧倾，未见举拳或明显四肢穿模。`flight-blender-forward-clearance.png` 为源相机前方净空检查，手臂未侵入前方视野；其空背景不能代替游戏第一人称验证。
- 游戏运行时还会应用原C2 native retarget；第三/第一人称升空、转向、松键悬停、落地与细丝尾迹的最终视觉验收由总控在游戏内执行。Blender源渲染不代替游戏验收。
