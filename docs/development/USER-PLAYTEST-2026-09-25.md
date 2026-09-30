# 2026-09-25 用户实测反馈与独立审计

范围：正式项目 `E:/myProject/star-abyss-game` 当前 4173 测试版。此报告依据用户五张截图、源码只读检查和 HTTP 入口探测。未运行 GPU 帧率基准，未改生产代码或存档。

## 原始截图与用户要求

1. `C:/Users/HUAWEI/AppData/Local/Temp/codex-clipboard-13850619-6832-4324-8585-bef5fe877811.png`：第三人称飞行姿态僵硬、像手脚喷射，角色很小；地表与天际画面空泛。用户要求飞行图片与 3D 重做。
2. `C:/Users/HUAWEI/AppData/Local/Temp/codex-clipboard-5097284a-9341-42e3-91c9-161ce1fe96e1.png`：许衡对话面板贴底，占据大面积视野，顶部的世界空间「许衡 · F 交谈」标签近距离放大到挡屏。用户要求对话框居中。
3. `C:/Users/HUAWEI/AppData/Local/Temp/codex-clipboard-aa653770-d0ac-44db-b188-ae612b9e0629.png`：NPC 在裸地近距站桩，营地缺建筑。用户要求拉开 NPC 距离、能自然活动、建筑用 Blender 做真实 3D。
4. `C:/Users/HUAWEI/AppData/Local/Temp/codex-clipboard-205f83c1-374f-44c1-9ec4-117dab3d5479.png`：F2 倍速菜单现有 0.25/1/2/4，用户仍觉得飞行慢。
5. `C:/Users/HUAWEI/AppData/Local/Temp/codex-clipboard-764785f5-3559-4f2f-9cf5-0d19ee91ee05.png`：第一人称双拳占据两侧大面积画面，飞行视角异常。用户要求第一、第三人称飞行都重做，并优化卡顿。

## 独立只读 QA 定位

- 任务 NPC 对话 `playable/src/progression-quests/ui.mjs:5` 与苏禾对话 `playable/src/foundation/camp-ui.mjs:9` 均固定 `bottom:18px; max-height:62vh`。验收应检查屏幕中央位置、内容滚动、中文无截断、关闭按钮始终可点。
- 巨大的近距提示来自 `playable/src/progression-quests/scene.mjs:11,21` 世界空间 Sprite；需近距尺寸上限并在对话期间隐藏。
- 四名任务 NPC 坐标在 `playable/src/progression-quests/data.mjs:1-6` 的 x -12..12、z 186..203 区域内。`scene.mjs:25` 只做头胸手摆动和看向玩家，根位置不移动；苏禾 `foundation/camp-scene.mjs:45` 也是原地动作。NPC 活动验收要观察工作/巡走/交谈等有边界动作，并确认不穿建筑、不堵入口。
- `playable/src/planet-runtime.mjs:249` 飞行第一人称因 `!firstPerson || high` 强制显示完整角色，存在镜头穿模风险。第三人称 `planet-gameplay/flight.mjs:29` 相机距离从 4.3 米到 9 米，`planet-runtime.mjs:247-254` 每帧直接重设相机，无过渡。需分别测试升降、转向、V 切视角和接地。
- `planet-gameplay/flight.mjs` 近地水平 12 m/s，500 米高度约 80 m/s；爬升约 8 到 60 m/s。速度感应从实际飞行曲线、相机和地表参照物联合评估，不只调 F2 倍速。

## 独立只读性能审计：待实测假设

- `playable/src/layout.mjs:47` 盆地地面 600×600 分段，约 72 万三角；`scene.mjs:153-180` 建地面分块，同时 `planet-runtime.mjs:238-240` 保持行星地形，`planet/scene-adapter.mjs:69-70` 以片元 `discard` 掩罩旧区域；`scene-adapter.mjs:81-82` 最多遍历/提交 192 个行星块。是否为瓶颈仍需 draw calls/triangles 与帧时数据。
- `scene.mjs:95-100` 月光阴影为 2048²；`scene.mjs:515-516` 第一人称另渲染 handsScene。
- `planet-ecology.mjs:38-84` 在每 16 米位置或地形版本变化时清空并重建 InstancedMesh，飞行移动可能产生分配/GC 尖峰。`planet-runtime.mjs:31-35` 流式地形每显示帧预算 3ms；`scene-adapter.mjs:72-83` 新块加入时重挂地形。`main.mjs:698-717` 慢帧后补模拟、`main.mjs:201-216,647-665` 约 80ms HUD 更新可能放大卡顿。均为待验证线索，不能直接断言根因。
- 采样建议：R4 同一设备和分辨率下，营地静止、低空飞、2km 飞、V 切双视角各 20 秒；读 `main.mjs:718-720` 的 `canvas.dataset.performance`，记录 avg/p95/p99、超过 33ms 帧数、draw calls、triangles、pixelRatio，并结合 Chrome Performance 主线程 long tasks。优化不能损失原六公里月球地图、载具、调查与存档。

## 当前交接状态

- `test-lab.html`、`quest-lab.html`、`star-abyss.html` 均实际 HTTP 200；`start-test-lab.cmd` 已恢复服务并验证健康时不会重复启动。
- 营地三建筑概念参考图：`E:/myProject/star-abyss-game/docs/art/camp-v2/camp-architecture-reference.png`。尚未 Blender 建模或接入游戏。新/重做 3D 必须由参考图出发，再建模、接入、视觉验收。
- 测试操作文档：`E:/myProject/star-abyss-game/docs/development/TESTING-GUIDE.md`。
- 本 session 与两名审计代理已结束只读检查；没有打开浏览器自动化或 GPU 测试，4173 页面与正式/测试存档未被本轮操作更改。可由总控接手安排。
