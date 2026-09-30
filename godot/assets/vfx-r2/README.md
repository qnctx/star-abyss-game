# R4 气刃 R2

参考图 `reference.png` → 本机 Blender `build.py` → `source/qi-blade-r2.blend` → `qi-blade-r2.glb` → `../../scripts/native_vfx_r2.gd`。

四层渐细弧面、UV 羽化加色、无深度写入；手前生成、沿瞄准方向释放。可用 `launch_toward(origin, target, contact_time)` 与现有伤害接触时刻对齐，`impact()` 提前结束飞行并淡出。

R6/R7 的 `qi-domain-r2.glb`、R8 的 `qi-fracture-r2.glb`、R9 的 `qi-dao-r2.glb` 已从同一参考派生并由 Blender 制作，源文件在 `source/`。统一 `launch_tier(realm, origin, target, contact_time)` 接口；R4 原接口保留。高阶效果固定在命中目标处，全部采用透明细线/开口结构与近镜头淡出，不替换瞬移门。

旧高阶材料审计在 `legacy-audit.json`：原 R6/R8/R9 材质均 OPAQUE，宽约 3.8–5 m。新源造型不超过约 3 m，只有薄的曲面条带，无不透明中心；游戏中高阶子网格使用 1.4/1.5 倍尺度、上提 0.9 m，避免在低位命中点埋进兽身/地形。权威目标位置不变。完整世界主视角及侧视最终证据在 `evidence/full-world/11-*.png`、`11b-*.png`；未采用关闭深度测试的诊断方案。

24 张 R4 与 72 张高阶 Godot 原生时序截图及三视角总表在 `evidence/`；完整集成说明、命令、手测步骤和未完成边界见 [动作 R2 说明](../motion-r2/README.md)。主场景由 Sol 接入并验证，完整真实输入手感仍需最终试玩。
