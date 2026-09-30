# 星球架构 R2：内陆大陆与高空无孔切换

交付目录：C:/Users/HUAWEI/.codex/worktrees/7eee/star-abyss-game/artifacts/planet-architecture-r2。

R1已完整归档到同级planet-architecture-r1，原manifest与证据保留。R2生产改动仅field.mjs和scene-adapter.mjs；其余为测试、验证工具和文档。

- field：加入广幅大陆隆升、弯曲东海岸和大陆架；旧盆地成为内陆区域。径向荒凉地貌过渡遮蔽方形所有权边界，旧高度依然精确保留。
- scene-adapter：setLegacyMaskEnabled(bool)同步控制shader与支撑查询。高空关闭裁切并由host隐藏旧ground，避免粗LOD形成矩形孔。
- 总控接线和主项目未改，4173未操作。

验证：`node --test playable/tests/planet-architecture.test.mjs playable/tests/planet-integration.test.mjs`；`node tools/planet-webgl-check.cjs`。12/12通过；大陆2462点最低79.44m、干地；东部宽海域169点水深>100m；旧盆地3721点误差<0.1mm；首路线/水文回归通过。真实Chromium三个视角渲染无错误，已查看全局和盆地上空图，无四方海岛或矩形裁切孔。

限制仍为同步LOD加载、无geomorph、程序底层地貌美术；截图不是完整原游戏原生验收。全局截图相机有调整以正视盆地大陆，不能用R1/R2像素差作为回归指标。高空切换要求host同时控制旧ground显示，不能单独关闭遮罩后仍叠加旧平面。
