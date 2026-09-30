# R9 空中动作资产

按先图后模型流程审看 `reference.png` 后制作；参考原图也保留在资产目录。全部使用现有 C2 三个蒙皮网格与原材质，未替换角色、未用占位人形。

## 交付与接口

- `playable/assets/air-combat-r9/air-combat-r9.blend`：可编辑双骨架源。`Canonical_AirCombat_Driver` 保存19骨标准动作；`C2_Native_AirCombat_Skin` 保存游戏真实重定向逐帧烘焙的原角色动作。两者各有八个独立Action和保留的NLA轨道。
- `air-combat-clips.json` / `.mjs`：运行时标准骨架关键帧数据，局部Y向上、前方-Z、四元数XYZW，骨骼顺序严格匹配 `HUMANOID_RIG`。
- `native-clips.json`：每动作101帧的原C2重定向烘焙结果，用于Blender蒙皮复现，不需要加载到游戏。
- `playable/src/air-combat-pose.mjs`：`createAirCombatPose()` 创建可复用输出；`sampleAirCombatPose(clipId, progress01, out?)` 采样标准骨架；`AIR_COMBAT_CLIPS` 给出loop、peak与骨骼数量。调用方拥有时序、混合、位移、命中和资源逻辑。

动作ID：`hover`、`boost`、`left-jab`、`right-cross`、`rising-kick`、`air-guard`、`impact`、`launch`。三种攻击在0.45达到完整伸展，1.0回收；实际接触时刻映射至0.45。悬停/加速/格挡可保持或循环。受击与击飞只有姿态，不把真实角色位移写入动画。

## 姿态与验证

加速由骨盆约-80°的全身倾斜带动，脊柱、髋与腿沿飞行方向排列，双臂向后收；头部只作视线补偿。真实native关节检查：头比髋高0.108米并位于前方0.662米，双脚在髋后约0.79米，头视线约 `[0,-0.105,-0.994]`，不存在仅头俯冲或头翻到髋下方的问题。

出拳使用躯干拧转、出拳侧肩前送与肩关节方向补偿，拳朝角色-Z前方伸展，另一手护脸。起脚右腿抬高、左腿回收；格挡双前臂向胸面收拢并收膝；受击张臂后仰；击飞身体整体后倾，真实轨迹由战斗逻辑决定。

`verification.json` 记录808个采样结果：19骨顺序一致、有限/归一化四元数、三攻击接触点及回收一致、近水平加速、直腿后随、视线朝前、双拳前伸、右脚高过髋。`native-joint-checks.json` 是真实游戏重定向输出的关节位置，不是渲染估计。

CPU渲染接触表为 `air-combat-contact-sheet.png`，八张单姿态图以动作ID命名。渲染使用的是原C2皮肤及游戏 `createCharacterRetarget()` 烘焙结果。游戏内镜头、过渡混合和接触时序仍需集成验收。

## 复现步骤

1. `D:\blender\blender.exe --background --factory-startup --python-exit-code 1 --python tools/art/air-combat-r9/build_actions.py`
2. `node tools/art/air-combat-r9/bake-native.mjs`
3. `node tools/art/air-combat-r9/verify-actions.mjs`
4. `D:\blender\blender.exe --background --factory-startup --python-exit-code 1 --python tools/art/air-combat-r9/save-native.py`
5. `D:\blender\blender.exe --background --factory-startup --python-exit-code 1 --python tools/art/air-combat-r9/render_sheet.py`

所有制作、烘焙与渲染均为本地CPU流程，未调用付费生成或GPU。没有修改现有flight模块、avatar模块或玩法。
