# 星球总控交接 · 2026-09-16

## 最新用户要求（最高优先级）
初始世界是足够大的完整星球：海洋、陆地、山脉、森林、沼泽、江河、平原、悬崖。相邻大区域不能站在地面一眼看尽，沿途自然、连续地过渡；高阶飞行升到足够高度能看到大陆与完整星球。不要把不同地貌硬拼成小展台。原紫色星空、环形星球、角色、载具、任务与存档延续；当前荒凉盆地只应成为星球中的一个区域。所有新增或重做的 3D 先生成对应概念图，再建模实现。用户要求多个可见任务并行，并迁移至新的总控。新总控负责持续推进，不止交付规划。

## 工作区与安全
- 实际最新主项目 E:/myProject/star-abyss-game，Git 大量脏改和未跟踪文件，绝不能 reset、全量覆盖、随意提交。
- 旧总控工作区 C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game，工具脚本在其 artifacts/。
- 新 worktree 默认分支缺少大量当前成果，先从主项目只读检查和复制必要基线，在自己的目录修改；交付精确文件清单和哈希，由总控集成。
- 优先 cmd.exe。各任务先读主项目 AGENTS.md。阶段完成同步相关文档并给验证步骤。
- 4173 为用户原试玩入口，保留存档，不关闭或替换成白盒。4186 是旧总控候选预览，非正式交付。

## 已完成但尚未正式发布的第一章 R4
主项目源代码已有地图、岩壁和怪物响应改进，但 playable/game.js 仍为先前版 SHA 0875ddec709488787d1abc6aa065e02c5ee2c04df839f29feee88209f8baa0e6。
最新完整冻结 artifacts/deliveries/PHASE1-R4，141 文件，候选 game.js SHA 19b29a055653cbe0b8732cd73f9eadfa21c2654c01894f95d038f52f6f64737d。R3→R4 仅 phase1-terrain.mjs 两行和 bundle 变化（坡面更陡、峡谷更近）。不等于完整星球已经实现。

### 第一章成果
- docs/art/environments/phase1-v1/map-concept.png 已实际生成；BRIEF.md 记载图片优先流程。
- playable/assets/environments/phase1/basalt-albedo.png 已实际生成并接入。
- phase1-terrain.mjs：山脊、台地、陨坑、路线/船舱/采集清场保护；layout.mjs 缓存精确三角地形高度。
- phase1-geology.mjs：真实纹理三平面采样与分层岩面。
- phase1-outcrops.mjs、rocks.mjs、rock-render-chunks.mjs：7 处真实网格岩壁，共4032三角形，碰撞和支撑与网格一致。
- camera.mjs 修复相机穿新岩壁；AI 在 expedition-runtime/index.mjs、creature-ai.mjs：即时追踪、有限转向、听觉/视觉/受伤感知、3秒记忆、绕障、视线攻击门控。保留 .85 秒前摇和 1.1 秒恢复，攻击方向锁定可躲避。
- 不需重新付费生成怪物。既有 GLB 9MB、35967三角、20骨骼，已集成。

### 验证与边界
- 主项目 reports/TEST-PHASE1-R3.md 已归档；对应原生独立任务 01a0a9eb-c8c1-77b1-9939-67f73eeddbbb，工作区 601e。报告 SHA 8ce80e12daf6d1cf2bb4aba21a5e5fb8e8619d9816dff19e61a8239b5ca15bad。
- R1/R2/R3 连续原生第一章完整任务链、终端错误/正确顺序和刷新、黑匣子返营、怪物追击/躲避/击杀、掉落不重复、采集/仓储/死亡救援/刷新存档均通过。不是完整全游戏验收，也不是单独 R4 从头到尾原生重跑。
- reports/TEST-PHASE1-R4-PHYSICAL.md：独立物理 PASS，26965帧第一章往返、6469网格支撑/相机样本、168 LOS、107旧穿模点按新岩顶重投通过。此为 Node 几何/逻辑，不冒充原生试玩。
- R4 另有可见独立原生任务排队/运行，clientThreadId client-new-thread:9f6ad243-d26f-452b-a8e1-f411bff08658，标题 TEST-PHASE1-R4 岩谷地形独立复核。需查到正式 ID、等待报告，禁止假定完成。仅做地形300米/相机/可选陨坑，继承未变的 R3 玩法验证。约定自有端口7588。
- 根自动回归100/100、载具物理37/37；最后 R4 physical TAP 在 artifacts/phase1-preview/r4-physical.tap。不要宣称照片级或概念图逐像素匹配。

## 旧总控工具（未发布）
旧工作区 artifacts/publish-phase1.cjs 接受 reportPath reportSHA PHASE1-R4，核验冻结/主项目源/旧bundle后才精确拷贝，并生成 INTEGRATED-PHASE1-R4.json。脚本尚未运行。
artifacts/check-phase1-live.cjs 输出文件名仍写 R3，使用前改成 R4。核验4173 HTML、bundle、玄武岩图和怪物GLB实际HTTP内容。
artifacts/backups/phase1-20260916 有发布前备份，不能当完整整个脏工作区备份。
旧总控候选 server4186 session34681，可收尾关闭；用户4173必须保留。旧总控 CUA 自有 tab5 可关闭，用户 tab3 保留。新的总控先确认实际浏览器状态，不盲用这些 ID。
待更新 HANDOFF/TASKS/CONTROL/PROGRESS/ORIGINAL_GAME_PLAYTEST 以及 PHASE1-MAP-IMPLEMENTATION 与 BRIEF 的 R3 待验描述。

## 新星球阶段组织
并行任务分为星球尺度/流式地形架构、图像先行的生态地貌美术、地面探索到高空飞行的连贯玩法。先读其他任务交付，约定统一种子、单位、星球半径、地貌数据和坐标接口，再整合。星球半径是工程取舍，用户未指定数值，不擅称真实地球尺度已完成。地面尺度、遮挡和大气透视应保证远处生态区不能一览无余；地貌边界用坡度、水文、湿度和植被密度连续过渡；高空LOD/曲率/浮动原点避免突变、抖动、坠落与存档错位。
先完成可验证的连续纵切切片：现有盆地→平原/山麓→河流/森林→湿地/海岸→海洋，远距离加载和高空球体一致；不能用菜单换关、传送或独立小场景冒充连续星球。图片、对应网格、碰撞、资源/敌人生态与实际可玩验证一起交付。新总控应持续完成工作并按切片报告，不止整理文档。
