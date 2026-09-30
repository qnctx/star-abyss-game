# NPC 任务闭环恢复 R2：CPU 准备

2026-09-25。本片仅恢复独立 QA 与缺失单测，不启动浏览器/GPU，不修改生产源码、`game.js`、HTML 或正式 E 盘工作区。旧 cb21 记录见 `PLAYABILITY-STATUS.md` 与 `reports/TEST-NPC-MODELS-GPU-R1.md`。

## 已恢复与核对

- 从 cb21 恢复 `artifacts/npc-loop-browser-qa.cjs`、`playable/src/progression-quests/quests.test.mjs`、`scene.test.mjs`；恢复前当前工作区均不存在这些文件。
- QA 无 `--run` 只打印计划；实际运行还需 `NPC_QA_GPU_SLOT=granted`。默认候选地址改为 `127.0.0.1:4178/star-abyss.html`，对应 `playable/tests/static-server.js` 的根目录，避免误指 4173。
- 旧脚本的 `settle()` 只能说明当前快照没有 pending，不能证明刚按下的 CAS 已提交。现对接任务、交付、精炼、出售、购买、校准和突破分别等待根状态；资源逐次采集精确增加 1，整轮相对初值增加 6 苔、4 铁。交付 Q02/Q03、精炼、售卖、购买分别检查材料、精炼数、收购额度、币量和库存变化。
- 药品路径先确认 MED02 订单、真实 31 秒后订单消失与药品进入背包，再确认 `use` 非空且药品 locked，最后等待 `use` 清空、药品数量精确减 1、共享冷却生效。七个模型须各自 HTTP 200。

## CPU 结果

先执行 `npm ci --ignore-scripts --no-audit --no-fund` 安装本地依赖；没有改动锁文件。随后：

```cmd
node --check artifacts\npc-loop-browser-qa.cjs
node artifacts\npc-loop-browser-qa.cjs
node --test playable\src\progression-quests\quests.test.mjs playable\src\progression-quests\scene.test.mjs
```

语法检查通过，无 `--run` 计划成功输出到 `artifacts/loop-recovery-r2-plan.json`；任务与场景 16/16 项通过，TAP 在 `artifacts/loop-recovery-r2-cpu.tap`。这些是 CPU 验证，尚不构成浏览器全链通过。

## 下一片独立验收

在获分配 GPU 窗口时，先确认候选 `playable/game.js` 与当前源码对应，并在隔离候选端口运行（两条命令在两个 cmd 窗口）：

```cmd
set "PORT=4178" && node playable\tests\static-server.js
set "NPC_QA_SCENARIO=opening" && set "NPC_QA_GPU_SLOT=granted" && node artifacts\npc-loop-browser-qa.cjs --run
```

自然一级需实证：七模型加载、五 NPC 八方向、Q01 接取、6 苔 4 铁逐次入包、实际 R 击杀与 H 血样、苏禾教学/礼包/30 秒炼制/领取/用药完成、Q01-Q04、精炼交易、三处每次 8 秒、校准及回档。脚本目前在一级近战仍是站桩 R；旧轮一级因此被击倒，后续应配合真实移动/闪避，若再次被击倒只记录该战斗路径失败，不能判定产品任务死锁。自然升至十级满槽及突破必须另有真实成长证据；本脚本不注入 XP。

十级夹具在单独全新浏览器上下文执行：

```cmd
set "NPC_QA_SCENARIO=breakthrough" && set "NPC_QA_GPU_SLOT=granted" && node artifacts\npc-loop-browser-qa.cjs --run
```

该夹具开局已预设十级满槽，只能证明后续交易、三节点、校准、显式突破与保存重载，不能代表自然一级升级。必须同时检查 `report.json` 的 `complete: true`、无 pageerror、各阶段根快照及截图；脚本退出码成功但没有这些证据不可签收。两场景须用不同输出目录和隔离存档。

## 旧证据边界及后续修复分流

cb21 十级夹具旧轮已真实击杀取血、苏禾教学、MED02 等待 30 秒并领取、开始用药；旧 `medicine-crafted-and-used.json` 的药品仍 locked、`camp.use` 非空，交付 Q01 得到 accessDenied。根因是 QA 过早把 `!use` 当成用药完成，尚无产品死锁证据。本片未运行新浏览器，所以新等待逻辑和后续 NPC/试炼交互仍待实际验收。若新轮复现独立产品问题，先保存失败根快照和录屏，再给总控具体生产文件与行号；当前没有足够证据提出生产代码修复。

## 营地 R2 接入后续说明

上述七模型与 4178 是本恢复片当时的基线。营地 R2 接入后，QA 已改用 `expeditionDebug` 只读快照的实时 NPC 坐标，加载断言扩至三栋建筑在内的十个 GLB。总控当前独立候选使用 4180 时需显式设置 `NPC_QA_URL=http://127.0.0.1:4180/star-abyss.html`；脚本默认地址仍是 4178，避免误测旧端口。建筑、台阶、动态授权及最新 mobility 源码同步要求见 `CAMP-V2-R2.md`。这一后续改动仍未由本代理运行浏览器全链。

总控复核 QA 发现 `use-start` 已确认药品 locked 后，脚本仍留在苏禾菜单等待 `use-finish`，而菜单暂停模拟时间。现先 `close()` 释放菜单，再等待真实 `simTime` 使药效提交、库存精确减 1 与共享冷却建立；语法检查通过。此改动只修验收脚本，尚无新浏览器全链结果。
