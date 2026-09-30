# 裂翼 / 裂脊 R3 资产

本批没有新增付费图片或 3D 请求。总控确认可用已生成且与原兽匹配的参考图继续本地 Blender 动作制作。新分镜申请未到达时未生成新图。

| 输出 | 前置生成图 / 原始来源 | 保持与改动 |
| --- | --- | --- |
| `riftwing-r3.glb` | [R11 翼兽生成图](../../../docs/art/creatures/riftwing-r11/concept.png)、原 `riftwing-r11.blend` | 保持原雕刻兽体、PBR、权重、翼膜；重制前爪/翼扫/俯冲，并新增突爪、尾扫、挑空、吐射 |
| `rift-prowler-r3.glb` | [原地面兽生成图](../../../docs/art/creatures/rift-prowler-v1/concept.png)、同源兽体 | 保持原无翼兽体，移除额外翼膜网格；具有地面步态、攻击、受击和死亡动作 |
| `rift-shard-r3.glb` | 同地面兽生成图的矿质肩甲 | 从原雕刻肩甲实际几何截取碎片、闭合断面，断面增加克制紫色微光；不是新造型替代物 |

`manifest.json` 记录生成图 SHA-256、来源与动作时间。`shard-manifest.json` 记录原肩甲截取中心与面数。`rift-prowler-existing.glb` 是原始地面兽的未编辑备份，没动画，运行时使用 R3 版本。`source/` 由 `.gdignore` 隔离，保留可编辑且内嵌纹理的 `.blend`，Godot 只导入 GLB，不需要设置全局 Blender 路径。

复建（在工作树根目录，cmd）：

```cmd
D:\blender\blender.exe --background --python godot\assets\enemy-r3\build_enemy_r3.py
D:\blender\blender.exe --background --python godot\assets\enemy-r3\build_rift_shard_r3.py
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --editor --import
py -3 godot\tests\capture_enemy_r3.py
```

动作使用真实骨骼。AI 持有根位移、碰撞与高度；AnimationPlayer 在同一真实物理帧手动推进。前爪由髋/胸预摆和前臂伸展驱动，尾扫由骨盆、胸腔反向和两段尾骨驱动，翼扫先抬翼再向前下方落，俯冲有收翼/前倾/前爪跟进。接触骨点来自 RF_Foot / Tail02 / Wing_R_Tip / Head，不从怪物中心虚造施法源。

Godot/OpenGL 动作对照在 `godot/reports/enemy-r3/*-windup.png`、`*-contact.png`；独立资产审计确认 R11/R3/无翼体的 Body AABB 与 43275 个顶点保持一致。F2 传送裂翼岭；F3 重置两只试玩对手并返回裂翼岭，重置后再击杀不重复产出掉落。图片验证可见姿态，实际键鼠对打手感仍需按 [试玩步骤](../../docs/ENEMY-R3.md) 实测。
