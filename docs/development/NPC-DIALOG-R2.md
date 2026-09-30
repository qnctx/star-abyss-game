# NPC 对话与场景标签布局 R2

2026-09-25。针对 1886×1000 截图中顶部巨幅“许衡 · F交谈”、底部对话框和 HUD 同时遮挡画面的情况，完成源码级布局修复。本片未改任务、交易或医师操作入口，未构建 `game.js`，未启动浏览器/GPU。

## 来源与改动

- 重复标题来自 `playable/src/progression-quests/scene.mjs` 的 CanvasTexture Sprite。原 `scale=1.45×0.3625` 随近距离透视放大，贴近 NPC 时覆盖屏幕上部。改用 `sizeAttenuation:false` 和固定小尺寸；NPC 或医师对话打开时隐藏场景标签，关闭后恢复，显隐变化触发场景刷新。标签与 NPC 活动骨骼仍独立。
- `playable/src/progression-quests/ui.mjs` 中任务面板由底部贴边改为视口居中，最大宽 720px、高度随视口受限。标题和“离开 · Esc”固定在顶部；任务、精炼、商店、确认区在内部滚动。确认弹出时滚到确认按钮并聚焦，状态刷新保持当前滚动位置。原 `data-act` 任务、交易和确认分支保持不变。
- `playable/src/foundation/camp-ui.mjs` 中苏禾医师面板采用同样的居中尺寸、固定标题栏和可滚动正文；原教学、炼药、领取、买卖、用药按钮仍由原 `data-command` 处理。
- `playable/css/game.css` 在任一对话打开时暂隐中央 F 提示、准星、底部操作提示、世界标签和 `#test-lab-toggle` F2 测试入口，防止对话背景重复提示与按钮相互遮挡。关闭对话即恢复。

## CPU/DOM 验证

```cmd
node --check playable\src\progression-quests\ui.mjs
node --check playable\src\foundation\camp-ui.mjs
node --check playable\src\progression-quests\scene.mjs
node --test playable\src\progression-quests\dialog-layout.test.mjs playable\src\progression-quests\scene.test.mjs playable\src\progression-quests\quests.test.mjs
git diff --check -- playable\src\progression-quests\ui.mjs playable\src\progression-quests\scene.mjs playable\src\foundation\camp-ui.mjs playable\css\game.css
```

上述 Node 检查通过，18/18 测试通过；输出保存在 `artifacts/npc-dialog-r2-cpu.tap`。新 DOM 测试无 WebGL，验证任务确认仍提交 `deliver:Q03`、医师炼药按钮保留、开关对话同步类名；Three 场景测试仅在内存中检查标签尺寸和显隐。

## 待总控 GPU 窗口视觉验收

受控构建候选后，在隔离地址检查 1886×1000、1440×900、670px 宽及较矮视口：靠近 N04 和苏禾时标签不再膨胀；打开对话后 3D 标签、中央 F 提示及 F2 徽章消失；离开按钮始终可见可点；长商店与医师订单内容能滚到底，中文不裁切；确认按钮可达；关闭后提示恢复。实际接取、交付、购买、炼药仍应使用根存档 CAS 复核。视觉和实机交易结果本片尚未签收。
# 总控独立布局复验补充

`node artifacts/dialog-r2-browser-check.cjs` 使用真实UI模块和game.css，在1440×900、670×700、390×640、900×500分别验证NPC和医師，共8种布局：中心偏差0、无横向溢出、离开按钮在视口且命中检测可点。长列表末端购买按钮可滚动点击并触发确认回调。证据 `artifacts/dialog-r2-independent/report.json` 与截图。此测试数据为布局夹具，未执行真实交易CAS，不等同游戏内交互验收。

## 营地总览截图后的名牌收紧

总控的 `artifacts/r2-integrated-browser/camp-overview.png` 显示，旧 `sizeAttenuation:false` 虽避免近处透视膨胀，却仍把远处标签画成大暗条。已将 Canvas 改为 512×112，字宽超 480px 时缩小字体；Sprite 基准 scale 改为 `.155 × .032`，按 `window.innerHeight` 每帧校正 resize。所有 NPC 与试炼节点的牌子仅在玩家水平距离 ≤11m 时显示，对话期间仍隐藏；试炼牌缩为“名称 · F观测”，避免长读数挤出底图。1440×900 的远景不应再出现营地黑条，近处牌的目标投影约不超过 180×36px。

CPU 场景/DOM 定向 8/8 通过，覆盖远处隐藏、11m 近距显示、12m 隐藏、双对话隐藏及 900→600 高窗口缩放。未启动新浏览器；总控统一重建后的游戏画面需再核对实际投影尺寸、中文字与建筑遮挡。
