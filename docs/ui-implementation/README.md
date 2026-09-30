# HTML 界面实现证据

## 当前：静默回声（2026-09-05）

`echo-surface.png`、`echo-core.png`、`echo-journal.png` 来自真实三维 `file://` 页面，可通过 `npm run test:e2e` 重新生成。它们分别记录起点扫描、走入船内并回收黑匣子、900px 日志地图。`echo-menu-*`、`echo-journal-*` 是 900×800 / 1440×900 独立布局检查截图；菜单之后调整了三维背景机位，旧菜单截图不代表最终机位。

当前画面不再加载 `playable/assets/backdrops/` 中的完整场景图片。那些原始图保留作为美术资料，未进入运行管线。

## 历史：Image 2 四屏与二维投影

以下截图记录重做之前的版本，不是当前玩法。原截图脚本已随旧运行时移除，不能再执行。

- `01-ground-exploration-hud.png`：第一人称地表、真实视锥目标与分析锁定。
- `02-engineering-build-logistics.png`：分类建造、旋转/吸附/范围与双仓调拨。
- `03-expedition-center-starmap.png`：舰况、三航线预选、风险/收益与确认起航。
- `04-deep-space-cockpit.png`：可操控驾驶舱、目标/引力警告与实时系统遥测。
- `*-768.png`：同一流程在 768×720 下的响应式证据；工程和星图使用可滚动布局承载完整功能。

旧版曾在同一种子、同一初始姿态和无场景实体干扰的条件下生成移动对照图：

- `05-movement-idle.png`：静止基线。
- `06-movement-forward.png`：持续按住 W 1.1 秒后的径向地表流与步态位置。
- `07-movement-strafe.png`：持续按住 A 1.1 秒后的横向地表流与步态位置。

该旧实现仍使用二维投影与静态坠毁舰背景，不能让人真正走入飞船；现在已整体替换。

场景背景位于 `playable/assets/backdrops/`。生成时明确要求无 HUD、无文字、无图标；地表背景还移除了早期版本中烘焙的矿物目标，确保准星对象来自实时世界状态。
