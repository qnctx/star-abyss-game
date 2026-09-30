# PHASE1 地图实现与联合验证

范围为原第一章与近郊外勤支路，不包含后续章节/经济成长设计全量实现。

先出概念图 docs/art/environments/phase1-v1/map-concept.png，再新增 phase1-terrain/geology/outcrops，接入现有 layout/scene/rocks/rock-render-chunks。没有新付费生成。本次使用可编辑的程序化网格创建3D地质，不把图当作远景平面贴图。

原主线整块平地改为两侧不同轮廓岩岭和凹陷撞击坑；在原路径外添加真实分层崖壁。任务平台、船内结构、旧角色和6km世界保留。渲染和脚下高度都取相同三角插值，岩壁顶部实射线与物理高度误差<1mm的测试通过。原旧石块依旧逐顶点/颜色/拓扑匹配。

主控定向验证：phase1-terrain 3项、physical-world 7项、rock-render-chunks 3项、phase1-outcrops 1项。并行AI开发9项与战斗/存档37项；独立逻辑四组47项及26965帧全章往返（明确是Node夹具，不是原生实玩）。地质WebGL实际编译通过，初稿砖纹问题已纠正。

复核命令：
```cmd
node --test playable/tests/phase1-terrain.test.mjs playable/tests/phase1-outcrops.test.mjs playable/tests/rock-render-chunks.test.js playable/tests/physical-world.test.js playable/tests/creature-ai.test.mjs playable/tests/story.test.js playable/tests/movement.test.js playable/tests/navigation.test.js playable/tests/d3-combat.test.js playable/tests/d3-session.test.js
node playable/tests/phase1-geology-webgl.cjs
```

联合定向100项全部通过。后续R3真实基色纹理单独完成WebGL图片加载编译验证。独立几何审查在R2发现旧相机中心高度上界遗漏部分坡上岩顶；R3修复为实际三角高度和相机半径采样，独立6469采样点及107旧失败案例全部通过，新增固定复现回归通过。

独立原生验收正在独立任务进行，结论另见 TEST-PHASE1-R3.md（未完成前不得宣称全章原生通过）。主控备份 artifacts/backups/phase1-20260916；当前冻结 artifacts/deliveries/PHASE1-R3。R3仅相机/表面纹理/顶点色变化，岩壁坐标和索引未改。


2026-09-16 更新：最终 PHASE1-R4 已发布4173，独立地形有限复核PASS、继承R3未变玩法验证；详见 docs/development/reports/TEST-PHASE1-R4.md 与 versions/INTEGRATED-PHASE1-R4.json。此前R3待验/未发布文字是历史状态。本轮不是完整星球或最终美术完成。
