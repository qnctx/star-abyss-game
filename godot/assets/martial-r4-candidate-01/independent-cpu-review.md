# 候选独立 CPU 审查

结论：数学与骨骼衔接已有明确改善，但候选尚未通过游戏画面验收。只读生产代码；未启动 Godot 或 Blender，未改生产资源、导入缓存。本目录新增报告和纯 Python 采样脚本。

本次最新采样 GLB SHA256：`8a891568aea6fa898bb8296e16cad3da9640e4cd7fcefcafc4f1a18a388769cd`。后续重建必须重新关联哈希，不能沿用本报告数值。

## 参考来源与范围

- `reference.png`、`impact-reference.png` 与先前审阅图的 SHA256 相同。break/cancel 对应 C 行及取消小图；descent/landing 对应 A1–6；新增 descent_cancel 对应 A-EX1。
- 当前产物为十段：地面/空中 break、cancel、descent、descent_cancel、landing。八段旧产物的样本仅留证，不代表当前版。
- 采样直接读取 GLB channels、节点层级与 TRS；网格检查使用原 C2 的 vertices、joint weights、inverse-bind matrices 做 CPU 线性蒙皮。单帧取最近 baked key（landing .18 实际为 .185185），另查全段 landing 的 55 个 baked key。不含键之间插值、游戏里的脚锁定、鞋底修正、相机、shader、地形法线或真实时序。

## 已量化的修复

| 检查 | 当前证据 | 判断范围 |
|---|---|---|
| break 蓄力 .30 | 胸 Y=1.1574；双腕 Y=1.0874；双膝内角约 102.5°/100.7° | 已从旧版手高于胸、约 80°深蹲变为肋旁收掌；背视可读性仍须画面确认 |
| break .30 → cancel 0 | 地面/空中全部节点的 world-matrix 最大差 < 1.8e-6 | 蓄满保持点接续匹配；不代表任意早取消点都匹配 |
| descent .50 | 左右踝 Y=.68/.80；膝内角约 77.1°/98.5°；右腕真实到达肩相对 (-.07,-.20,-.40) | 已有真实收膝和前下方出拳，旧固定目标落在肩后的缺口消失 |
| descent .50 → descent_cancel 0 | 地面/空中全部 52 节点最大位置差 1.81e-6m、矩阵差 2.35e-6 | 已接受、保持在 .50 的取消起点匹配 |
| landing .18 | 膝 Y=.4249/.3651；右腕 Y=.1207；肩腕距离约 .4794m | 右手目标可达，旧右膝关节接近地面的风险已消 |
| landing 左平衡臂 | 左腕相对肩 (-.14995,+.02031,+.29985)m，相对头部低 .03310m；作者坐标 +Z 为后方 | 旧 `3b2a…` 前上举臂缺口已修为后侧平衡姿态；不能代替默认/侧视验收 |
| landing 全 55 个键实际手套 | 左/右手套最低 Y=.56827/.02397m；均无顶点低于 Y=0 | 双手套未穿作者平面；右拳仍有约 2.4cm 间隙，不代替真实接触验收 |
| landing 全 55 个键膝关节 | 左/右膝最低 Y=.42491/.32338m | 未再出现旧右膝靠近或低于平面的问题 |
| 骨架 rest / inverse-bind | 对原 `motion-r2/c2-motion-r2.glb` 的 52 个共同节点，world-matrix 最大差 4.64e-6；51 个 inverse-bind 最大差 4.74e-6 | 均小于 1e-5 浮点重导出阈值，无可测的 rest 改形；并非字节完全相同 |

55°来自骨盆 20°和腰胸 35°的姿态旋转分配，不能直接等同屏幕中头到髋轮廓的倾角。此前带通用 strike/yaw 的版本实际胸部旋转约 54.35°；当前 descent 已消除这些通用项，但仍需以默认、侧视实际轮廓确认参考形态。

## 剩余问题和接线约束

1. **专属取消只能用于已接受的 descent。** 若 candidate 路由仅看 kind，windup 早取消也会进入满坠姿起点。应在写入 `phase=cancelling` 前保留原 phase，只有原 phase 为 `descent` 且保持点有效时使用专属片段。早取消应从当前姿态回飞行。现生产仍播放普通 `cast_martial_cancel`，当前 GLB 指纹通过不等于产品已经接通。
2. **尾帧回飞行仍未做完整衔接验收。** descent_cancel 终点是本脚本的 hover/ready 姿态；它与当前速度对应的 cruise/boost 姿态之间仍依赖 Motion 的现有混合。指纹检查只覆盖起点，不证明终点在真实飞行下连续。
3. **鞋底残余需运行时验证，不能报告全身不穿地。** landing 吸收峰值左鞋最低约 Y=-.00413m；全 55 键最低是 t=.25s 时 Y=-.00521m，来自左鞋踝区域，10 个顶点低于平面。原 C2 rest 对照最低约 -.00031m。当前不是右膝或手套穿地，但脚锁定、sole settle 和斜坡上的结果尚未验证。

## VFX 映射与默认背视假设

新增 charge 细流从局部 X=±.46、Z=+.25 延伸到 X=±.14、Z=0，UV 顺序结合现 shader 流向可读为肘外侧向掌心汇入，参考 C 来源合理。网格只锚定双掌中点并按 aim heading 朝向，**没有绑定两肘**；源码注释中的“跟踪肘部”和“不会到脊柱后方”尚不是实际保证。

候选 `native_vfx_martial_candidate.gd:50` 已使 break 的 X scale 始终为 1，仅 Y/Z 从 .45 增至 1。细流中心线的横向范围因此从起步就保留约 .92m，修正了旧统一 .45 缩放导致宽度仅约 .41m 的问题。这是合理的背视可见性假设，但仍无肘部骨骼锚定，不能保证细流不穿躯干；descent 仍统一 .55 缩放。Blender 材质会被运行时 material_override 替换，CPU 渲染里的实心蓝翼或高亮不能作为成品依据。

候选 shader 的 `flow_direction=-1` 确实反转了正弦亮度纹理的行进方向；尚未实现几何路径向外展开。现 .14s 生命周期内反向移动约 .063 个 UV 长度，同时几何继续乘 `1-8*delta` 向掌心缩小，是否能看成参考 C 的松散退气仍待正常速度画面判断；取消会把 phase_age 清零，纹理相位也会重置。**已接受 descent 的 charge 已被 release 隐藏，cancel 又隐藏 projectile，未重新显示任何退气几何**，所以这一分支仍无可见细流消散。此项在接线说明中已承认，不能将 shader 反向参数等同于完整取消效果。

上述候选 GDScript/shader 只做文本静态核对，尚未 parse/import/游戏运行；本目录 `.gdignore` 未动，生产保持冻结。

## 辅助预览核对

`preview.py` 已清理原 Armature animation_data、附加 actions、绑定 action 与首 slot，再调用 frame_set；只读未发现确定的 Action 绑定错误。最初“手靠面、像悬空深蹲”的画面与旧 GLB 的 pelvis=.625、chest=1.052、wrist=1.17 完全一致，主要由旧绝对手目标和过度下沉造成。无地板参照也会增加悬空观感。已载入旧 blend 的渲染进程不会自动获得后来重建的 action，旧图必须单独标识。

量化证据见 `independent-glb-resample-8a891568aea6.json`。`independent_glb_probe.py` 是可重跑的纯 CPU 采样器；旧样本 `independent-glb-samples.json`、`independent-glb-resample-f6b5d9d083f5.json` 与 `independent-glb-resample-3b2a118af07e.json` 仅保留变更前证据，尤其旧 3b2a 的左臂问题已修复。

复核步骤：在工作树根目录用现有 Python/numpy 运行 `python godot/assets/martial-r4-candidate-01/independent_glb_probe.py`，核对输出 SHA、四组取消起点差、52 节点 rest/51 inverse-bind 差、55 个落地键的手套/身体最低点。之后由控制器在独立引擎窗口验证默认及侧视正常速度的蓄力、已接受取消、早取消、回飞行、落地脚底及拳地间隙；本报告未执行后半段。
