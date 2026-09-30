# R3 独立验收：美术未达，技术验收未完成

2026-09-29。目录：`C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game`。

**结论：不得宣布 R3 整体验收通过。美术未达到已批准的 12 张参考；一次完整输入飞行返程失败，且飞行期间生产冻结被打破。剩余项目等待重新冻结。**

本 session 未修改生产代码、shader、资产、正式存档；只新增/更新自有 tests 和独立报告。没有使用付费 API。测试均隐藏窗口，不发送 OS 键鼠操作，不启动可见游戏窗口。

## 实际完成与版本证据

| 批次 | 内容 | 结果与限制 |
|---|---|---|
| `20260929T150246153471Z` | 完整 main、角色相机、7 个东向样点、4 个 special、PNG、表面/射线 | 52/52 断言通过，生产首末 SHA 稳定，无脚本/shader错误；包含截图写入断言，不是52项玩法通过 |
| `20260929T150553883848Z` | 普通 viewport G/C 输入、正常 Main/Player 物理、升空到125km、返程 | 10/12；C 返程停在1132.33594m、flight_active仍true；生产SHA改变；该批降级诊断 |

第一批 52 项由 2 项场景/序列化、28 次截图写入、14 项东向支撑/射线、8 项 special 支撑/射线组成。已逐张 view_image 查看第一批全部28张图。2 m悬停样点中的角色浮空是测试定位，不把它报为物理落地失败。

第一批未禁用 main，但固定机位时关闭 Player physics；因此其性能与画面属于完整 main 静态样点，不等于全部正常操控的实时体验。真实正常 Player physics 由第二批执行。

第一批支持与独立射线覆盖 3/4/8/17/27/34/42 km 及 cold/volcanic/crystal/storm。海洋点实测对象是海床碰撞，截图位置在海面上方；不能把“海床 ready”写成“海面可步行”。special 射线证明地形支撑，不证明所有装饰岩石/冰晶/浮岩都具备碰撞。

## 冻结失效

第二批 `integrity.json` 记录15个路径改变，其中包含：

- `scripts/native_player.gd`、`scripts/native_motion_r2.gd`、`scripts/native_enemy_r3.gd`；
- `scripts/native_ai_camp_npc.gd`、`native_ai_decision.gd`、`native_ai_npc.gd`；
- `assets/martial-r4/` 下模型/构建脚本/manifest/reference/source；
- `assets/planet-ecology-r4/` 下构建脚本与shader。

这不是仅文档更新，直接影响完整主场景验证边界。已要求协调停止这些修改并重新确认集成冻结；此后没有再启动 GPU 验收。此前收到“总控/地图冻结”不能抵消其他 session 对 Player/Motion 的修改。

第一批 `integrity.json` 的 reason 字段仍是旧模板“Await explicit integration freeze”；其 `run.json.argv` 明确含 `--frozen`，并且当时已有冻结通知、首末变化列表为空。已修正 launcher 后续 reason 文案，保留旧原始证据不改写。

## 正常飞行失败证据

普通 G 输入抵达125039m，用时76.28s模拟/78.86s墙钟；松G后径向速度归零。C返程先下降，随后长时间固定于1132.33594m，最终仍在飞行。

- 23232 physics frames、387.20s模拟、391.10s墙钟，Engine.time_scale=1，physics delta固定约16.667ms。
- 支撑未就绪帧=0，最低AGL=0.578125m；不表现为下穿。
- 失败原文见 `product-flight.json.failures`，分别为正常 C 着陆失败及源码首末不一致。
- **不能据混合版本确定生产根因，也不能删掉这次失败。** 测试只在开头注入一次C按下；Player在window focus_exited会清理合成held状态。现有日志没有在停滞当帧记录held_c，故可能存在测试输入保持问题，尚不能证实。最终里程碑是在测试主动释放C之后采样，不能用其held_c=false倒推当时原因。
- 自有 prepare 脚本已准备显式合成按键保持及重注入次数记录，下一轮会仅在合成held意外变false时重发既定按下，保留真实物理、不改速度/位置/时间尺度。**尚未生成/运行此修正版，不冒称已解决停滞。**

## 美术判定：未达

参考01–12已经逐张查看。参考缺少相机位置、朝向、投影参数，现有game图与reference只能是**不同机位差距诊断**；不得标注“同视角对比”或以近似构图冒充精确对位。

| 地区/参考 | 冻结实景观察 | 未达项 |
|---|---|---|
| 盆地02/10 | 原营地/角色/环星仍在，原高频噪点显著降低；1.6km大面积灰紫模糊地面 | 陨坑/台地/阶岩的大尺度关系仍不易读，远山层纹过于规则；不能以换色当成02/10岩层塑造 |
| 盆缘与平原03 | 3–4km裸地过渡到散树，8km已是相当多树的平面 | 缺少宽广低起伏草原、砾石—细土—稀草的丰富覆盖组合；反复出现同形层叠岩堆 |
| 山峡04 | 路线上远山多为平滑隆起；特殊峡谷出现连续大折面 | 未形成参考的分层岩壁、坡积物和集中脊线；本轮无独立04地标机位，因此只报所见，不能声称全山系遍历 |
| 森林05/09 | 17km树数量足够可辨森林，地面仍大片平色；树冠、树干和草丛组合重复 | 缺少巨木尺度、冠层层次、河谷岩壁、自然林缘和地面空隙组织；数量不等于森林美术达标 |
| 河流/湿地06/09 | 8/17/27km俯视可见长条水带，边岸有规则锯齿/直线段；27km地面以树岩草重复组合为主 | 河漫滩浅水洲/芦苇岸线互穿不充分，河床/岸滩过于概括；远处出现疑似裂隙，未定位归因，不报水系连续完全通过 |
| 河口/海岸07 | 34km可见河道连接开阔水面，地面散布相似岩堆 | 缺少曲折泥沙滩、潮间带、连续海岸岩壁与浅水细层次；岸线有明显三角齿形 |
| 海洋/岛屿08 | 42km样点是连续深蓝海面 | 该机位不能证明岛链/海蚀柱达标，未看到参考的陆架—礁岸—岛群组合；不以一张空海面验收08 |
| 冷谷12 | 冷色谷底、冰片可辨 | 巨大连续折面墙与零散重复冰片，远未达到破碎冰封阶岩和自然裂谷 |
| 火山12 | 中心及600m机位为紫褐坡地、重复层岩 | 本机位未读到参考的连贯熔岩流、洞口/蒸汽/地热裂缝组织；不推断整个区域完全没有效果 |
| 镜晶12 | 地面可见小晶簇 | 崖壁大折面、晶簇及岩堆重复；600m图存在明显紫色楔形露底，属于需跟进的视觉缺陷 |
| 风暴12 | 地面可见数块浮岩 | 缺少雷暴天空/裂谷高原的清楚层次，大片坡面与重复石堆主导；600m图也有细长露底形状 |
| 轨道01/11 | 同大陆与干盆地身份可辨，原孤立高频方片在常规合成图中已不突出 | 地理仍粗略，植被/岩性斑块及球缘不够自然；角色默认机位截到球体下缘，不能验收完整球体构图 |

第一批 `orbit-no-equipment-no-basin-far.png` 人为关闭盆地后出现方孔，是隔离诊断的预期结果，不报为正常产品方块。`orbit-equipment-isolation.png` 才用于区分角色与正常地理。

合格的后续美术证据需记录game机位、统一视角/构图尺度，并与对应reference并排；由于原reference机位未知，应先建立明确的对位规则/目标，不能直接把本批不同机位图改标签。

## 性能：仅报告实测范围

所有本轮已运行项为 Intel UHD/OpenGL Compatibility，1280×720，关闭vsync、隐藏窗口；不是1440×900生态单场景性能结论。

第一批每机位稳定等待后120个process_frame间隔（约0.5–2s短窗），Player physics固定机位时关闭：

- 17km地面：平均59.93帧/s，p95=35.30ms，最大37.19ms。
- storm地面：平均58.92帧/s，p95=28.97ms，最大40.52ms。
- crystal地面：平均63.86帧/s，p95=27.09ms，最大41.57ms。
- 轨道：平均88.29帧/s，p95=18.35ms。

这些短窗不能声称“完整main稳定60FPS”。第二批正常物理全程process_frame间隔41783样本，平均107.21帧/s、p95=15.20ms、p99=18.92ms、最大565.0ms、>50ms共30帧；包含启动/升空/截屏/长时间停滞且生产变化，因此不作为稳定版本性能通过。process_frame间隔不是GPU timestamp，更不是显示器实际呈现率。

初版主入口调用了不存在的 `debug_stats` 并安全返回空字典，未获取生态数量；这是测试框架遗漏。新增 perf 入口改用真实 `snapshot()`，准备1440×900完整main/正常Player physics各10s测量及900m配置检查；**尚未运行，不能借用生态session的60FPS或数量作为本session结果。**

## 未完成，不能写通过

- 冻结后存档兼容重跑（旧准备阶段21/21仍只是旧版本证据）。
- 当前版本正常完整返程、旧边界动态跨越、载具控制回归。
- 本轮同位盆地焊接消线与海面V线复核；玩家机位未明显看到旧V不等于总控同位验收完成。
- 中文UI小窗口和viewport实际点击恢复控制；原near=0.05运行时数据已保留，近身装备最终视觉仍需UI/视角回归。
- 1440×900完整main长一些的性能样本、生态900m实际覆盖、特殊效果碰撞范围。
- 河岸/海岸水线连续剖面与动态越界检查。

## 准确复测步骤

先由所有相关生产修改者重新确认冻结，再从上述C盘worktree依次运行；勿并行GPU测试：

```bat
py -3 godot/tests/terrain_r3_independent_prepare.py
py -3 godot/tests/terrain_r3_independent_capture.py --flight --frozen
py -3 godot/tests/terrain_r3_independent_capture.py --compat --frozen
py -3 godot/tests/terrain_r3_independent_capture.py --edge --frozen
py -3 godot/tests/terrain_r3_independent_capture.py --vehicle --frozen
py -3 godot/tests/terrain_r3_independent_capture.py --ui --frozen
py -3 godot/tests/terrain_r3_independent_capture.py --perf --frozen
py -3 godot/tests/terrain_r3_independent_capture.py --seams --frozen
py -3 godot/tests/terrain_r3_independent_summarize.py
```

UI/perf自有入口首次执行可能需要框架小修，允许范围仅自有tests。主路线若相关地形/生态/Player版本改变，也重跑不带模式参数的capture。每次输出新目录，检查 SHA 前后变化列表和错误日志，逐张查看PNG；技术断言通过后仍需单独判美术。当前全部进程已结束。
