# C2 走路 / 跑步 3D 动作 R6

2026-09-29。本聊天用户在查看四张动作图及逐图缺陷后，明确批准“就按照这个来开发”，授权制作走路、跑步及对应 3D 动画。当前状态：三步态与对应 Blender/GLB 已完成并接入；平地直行工程验证通过，独立结论与未测范围见 [FINAL_REPORT.md](independent/FINAL_REPORT.md)。

> **视觉验收状态更新（2026-09-29）**：另一聊天转述用户不认可当前走跑效果。工程检查结论保留，视觉质量待改进；下一轮必须用参考→真实骨架→同相位游戏实帧及短循环实录对照，见 [视觉缺口与验收条件](VISUAL-ACCEPTANCE.md)。本次审核未修改 3D 或生成新图。

## 范围与图像映射

只重作现有 C2 的 walk、jog、sprint 三个 Blender 烘焙片段及必要的运行时衔接。保留角色比例、网格、材质、蒙皮权重、rest/inverse-bind，以及另 26 个动作。玩法速度保持 1.6 / 6.8 / 10 m/s，世界、车辆、调查和存档不在修改范围。使用本地 Blender，不新增图片或外部收费 3D 调用。

| 动作目标 | 已生成图像依据 | 制作时纠正的图中错误 |
| --- | --- | --- |
| 步行低位过腿、脚跟至前掌滚动 | ../gait-review-r6/01-walk.png 的落脚意图；02-alignment.png 的髋膝脚尖同向与双轨方向 | 补足真正经过支撑踝的相位、左右半周期与摆臂，拒绝画反的 HEEL 和并排足迹 |
| 跑步后收小腿、自然前摆 | ../gait-review-r6/03-jog.png 底部后收腿意图；04-acceleration.png 主图 01/05、04/08 | 不复制重复姿势、错误下一落脚侧或冻结摆臂 |
| 加速后蹬、交替腾空 | ../gait-review-r6/04-acceleration.png 主图 03/07、04/08 | 降低过高抬膝，排除底部错误支撑腿序列，修正落脚前伸 |

图像本身的错误记录保留在 ../gait-review-r6/CONCEPT-REVIEW.md；用户批准制作不把原图改称为整套正确。最终验收对象是导出的真实 C2 蒙皮动作。

## 保全与验证方法

- 作者制作前在 ../source/gait-r6-before/ 保留生产 blend、glb、clips、原构建脚本、驱动和 SHA-256；不以 Git 回退代替未跟踪资产备份。
- 本目录 runtime-baseline.json 记录驱动、Player、Main、project.godot 的切片前哈希；native_motion_r2-before.gd.txt 为驱动副本。
- independent/ 的审计独立求值 GLB 最终每步态 240 个时间间隔，检查实际混合权重鞋底、固定左右分组、足长轴、关节轨迹、环闭合及资产保全。旧版基线已复现约 4cm 步行穿地。
- probe.gd 在真实 Godot 自动物理时钟下运行实际生产模型，分别输出正/侧/背帧和原始/运行时骨骼轨迹。
- skin_probe.gd 在 frame_post_draw 后逐顶点读取真实 GPU 蒙皮，按静止模型固定分组区分左右；这是有 GPU 读回开销的触地检查，不把它当流畅帧率证明。
- world_probe.gd 加载完整场景、独立临时存档，真实物理回调驱动现有地面控制器与碰撞、地形流送。使用合成方向输入，冻结敌人以避免战斗干扰，不冒称真人键鼠试玩。
- assemble_evidence.py 从实际采样时间生成 1 倍物理时间 GIF 和相位图，并读回核对 GIF 时长。

## 交付与验证结果

- 可编辑源文件：[c2-motion-r2.blend](../source/c2-motion-r2.blend)；游戏实际资产：[c2-motion-r2.glb](../c2-motion-r2.glb)。51 骨 / 29 片段，只有 walk、jog、sprint 改动，网格、纹理、权重、rest/bind 与另 26 片段语义一致。
- [交互式 3D 预览](http://127.0.0.1:8766/godot/assets/motion-r2/gait-r6/preview.html)：三步态、暂停、正/侧/背视角、拖动环视。直接读取生产 GLB；Godot 运行时的地面处理和切换另见 [侧面](../evidence/gait-r6/final/all-side.gif)、[正面](../evidence/gait-r6/final/all-front.gif)、[背面](../evidence/gait-r6/final/all-back.gif)原速记录。
- 动作：步行低位过腿、自然软膝、脚跟至前掌滚动；跑步后收小腿、对侧摆臂；加速跑增加前倾和后蹬。三片段烘焙及 Godot 导入均为 120 Hz，按位移驱动节奏，保持玩法速度 1.6 / 6.8 / 10 m/s。
- 运行时：保留水平接触约束，取消旧的脚踝垂直强拉；以 192 个原始混合权重鞋底点对整个视觉模型做微量上移，覆盖步态与 0.20 秒停步过渡，不更改骨长、角色碰撞或玩法高度。最终自动采样最大上移 22.112 mm。
- 最终三视图各 550 个物理帧、271 张实际渲染图，time_scale=1；GPU 检查 57 次 × 91207 顶点，步态样本最低鞋底约 +1 mm，回到原 idle 的最低值约 −0.306 mm。探针/GPU 最低值最大差 0.001408 mm。57 次 GPU 采样不等于逐渲染帧保证。
- 既有适配器回归 1537 个物理记录通过，failures=[]、pending_asset_requirements=[]，含三步态起停及地面/空中术式释放。结果见 ../evidence/gait-r6/regression/report.json。
- 完整场景复核：world-final/604 个真实物理回调，10.067 秒物理时间，10.125 秒墙钟；三档速度达到 1.6 / 6.8 / 10 m/s，正常松开输入依次经过 sprint → jog → walk → idle，另记录了倒退与侧移。使用独立临时存档、合成方向输入和既有地面控制器/碰撞，非真人键鼠试玩。见 [场景记录](../evidence/gait-r6/world-final/all-side.gif)及该目录 side-trace.json。
- 旧 world/ 首次场景记录因场景异步恢复重新开启玩家回调而发生重复更新，没有达到跑速，已作废；修正只在测试夹具完成。candidate1 是被拒的中间版本，均不作为最终通过依据。
- 切片前后 native_player.gd、native_main.gd、project.godot 哈希相同。未覆盖真实存档；原角色、世界、车辆、调查代码保持。详细资产指纹在 delivery-manifest.json。

尚未测定稳定鞋底材料点的水平滑移；坡面、转向及真人操作手感需要实际试玩。本次通过范围是已记录的平地直行与所列回归，不能据此宣称任意场景零滑脚或完美自然度。

## 复测命令与人工步骤

在 C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game 执行。复测用新目录，保留 final 原始证据。python 可使用已安装 Python/Pillow，或本机 Codex bundled Python。

```cmd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --editor --import
python godot/assets/motion-r2/gait-r6/capture.py res://assets/motion-r2/gait-r6/probe.gd --capture --tag=retest --view=side
python godot/assets/motion-r2/gait-r6/capture.py res://assets/motion-r2/gait-r6/probe.gd --capture --tag=retest --view=front
python godot/assets/motion-r2/gait-r6/capture.py res://assets/motion-r2/gait-r6/probe.gd --capture --tag=retest --view=back
python godot/assets/motion-r2/gait-r6/capture.py res://assets/motion-r2/gait-r6/skin_probe.gd --out=res://assets/motion-r2/evidence/gait-r6/retest/skin.json
python godot/assets/motion-r2/gait-r6/capture.py res://assets/motion-r2/gait-r6/world_probe.gd --view=side --out=res://assets/motion-r2/evidence/gait-r6/world-retest
python godot/assets/motion-r2/gait-r6/assemble_evidence.py retest
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://assets/motion-r2/r3_live_probe.gd -- --out=res://assets/motion-r2/evidence/gait-r6/regression-retest
```

预览服务重新启动：在同一工作树运行 `python -m http.server 8766 --bind 127.0.0.1`，再打开上面的预览链接。

1. 第三人称分别 Ctrl+W、W、Shift+W，观察大腿从髋前后摆、膝盖自然伸屈、跑步小腿先在身后折回。
2. 从正面与背面观察脚尖和膝盖方向，左右脚沿各自轨迹交替，检查外八或交叉踩线。
3. 从侧面观察步行低位经过、脚跟落地至前掌推离，以及跑步软膝落地与短暂腾空。
4. 起步、停步、走跑切换后，再试后退、侧移、转向和坡面；检查滑脚、鞋底穿地、突然蹲下、僵直前踢或关节跳变。
5. 回到原有飞行、战斗和驾驶操作，确认动作及功能保留。自动数据与艺术自然度分开记录。
