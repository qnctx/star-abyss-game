# R3 生态资产与接线（2026-09-29 本轮冻结）

工作目录是 C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game。未调用新图片生成或任何外部付费 API；严格使用已批准图03/05/06/09与02/04/08/12。图册映射和三角面数在 manifest-r3.json。

## 当前资产

树木：曲线细分树干、多向板根、15条主枝及次级枝、分层细叶树冠。近景76400三角，中7040，远1254。限定性能修复将视觉LOD0/1边界改为32/125m；中远冠层用更少、略宽的叶面维持树冠范围，LOD2将叶脊四面简化为双面三角轮廓。草：弯曲渐尖灰绿草叶（500/200/60三角），芦苇有茎/窄叶/穗。岩层露头：多块断裂层岩、层间缝、岩台和坡脚碎片（12800/5120/2560三角）。镜晶嵌入裂缝，三档高度7.95m一致。浮岩为凸断裂面共享边细分的专用封闭实体（704/176/44三角），不是露头副本、球体或悬浮方片。

可编辑来源是 build_assets_r3.py 与每档OBJ；实际数据为JSON及Godot .res；碰撞以 -collision.tres保存。共7类、21网格。运行时优先读取已导出的二进制.res，避免每次解析大型JSON。source-map-r3.json记录参考图路径/SHA256及基线SHA256。preview-forest-r3.png、preview-geology-r3.png 是 Godot 实际渲染的资产展台，不冒充主场景。

## 接线约定

NativePlanetEcology 原 setup/update_stream/clear/snapshot 接口保持。**视觉LOD与物理支撑分离**：220m内全部使用surface_at物理ready并为实心资产保留碰撞，包括125–220m的LOD2。220m外才使用总控的rendered_visual_surface_at(point)，不生成碰撞。跨220m即使视觉LOD不变也重建批次。所有档均检查中心与4个足迹边界的ready、高差、water_depth与legacy_weight。草/芦苇按真实法线贴地，偏离支撑面阈值分别5.5/8cm，树根保留径向竖直且根端埋地。

NativePlanet瓦片三角在node存活期间不变，因此每帧比较全部足迹的near/mid owner身份；卸载、替换、区域地表被近景接管时立即移除。缺失物理owner时禁止缓存空owner，退回逐点几何验证。此优化读取 NativePlanet._near_tiles/_mid_tiles；若总控未来改瓦片记录结构，需同步接线。validate_support_geometry(cell)专供独立慢速几何复核。未ready空批次45帧后重试。旧盆地legacy_weight>0仍全部禁放；总控新授权的旧盆地露头尚未实施。

草在130m内，芦苇/河石在220m内，树/层岩/镜晶/浮岩可至900m。总900实例、**130万三角**；近/中/远分别20/30/80万。晶体/浮岩使用field的crystal/storm权重（缺失时默认0），树草受cold/volcanic连续抑制；没有按地标硬铺矩形。

## 验证命令

从根目录以cmd运行：

1. `py -3 godot\assets\planet-ecology-r3\build_assets_r3.py`
2. `D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --path godot --script res://tests/native_ecology_r3_preview.gd --resolution 1440x900`
3. `D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --path godot --script res://tests/native_ecology_r3_integrated.gd --resolution 1440x900`
4. 独立检查见 godot/docs/ECOLOGY-R3-INDEPENDENT.md。

复现旧版配对基线：先运行 `py -3 godot\assets\planet-ecology-r3\build_perf_baseline_r3.py`，再给第3条命令末尾加 `-- --baseline`。旧资源只写在baseline-perf-r3中，不替换当前实现。运行 `py -3 godot\assets\planet-ecology-r3\compare_perf_r3.py` 汇总两次原始记录与输入SHA256。不要并行运行GPU测试。

负责文件修改前版本保存在 baseline/native_planet_ecology.gd.txt。不修改world/planet/field/既有terrain shader/WORLD.md。没有追加付费生成。

## 实际验证与性能

- 独立 Godot 测试 exit 0 / failures=[]：正legacy权重、深水、未ready禁放；近中景树碰撞数量匹配；远景无碰撞；三档/总实例预算；任意足迹丢失、owner卸载/替换/缺失的回归。网格审计21个资源全部零退化三角；浮岩三档闭合。详见 godot/docs/ECOLOGY-R3-INDEPENDENT.md。
- 实际 NativePlanet（真实field、9近瓦片/25中瓦片）：17000m路线偏移1800m处，558树、204草、43露头、22芦苇、2河石，共829实例、1,223,718三角。421批次全部经逐足迹真实几何复验。远实例至916.7m（900m单元中心筛选，加单元内偏移）。移动120m后所有保留批次再次通过几何验证。
- 图像：`preview-integrated-forest-r3.png`。这是实际NativePlanet+Ecology测试场景，使用独立测试灯光/相机；不是包含角色/载具/UI的完整main场景。测试未改正式存档。
- Intel UHD Graphics / OpenGL Compatibility / 1440×900 / 默认垂直同步，同一机位顺序配对、各799个稳态采样：

| 指标 | 旧版重新测量 | 优化版正式测量 |
|---|---:|---:|
| 北京时间 | 22:50:34–22:51:09 | 22:52:41–22:53:13 |
| Engine FPS min / p50 / max | 22 / 23 / 24 | **60 / 60 / 60** |
| GPU p50 / p95 ms | 15.561 / 38.676 | **12.921 / 13.432** |
| 渲染CPU p50 / p95 ms | 1.354 / 1.817 | 1.277 / 1.669 |
| 生态更新CPU p50 / p95 ms | 1.842 / 2.458 | 2.313 / 2.861 |
| 生态三角 | 2,883,256 | **1,223,718（下降57.56%）** |
| 全场景rendered primitives | 3,760,732 | 1,605,315 |
| 树 / 草 | 559 / 173 | **558 / 204** |
| 最大覆盖距离 | 916.7m | **916.7m** |
| 支撑有效批次 | 400/400 | **421/421** |

优化版209 draw calls；移动120m重选29.715ms，仍有瞬时开销。物理帧间隔受补步影响，不当作渲染FPS。截图已逐张查看：中远树冠更粗，远端覆盖与整体树群轮廓保留，草簇仍在。

两次测量在总控material_capture结束、独立GPU验收暂停后顺序运行。原有Godot游戏进程PID34324（20:48:54启动）在前后均保留，没有擅自关闭，不宣称整机/GPU绝对独占。旧报告22–23FPS另存baseline-perf-r3/before-integrated-verification-r3.json；正式重测是 integrated-verification-baseline-repeat-r3.json，对应旧截图preview-integrated-forest-baseline-repeat-r3.png。新版是 integrated-verification-r3.json及preview-integrated-forest-r3.png。performance-comparison-r3.json保留原始两组数据、时间与56个相关输入SHA256；文件mtime均早于新版运行开始，field采样值前后一致。

## 如实保留的差距

1. **尚未达到图册写实质量，也未完成完整主场景美术验收。** 当前树干/根系仍有程序几何感，部分中景大叶片可辨，林地地表覆盖和林缘层次仍需总控对图验收。不能用559棵树替代画面验收。
2. **本次独立真实地形场景通过≥30FPS目标，稳态实测60FPS；这不等于完整main场景性能通过。** 完整角色/载具/UI、移动瞬时开销仍需总控统一验收；本轮冻结不继续扩大范围。
3. **旧盆地尚未放置R3岩层/碎石。** 光滑旧坡面与图02崖壁断口、块状坡积物仍有明确差距；没有冒险动旧地形、任务、道路或载具。
4. 镜晶/浮岩已接连续field权重、已作Godot资产预览和网格/碰撞验证，但本轮未额外跑特殊地区完整实景巡检；cold/volcanic只影响生态抑制，地形/天气由其它session负责。
5. 根/草支撑是中心+四足迹采样，不是逐顶点地形变形；树碰撞为主干胶囊，岩体为凸包。远景专用视觉资产不参与玩家碰撞。
