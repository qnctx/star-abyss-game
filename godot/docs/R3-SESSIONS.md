# Godot R3 并行开发

状态：2026-09-27 已实现并完成已测闭环验收，范围及已知异常见 reports/r3-independent/FINAL-REPORT.md。所有会话使用 3ff0 工作树，保留旧存档及无关改动。

| 会话 | ID | 独占范围 |
|---|---|---|
| 飞行 Sol xhigh | 01a0e2f8-5ea2-7bc1-ae21-bee4e277b08f | native_player.gd |
| 人物动作 Astra | 01a0e2f8-e1b2-7843-9b59-d377f5546934 | motion-r2、native_motion_r2.gd |
| 武技集成 Sol xhigh | 01a0e2f8-e610-7ff0-9afd-ce0eeab889a1 | native_main、native_ascension、r3-combat-contract.md |
| 武技特效 Astra | 01a0e2f9-7671-7f30-a069-60a18bea6675 | vfx-r3、native_vfx_r3.gd |
| 野怪 Astra | 01a0e2f9-7c8a-75d0-9a1a-67d9cdf6559d | native_riftwing、enemy-r3、独立enemy模块 |
| 独立验收 | 01a0e2fa-05e4-7050-9c6e-587cc0e72f4c | reports/r3-independent及独立测试 |

初步诊断：飞行航向忽略鼠标俯仰，Shift+C无加速；走路参考速度0.88m/s与6.8m/s跑步跨幅过大；人物武技共用推手，R2特效缺少持续骨点绑定。以上为代码诊断，不代表已修复。

接口由武技集成会话维护，动作提供释放帧与骨点，VFX消费同一事件，野怪使用统一受击/格挡/击飞契约。最终以真实物理帧、正常速度和主场景双向对打验收。

本轮最终全部沿用匹配的既有生成参考图完成本地Blender制作，新增生图/付费3D调用为0。先前最多3张申请没有执行，不作为后续费用授权。

验收步骤：重启本工作树Godot入口；验证走跑速度与脚底匹配；R起手/释放/命中/收势及Space仅跳跃；G起飞后鼠标抬头低头+W与Shift+C；分别与地面普通兽和地空精英对打，检查预兆、闪避、格挡、击飞、返巢和掉落。发布前不得将这些步骤写为已经全部通过。
