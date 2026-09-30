# TEST-LAB-R1 验收报告

隔离工作树：`C:/Users/HUAWEI/.codex/worktrees/8982/star-abyss-game`。源基线来自 `E:/myProject/star-abyss-game` 的 SUPPORT-TERRITORY-R1。未写主项目或主控树，未使用4173；复用既有node_modules，未安装或修改依赖。

## 已完成的针对性回归

`node --test playable/tests/test-lab.test.mjs playable/tests/planet-integrated-runtime.test.mjs playable/tests/planet-gameplay.test.mjs playable/tests/planet-gameplay-r2.test.mjs` 初次联合回归：**27/27通过**（原行星22项、lab5项）。最终增加延迟提交/失败重试用例后独立运行lab：**6/6通过**；合计28个不同用例。

- 测试入口必须显式启用；拒绝导入正式link/ID。
- R4真实actor属性通过原root校验：HP155520、attack15552、defense12960、resource1600。
- 实际expedition runtime完成材料采集、背包转移、脉冲施法、击杀、真实尸体掉落及检查点提交。
- 浏览器发现固定资源坐标可能尚未被导演生成；已加入全新root真实导演准备与按运行时对象选择入口。修改后5项lab测试再次通过，包括恢复时不重复生成。
- 最终第6项测试注入延迟提交与一次真实事务失败，验证await busy、错误中止、同一root重试、仅初始化一次、物件ID不重复、准备后满生命。
- 独立DB覆盖强制生效，正式ID不能通过测试storage读写；阻塞删除不会先删除localStorage记录。
- 原调查/飞行解锁顺序、碰撞/深水/未加载地形拒绝、能量消耗、高空速度/减速、球面存档恢复与轨道往返均通过原回归。

`npm run build`：通过。`node tools/test-lab-integration-check.cjs`：通过，精确锚点改动重建的main与验收main逐字一致。

## 浏览器证据

使用真实Chromium与WebGL、专属4188、全新浏览器上下文；没有访问用户个人浏览器存储。完整检查点保存在 `browser-report.json`。地理已通过项与后续流程采用续跑汇总；第一次30秒点击超时属于同步地形准备过慢，已加准备反馈/冻结面板重复绘制，第二次升空的800ms壁钟断言改为等待真实高度增加。没有通过缩短加载流程或伪造session来绕过验证。

已确认：正式入口无lab UI；真实R4会话；已完成调查/高空装备；1440×900和1024×768中文面板无横向裁切；六生境与四个外勤区跳转；背面与南北极球面跳转；真实地图导航；高度跳转；停悬稳定；按钮升空使真实高度增加。

最终 `browser-report.json` 汇总 **46项检查通过，page errors=0**。浏览器实际确认：F上车、传送清乘车/旧飞行、收起恢复W步行、H资源入包、原背包、I返回后可再次进入实验室、深海拒落、返营退出飞行、刷新同一worldId与背包、reset新worldId/R4/空背包。正式localStorage存档哨兵、无关键及正式IndexedDB哨兵均逐字不变。

浏览器和本任务4188服务均已关闭。最终营地截图为 `camp.png`；面板截图为 `panel-1440.png` 与 `panel-1024.png`。本报告的地理检查来自已通过的早期流程，驾驶/采集/持久化来自后续流程，均使用同一SUPPORT-TERRITORY-R1基线；未重复跑性能测试。

## 状态清理与加载门槛

传送重建planet飞行状态，清理旧mobility升力、推力、竖直速度、jump held/vy/time/landing、vehicle driveSpeed/slip、player spaceHold、dash与输入。离开载具不复制mounted状态到测试停泊快照。打开面板清空并禁用游戏输入，关闭恢复control gate；面板阻止键盘事件穿透。飞行/停悬按钮通过真实simulate控制已验证关闭面板后恢复执行。
驾驶入口会朝向真实车辆满足F交互；F上车、传送清状态、关面板恢复W步行、H入包均已在浏览器通过。I关闭背包会触发原鼠标捕获，因此提供F2（capture阶段监听）打开/关闭实验室，避免被pointer lock困在无法点按钮的状态。

面板冻结绘制仅在 `labPanelOpen && !sceneDirty && !expeditionLoading` 成立；另外已经确认asset ready之后的labPreparing阶段暂停重复世界绘制，事务循环/onChange DOM仍运行。afterMove和attachExpedition finally唤醒sceneDirty。初始化资源未就绪时操作拒绝，加载失败仍保留重试路径。

## 交付限制

- 没有新增3D资产或声称未接入玩法完成。六生境及四外勤区内容范围详见README表格。
- 高空/轨道权限、传送、停悬和倍速属于测试便利；不宣称元婴正式飞行设计已全部实现。
- 此树没有主控的checkpoint Worker实现；已传独立 `checkpointStorageName: TEST_LAB.db`，主控集成worker后需再验隔离与destroy关闭连接。
- 不交付覆盖game.js或main.mjs，只交付新增模块、CSS、入口、测试、文档和精确接线patch/script。主控自行构建候选bundle。
- 不提供并发软件渲染下的性能结论；整合后的性能由主控单独测量。
