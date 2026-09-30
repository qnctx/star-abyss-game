# 原游戏基线纠偏与并行接入

接口追加：I-R3拟采用sceneConfig.poseBounds={xMin,xMax,zMin,zMax,pitchMin,pitchMax}；validateRoot可选sceneConfig、openIndexedDB与createSession显式传同一固定深复制配置。坐标开区间，pitch闭区间且位于±π/2，yaw仍±π。无配置保持R2旧行为；大世界档由旧reader读取需明确拒绝，不可静默重置。adapter/session配置错配必须拒绝且不损坏根。此为开发合同，未独立验收。

WORLD v1接口已发布：definitions/createWorldQueries/createExpeditionWorld({THREE,scene,terrainHeight})→{root,update(view),dispose()}。四地点(80,100)、(-1068,682)、(1168,682)、(1218,-1068)，每处3资源点+1掠兽，safePoint(0,190)保护半径24米。WORLD读取真实静态地形/门墙/岩石；动态载具与追击寻路、伤害/奖励授权由CORE负责。view缺失的权威实例隐藏，不默认复活。接口冻结可接线，文件仍开发中。

2026-09-12，用户明确要求以图一的原3D游戏继续开发，清理图二白盒残留，由总控开多个分会话协作。本指令覆盖此前把D1独立场景作为阶段试玩入口的安排。

唯一产品入口为 `playable/star-abyss.html`，开发服务4173。保留现有角色、载具、星空、调查任务、原存档及约6×6公里地形（WORLD.halfSize=3000）。不改成小竞技场，不用几何假人替换现有角色。新战斗/采集等功能必须在原游戏真实移动、镜头、输入和地形上运行。

白盒已退出运行目录：原 `playable/src/d3-scene/` 与 `playable/tests/d3-scene.test.js` 移入 `artifacts/retired-d1-whitebox/20260912/`，保留全部文件与哈希、不删除用户试玩日志。4182核对无监听。A/B/C/I已验收规则模块和历史证据保留，可复用逻辑但不能再给用户另一套游戏。原main、game.js、资产与旧存档未更改。

原基线快照：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/ORIGINAL-BASE-R1`，187文件，逐文件清单manifest.json。包含当前未提交的源码、CSS、HTML、bundle、测试与工具；不能以Git旧HEAD代替。原资产只读主playable/assets，运行库只读现有node_modules。每个分会话仅在自己的工作树使用快照，主目录由总控守护。复制文件如目标已有与快照不同，先确认属于干净HEAD的旧基线并备份，禁止覆盖未知改动。

## 分工与接入契约

- DEV-ORIGINAL-CORE：唯一拥有main.mjs，以及新增expedition-runtime/、expedition-runtime.test.js。负责把A/B/C/I有效玩法接入原世界/原玩家/原输入，旧存档非破坏兼容，真实伤害、死亡恢复、资源/掉落/有限背包原子保存。不能嵌入白盒页面。只允许为场景挂载添加scene.mjs的最小接口，须先通知总控；不动原角色/载具造型。原打包产物仅在隔离预览输出，主game.js最终由总控在整合验收通过后备份/重建。
- DEV-ORIGINAL-WORLD：拥有新增expedition-world/与expedition-world.test.js；不改main/scene/layout/ui/CSS。在既有大地图中设计至少三处可实际到达的野外遭遇/采集区域，与营地/旧调查路线连通，保持原地形和碰撞。提供空间数据与可挂载Three视觉模块，尺度符合现有米制；先发布接口，供CORE接入。复用既有美术风格与资产，不做大地图四周摆小白盒。
- DEV-ORIGINAL-UI：拥有新增expedition-ui/、expedition-ui.test.js及playable/css/game.css必要局部改动，不改main/scene/原ui.mjs。提供createExpeditionHUD({onAction})→{update(view),destroy()}，作为原全屏游戏HUD扩展，默认透明紧凑，不挤成左画面右控制台。背包/状态菜单不得挡原地图/任务/载具按钮，中文多宽度可读；菜单焦点/输入归还经CORE挂接。先发布view/action字段契约。

WORLD与UI交付初始接口说明到各自报告，通知总控和CORE；CORE可以先编写逻辑适配，依赖接口未到不能伪造已完成。三者不互写文件，不直接改主目录，不覆盖原脏改动，不收费生成。需输出变更文件哈希、基线哈希、原游戏截图与实操证据、明确未测边界。

每个开发交付后新建独立TEST会话验收该冻结版本；修复再新建TEST。模块测试不等于整合通过，最终还需原游戏完整入口的联合实机验收：原任务/步行/载具/第一三人称/地图/存档回归，新玩法连续走通，画面维持图一基础。未通过前不替换主游戏bundle。先完成这一轮原游戏接入，不扩大终局组织、加工D2或宠物E。

原游戏并行接口协调：CORE确认I-R2固定白盒pose边界阻断原米制世界保存；已派原DEV-I任务01a094d9-4b8a-7890-a238-0effc66ca873（7737）开发I-R3配置化世界/pitch边界，wait_threads确认inProgress，交付后另建全新TEST-I-R3。旧R2默认校验不放宽，请求不能覆盖边界/safePoint，配置深复制；validateRoot无config与session配置一致性须全调用链处理。原WORLD.halfSize3000、spawn(0,190)、pitch±1.35，yaw由CORE规范至±π。CORE不缩放坐标、不改I、不直接写根，其他工作继续。

CORE接线合同：现有world.scene可直接挂载，无需扩大scene.mjs所有权。新增R攻击/H采集拾取/I背包，保留F原交互/上下车及空格原功能。UI v1已发布于7d07工作树DEV-ORIGINAL-UI.md：createExpeditionHUD({onAction})返回update(view)/destroy；screen playing/inventory/rescue可见，其他隐藏；menu事件由CORE协调输入释放/恢复和暂停战斗，业务由CORE执行，UI仅显示权威pending/error/save。开发契约不计验收。
