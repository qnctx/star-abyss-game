# C2 步态 R5 — 新图先行，概念审查阶段

用户再次否定R4走跑视觉。本轮先完成明确授权的两次内置imagegen，未新增第三次、未调用付费3D，尚未改产品GLB或驱动。

## 新图与制作门槛

- [步行原图](concept-walk-r5.png) / [实际提示词](prompt-walk.txt)
- [跑步与冲刺原图](concept-run-sprint-r5.png) / [实际提示词](prompt-run-sprint.txt)
- [可点选图板索引](concept-index.html)保留原图，标出局部采用/相位排除、左右骨骼交换及phase表。
- [逐项概念审核](CONCEPT-REVIEW.md)：两张图均有明显完整周期错误，不能宣称整图通过。独立会话也确认这些问题。

总控已要求先列准缺失姿势，并向用户申请一张针对性补图。缺口为真正脚跟接地、低位步行经过、冲刺身后收跟到软膝落地的关系。新增调用必须等总控转达授权。已能确定的有效局部姿态和非图依赖工具可准备；不使用明显错误序列强凑完整3D成品。

## 真正运行时蒙皮深度基线

`skin_depth_probe.gd`使用[Godot 4.6原生bake_mesh_from_current_skeleton_pose](https://docs.godotengine.org/en/4.6/classes/class_meshinstance3d.html#class-meshinstance3d-method-bake-mesh-from-current-skeleton-pose)，在实际`RenderingServer.frame_post_draw`后烘焙全部5个带皮肤网格，扫描每样本91207个真实变形顶点，经MeshInstance全局矩阵转世界坐标，与角色脚原点平面比较。没有用踝代理点或暂停后手动推进假物理。API会发生GPU读回停顿，因此不把深度采样录像冒称完全流畅。

旧R4产品：GLB`942f372de11641e9c8189f2aef39ed68956e4eed1d54bd14243cb86f022e2430`，驱动`95d3a7df91e2dfe5128fd0a649c0e8696457f4d8dd07f178374a4018dabb78c6`。

自动物理442帧，7.3667物理秒 / 7.5204墙钟秒，time_scale=1，66次全网格样本：

| 阶段 | 实际蒙皮最低点相对平地 |
| --- | --- |
| idle | -0.031cm |
| walk | -3.992cm |
| jog | -1.265cm |
| sprint | -1.857cm |
| stop | -1.073cm |

证据：`evidence/baseline-skin.json`和`baseline-skin-summary.json`，包含物理帧、实际delta、墙钟、phase、最低mesh/surface/vertex及世界坐标。这是角色根平面的平地夹具，不是球面terrain collider净空；后续实际场景必须另用真实支撑面/径向法线验收。

`inspect_lowest_skin.py`定位到原网格鞋底顶点：walk最深顶点5779，ankleR50.42%/kneeR49.58%；jog/sprint顶点44706，ankleL51.07%/kneeL48.93%。这解释了旧版100%踝代理鞋底为何漏掉约4cm穿地。`evidence/lowest-skin-source.json`保留来源。

`full_skin_contact.py`仅是为后续Blender制作准备的完整蒙皮接触校准模块，尚未集成或宣称完成修复。它按实际足部全部网格顶点求值，设计上不改网格权重或骨骼rest。R4可恢复副本在`../source/gait-r5-before/`。

## 当前可复现步骤

在指定C: worktree根目录：

```cmd
python godot/assets/motion-r2/capture.py res://assets/motion-r2/gait-r5/skin_depth_probe.gd
python godot/assets/motion-r2/gait-r5/snapshot.py
D:\blender\blender.exe -b -t 2 --python godot/assets/motion-r2/gait-r5/inspect_lowest_skin.py
```

浏览图板，依次点03错误经过、HEEL图画反了、SPRINT其余重复，核对说明与原图。最终新增3D、完整正常速度全周期、实际鞋底修复及独立验收仍未完成，不沿用R4限定通过作为R5结果。
