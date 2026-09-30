# 营地建筑与 NPC 活动 R2（CPU 接入）

最终浏览器补充：构建 `c0a97648c61807ff35f3ea3883a7c0293dd1c581dbee74f3ee148324f6db4b87` 已从地面实际走上0.88米指挥所平台，五NPC各自步行靠近后F开窗、交谈停步和Q01真实接取均通过；见 `reports/R2-BROWSER-ACCEPTANCE.md`。下文较早“尚无浏览器结论”仅指当时CPU接入阶段。医疗/商站脚本的鼠标锁定点击朝向偏移亦已修正，未改变产品交互范围。完整自然成长链仍未验收。

2026-09-25。三栋建筑采用已审阅的 `playable/assets/camp-v2/{command,medical,workshop}.glb`，落在旧营地安全区前缘（指挥 x=-17、医疗 x=4、工坊 x=20，z=174）。建筑自己的三角面参与墙体阻挡、视线和台阶/平台支撑；没有把整块地形抬高，也没有替换原仓库、N06 训练、F2 返回或存档链。

五名 NPC 在建筑分区内有独立 home/work 点。渲染位置、移动碰撞、F 距离、任务授权共用实时位置；苏禾的医疗 CAS 也从同一实时位置读取。近距玩家和打开的菜单会让对应 NPC 停在原地，避免对话时角色与授权点分离。五个角色都使用交付模型的本地 12 骨蒙皮和短步态，移动速度约 0.22 米/秒；工作位播放局部工作姿态，不把静止模型平移假称为跑步。建筑与 NPC 模型加载失败时暴露 `status/error`，不能把缺失模型当成可验收交互。

`expeditionDebug=1` 的 `window.__ORIGINAL_EXPEDITION__.snapshot()` 现提供可 JSON 序列化的 `campV2.status/error/buildings`、`campScene.status/error/physician`、`progressionScene.npcs[id].position`。这些是只读证据，不增加改存档的测试动作。`artifacts/npc-loop-browser-qa.cjs` 改从该快照读取五名 NPC 实时坐标，并检查三栋建筑在内的十个 GLB HTTP 200；真实采集、战斗、血样、30 秒 MED02 与任务 CAS 断言未放宽。

## CPU 验证

在仓库根目录运行：

```cmd
node --check playable\src\main.mjs
node --check artifacts\npc-loop-browser-qa.cjs
node artifacts\npc-loop-browser-qa.cjs
node --test playable\src\camp-v2\integration.test.mjs playable\src\progression-quests\scene.test.mjs playable\src\progression-quests\quests.test.mjs playable\src\progression-quests\dialog-layout.test.mjs playable\tests\mobility.test.js playable\tests\physical-world.test.js playable\tests\foot-support-independent.test.mjs playable\tests\checkpoint-scheduling.test.mjs playable\tests\flight-r2.test.mjs
```

结果：63/63，通过记录在 `artifacts/camp-v2-r2-cpu.tap`。其中实际解析三栋 GLB，模拟脚步从 z=180 上前台阶到 N01/N02/N03 入口平台并退回地面；N01/N02 沿门轴还能进入，N03 在实体柜台前停止。实际苏禾 GLB 在 CPU 中完成 12 骨重绑，菜单期间位置锁定；N02 的近距显示与 CAS 授权随动态位置改变。Node 无图像解码器，因此该测试会打印纹理 blob 加载警告，不能代替浏览器材质验收。旧岩顶离边重力、车辆、飞行、存档调度和任务事务亦在 63 项内。

## 浏览器独立验收步骤

总控在隔离候选端口构建并运行浏览器。先从正常开局检查仓库与 N06 训练装置仍在，F2 能返营；检查三栋模型、台阶、楼板和门口无穿透，步行可从每栋 z≈180 上前台阶至 NPC 的 F 距离，从侧墙不能穿入。等待约 12 秒观察至少一名 NPC 从 home 到 work 的腿部步态与局部工作姿态；走到其近处应停步，对话开关期间 `snapshot()` 的位置保持不变。分别在 N01、N02、N03 对话，核对对话框内容、关闭按钮、交易/任务动作与实际授权距离；从建筑外墙反侧不能越墙 F。检查 `campV2.buildings` 三项 `ready`，`campScene.physician` 与屏幕上的苏禾同点，`progressionScene.npcs` 的位置与模型同点，并可 `JSON.stringify(snapshot)`。

任务完整闭环按 `LOOP-RECOVERY-R2.md` 的一级与十级夹具分开做；十级夹具通过不能替代一级自然成长。当前这一文档记录的是 CPU 接入，尚无浏览器/GPU 整体验收结论。

## 候选同步记录

本片最初“可构建”信号后，宽 CPU 回归抓到旧岩顶离边重力断言；随后仅在 `playable/src/mobility.mjs` 恢复原离边阈值并把台阶预支撑限定为实体建筑 provider。该阶段 mobility 源码 `git hash-object` 为 `3106fdfbe990f298b937281e60b5097f09bf37f0`，其后又经历下述实机入口修复；各候选必须以构建时的源码哈希对应画面。

## 实机入口失败后的限定修复

总控 4180 候选 `artifacts/r2-integrated-browser/report.json` 实测：从 N01 门前 x=-17,z≈181 按 Ctrl+W 约 13.2 秒，脚高曾到 0.24m，却回落到地面并停在 z≈179.09，距 N01 超出 F 半径；N03 也未能从真实步行路线接近。该候选的浏览器入口验收失败，不能沿用本页先前的 CPU 可达性结论当作实机通过。

复核模型三角面：z≈179.09 的脚下中心支撑仍为地面 0，前方半径处是约 0.382m 的真实台阶；脚高 0.22–0.24m 在该点本可清除侧碰撞。旧 `mobility.mjs` 用当前速度决定前方支撑，并要求当帧成功移动才保持抬脚。`movePlayer` 一帧碰撞会把速度清零，使抬脚失去前瞻并回落，随后反复撞同一级台阶。现改用按住的输入方向和身体 heading 探测真实建筑支撑，单帧阻挡后仍可维持抬脚重试；没有放宽 F 距离、挪 NPC、抬全局地形或允许穿侧墙。

新增 CPU 回归用实际三栋 GLB，在 1/60 与 1/120 秒下主动制造一帧侧阻挡，检查 y≥0.2m 且继续持键最终到达 y>0.7m、z<177.8；另从建筑侧墙朝墙走 5 秒，确认仍被挡且未爬墙。原来的岩顶离边、车辆、飞行、任务测试一并重跑，共 64/64，通过记录仍为 `artifacts/camp-v2-r2-cpu.tap`。N01 的根 y≈0.807m 与入口平台 0.757m 相差约 5cm，是实际室内地板高度，NPC 重绑网格的脚底在根 y=0；不是取了柜台或屋顶。

最新 mobility 源码 `git hash-object` 为 `4f053a51de7c8c7a5d59b609c8ce19a5c3b93dd2`。此修复尚未由浏览器复验；总控需统一重建候选后重复上述 Ctrl+W 入口、N01/N03 F、侧墙、岩顶离边路径。旧 bundle SHA `bc7159873fecef9ab3721bb9d18935d076f0e6b2aadc726905afc689fcece619` 对应失败画面，不能作为新修复证据。
