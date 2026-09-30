# 星球架构R3：高海拔与极点地面就绪

生产改动：`playable/src/planet/chunks.mjs`、`scene-adapter.mjs`、`field.mjs`。精确路径和SHA见 `artifacts/planet-architecture-r3/manifest.json`。

LOD距离改用相机当地真实地表半径；在固定192块内先保证脚下精度。近地进入粗块可绕过32m量化等待。实际支撑改为cubeUV定位三角和平面相交，修复极点恰在网格顶点时Raycaster漏判。

field公开maxSurfaceHeight，任意legacyHeight未提供legacyMaxHeight时为null；附数学公式并验证总控310m平面上界换算后总上界5085m。该值不覆盖额外物体，玩法仍须solidSweep。

验证命令：

- `node --test playable/tests/planet-architecture.test.mjs playable/tests/planet-integration.test.mjs`
- `node tools/planet-webgl-check-r3.cjs`

15/15通过。256全球方向在固定预算内脚下≤20m；6处真实Three网格及微移均就绪。背面海拔3509.852m、spacing1.831m；双极/近极spacing1.831m，面角14.648m。每处活动192、缓存上限384。WebGL orbit/backside/south-pole三图无错误，背面/南极groundReady=true。R2旧盆地3721点、大陆2462点、东海169点、连续路线水文回归通过。

R1/R2冻结文件未改；主控接线、4173未动。总控已有prepare等本地改动时请对照R2→R3差异合并，避免覆盖其增量。默认预算保证不等于任意受限maxLevel/maxChunks可达；同步构建仍需性能监测。未声称原生球面步行/相机全验收。
