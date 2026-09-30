# PHASE1-R2 岩壁独立物理审计

结论：**FAIL（相机碰撞缺陷）；顶面支撑、采样地面碰撞、采样横向视线与第一章往返通过限定逻辑检查。** 本报告不涉及原生浏览器，也不代表R3材质验收。

唯一产品输入为 artifacts/deliveries/PHASE1-R2。其manifest列出的140文件全部重新SHA核验。独立脚本与结果位于 artifacts/tests/PHASE1-SCOPE-PREP/outcrop-r2-audit.mjs / outcrop-r2-audit.json；未复制开发几何测试，未修改产品文件。

## 独立检查

对全部7簇岩壁逐簇用实际createRockRenderChunks生成Three Mesh，以不与原顶点对齐的41×41网格向下发射Three Raycaster；落在几何内共6469点。实际mesh首交点与rockSurfaceHeight最大高度差0.001049m，无超过2mm的差异。浮点网格储存解释此毫米量级误差。

在离地超过0.6m的采样位置，以真实地表作为脚下调用collidesAtHeight，无地面漏挡。各岩壁24方位、中高截面直穿可见几何的射线，createWorldQueries.hasLineOfSight均遮挡，无168方位中的漏挡。此检查是采样，不证明每条极薄接缝/全部高度/镜头角度。

R2另跑完整第一章连续movePlayer积分与故事交互，26965帧通过；包括正确实体绕行、错序中继清空、途中读档、黑匣子回营、重复交付幂等。记录route-r2-independent.json / route-r2.log。此为Node物理/剧情fixture，不是用户输入实玩。

## F1：新岩壁最高部分可穿过相机碰撞

camera.mjs的cameraBlocked仍按 `terrainHeight(rock.x,rock.z)+rock.height` 比较高度，然后测试底部凸轮廓。新岩壁每个顶点分别贴合不同地表高度，实际最高表面高于该中心上界0.432—2.978m。因此在这些上沿内部，相机判定错误放行。

默认半径0.22m（非缩小相机参数）验证：6/7岩壁累计107点位于可见顶面下0.25m，cameraBlocked返回false；sweepCamera从同x/z顶面上1m向此点下扫也返回occluded=false并落入几何。

具体复现：岩壁4249，x=-68.38423645320196、z=39.47826086956522；实际渲染顶y=25.499946207463893，地面15.591522265504583。sweepCamera由y=26.499946207463893到y=25.249946207463893穿过顶面，仍放行。该岩壁扫描最高28.005009m，而旧中心高度上界约25.027309m。

这是明确的相机函数/可见几何不一致；未通过原生玩家证明上述所有高度均自然可达，不把逻辑复现夸大成完整实机复现。建议针对meshPositions使用实际周边三角支撑/球体半径采样，避免把地形中心高度当整个岩壁上界；同时避免使用整个底部柱体造成上方空白区域无形墙。

控制器已获实时缺陷通知。修复后需用新冻结输入复测，R2冻结不得覆写。
