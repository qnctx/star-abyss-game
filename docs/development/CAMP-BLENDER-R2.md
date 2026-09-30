# 营地 Blender 建筑 R2

## 来源与交付

本片以 `docs/art/camp-v2/camp-architecture-reference.png` 既有生成参考图为起点，审看后用本地 Blender 5.2.1 建模；未再次调用生图或付费 Lux3D。模型以折角压力舱、灰白陶瓷面板、露出结构肋、橙色识别带、红十字、开放气闸、平台楼梯扶手、屋顶通信设备与工坊遮棚柜台对应参考图。

资产位于 `playable/assets/camp-v2/`：每栋包含可编辑 `.blend` 和嵌入 PBR 材质的 `.glb`，`manifest.json` 提供运行时坐标、墙体碰撞盒、入口净空、可步行地板和建议布局。没有外部贴图依赖。Blender 原文件保留独立命名部件，运行时按材质归并为每栋 8 个网格。

| 建筑 | 三角形 | 网格/材质批 | GLB 字节 |
| --- | ---: | ---: | ---: |
| command 指挥任务站 | 7,712 | 8 | 430,996 |
| medical 医疗站 | 7,324 | 8 | 408,372 |
| workshop 工坊商站 | 9,680 | 8 | 533,160 |
| 合计 | 24,716 | 24 | 1,372,528 |

## 集成约定

- 单位米。GLB 为 Y 向上、正 Z 朝入口；建筑原点在地面中心。所有坐标均为局部坐标，布局旋转时同步变换碰撞和入口点。
- 指挥站与医疗站中央门洞实际开放，净宽 1.89 米、高 2.33 米；使用 `collisionBoxes` 拆分墙体才能进入内部。`bodyCollision` 仅供远处粗略阻挡/范围判断，不能用于可进入建筑的精确碰撞。
- 地板高度约 0.79 米，入口门槛顶面 0.87 米；前平台顶面 0.74 米。四级台阶抬升至平台，运行时需启用相应台阶/表面高度处理。`entrance` 为交互锚点，不是玩家脚底高度。
- 工坊为开放服务柜台，面向外部平台交互；柜台本体有碰撞。内部设备、展示货物不代表新增交易功能。
- 建议布局仅提供参考，集成应保留原任务、治疗、交易与保存逻辑，并避免覆盖六公里月面原场景。

## 验证与复现

1. CPU 建模导出：`D:\blender\blender.exe --background --factory-startup --python-exit-code 1 --python tools/art/camp-v2/build_camp.py`
2. CPU 重新导入检查：`D:\blender\blender.exe --background --factory-startup --python-exit-code 1 --python tools/art/camp-v2/verify_camp.py`。已通过三栋 GLB 重新导入、有限顶点、无零面积面、三角/网格预算一致；详情在 `docs/art/camp-v2/verification.json`。
3. 已在总控批准的独占时段执行 `tools/art/camp-v2/render_camp.py`，渲染为 `docs/art/camp-v2/camp-blender-preview.png`，制作代理和总控均已审看。斜肩舱体、门窗、开放入口、台阶扶手、医疗标识、屋顶设备、工坊遮棚柜台完整可见；这是轻量风格化游戏模型，未宣称照片级做旧材质复刻。游戏内视觉与通行验收仍待集成后完成。
4. 集成后逐栋从正面接近：检查阶梯与扶手可见、入口路线无遮挡、指挥/医疗交互触发正确、工坊柜台交易沿用现有业务。以游戏截图和实际移动完成最终验收。

本片仅新增资产、资产构建/校验脚本和文档；不直接修改游戏生产源码。
