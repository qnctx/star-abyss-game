## 2026-09-16 连续星球 MVP-R1 已发布

原入口 http://127.0.0.1:4173/ 已安装连续星球候选，共74个精确核验文件；没有重置E盘工作区或用户存档。原R4与所有被改文件备份于 artifacts/backups/planet-mvp-r1。bundle SHA256 c1c0baba42b3ce5e7ccbaf6a97f39ea9b153f542db3961f6b2b1abebcd3557e0。安装清单 versions/INTEGRATED-PLANET-MVP-R1.json，HTTP核验 versions/PLANET-MVP-R1-ENTRY-CHECK.json；HTML、JS、CSS、旧玄武岩纹理与怪物GLB均200且匹配磁盘。

同一120km半径星球保留旧盆地，接通平原/山脉/森林/河流/湿地/海岸/海洋/断崖、全球LOD、生态碰撞、P勘测到营地整备、连续高空飞行、径向地面/停车/读档和M行星地图。先行两张实际概念图及来源在docs/art/planet-v1；美术为风格化程序MVP。

验证：79/79星球自动测试、393/393旧游戏测试；独立全球运行时审计10/10，原生分段跨界/采样/近地降落/高空下降/背面驾驶与停车刷新/跨LOD远停车整档恢复PASS，地图桌面与390px窄屏交互PASS。发布后4173隔离test模式实测原着陆点Z190→155步行、V第三人称，紫色天空/环形星体/人物/旧外勤HUD保留，浏览器error日志为空。

游玩步骤：普通入口刷新后继续原档；完成旧章调查并修好车后沿东行河谷勘测平原、森林、湿地、海岸，停车步行按P；回营地P整备后长按G连续升空，松开下降。M行星图可选目标，V换视角，F停稳上下车。隔离快验入口 ?test=1&planetFixture=forest / orbit / backside-vehicle，不写原存档；只有额外persistTest=1才写独立测试键。

边界：未完整原生重跑开局→34km全勘测→240km→返回；长流程有同数据逻辑验证及关键分段输入验证，不能宣称全程实机验收。持续油门+Space原生长按未覆盖，实际runtime刹车测试通过。水下不提供步行/潜水。详细证据与历史发现见PLANET-INTEGRATION.md及三份独立报告。
