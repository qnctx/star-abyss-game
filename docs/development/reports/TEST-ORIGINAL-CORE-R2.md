# TEST-ORIGINAL-CORE-R2

结论：**已测范围 PASS；没有复现 R1 B1 或发现本轮产品阻断。完整无边界 CORE 实操验收不判 PASS**，因为实际隔车攻击/追击没有构成有效场景、持续驾驶未测。以下分别给出通过范围与未测边界，不以逻辑fixture或其他团队PASS扩大结论。产品未修改、未提交。

唯一冻结源：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries`。受测树：本工作树 `artifacts/tests/TEST-ORIGINAL-CORE-R2/tree`。五冻结 ORIGINAL-BASE-R1 187、I-R3 47、UI-R3 45、WORLD-R3 19、CORE-R2 31，共329个清单文件已逐SHA核验；只依赖锁定产品覆盖187基线。R2 version SHA256 `3db9a28e10bafd674fbda11436e40411ab0ac646dc6f0c59babc3298e502d2f4`，R1报告 SHA256 `f951eaf9585c54104223eefc3e23933075b0aed9e04c343343520a5abee89860`。

独立严格入口 `http://127.0.0.1:4298/playable/star-abyss.html?expeditionDebug=1`。冻结 preview 原字节保持，只由测试 preload 将监听4212映射4298。实际HTML脚本 `./game.js?v=c2-idle-fix-20260909` HTTP字节SHA与严格bundle均为 `84a45490a8e799f1491fe9b80a9538bb9637764f10514eff070a3154e110bd49`，已确认R2组合查询、必需接口错误及动态getter存在。资产和node_modules仅只读 E 主目录。最初服务启动前的连接拒绝页是测试时序问题，随后新自有页正常打开。

## 已完成独立检查

新增 `independent-vehicle.test.mjs` 6组与 `runtime-consumers.test.mjs` 3组通过。严格提取main原构造、真实createMobility(72,80)、真实WORLD及实际clear/spawn表达式；半径边界、两端空整段扫掠、已乘车占位、mobility整体替换和位置更新；车顶边界、车顶以上、射线半径、斜线和反向/竖向射线、原墙门岩LOS；所有五个必需接口缺失在openStorage前拒绝。消费者检查真实runtime占据WORLD敌生成点时generation=-1、移开恢复0，隔原车攻击无伤、移车同敌96→63，已缓存路径插入车体后逐段未穿越。

上述坐标和tick仅用于明确的Node内存fixture，**不是实际驾驶、浏览器战斗或真实自然代际的证据**。未采用开发11项作为独立替代。

实操：原角色/星空/6km入口；V、T、拖动、=自动步行和原W重复输入（非持续驾驶）；沿(23,131)遇岩后正常绕至(77,162)，再至(82,92)。真实R使敌96→63，真实死亡救援和同档reload保留同敌63。二次从东侧正常步行到(85,99)，原R击杀同敌，唯一实例掉落2；H取尽再重复不复制。近营三矿(80,100)、(71,106)、(90,93)全采尽，共矿9/血2。原F在约(98,64)回收芯、(73,79)修车，上下车保持原(72,80)。步行绕东侧返营(15,193)，逐存空11份、逐取空11份，最后项删除后焦点回关闭按钮，Shift+Tab/Tab/Return回CANVAS。

01/02完整根相等，pose/HP/simTime暂停不变。06/07/08死亡救援reload、09/10唯一掉落、11—13矿耗尽、14原车、15—18存取使用本轮原始完整根，按20k字符分段只读同一暂停/死亡DOM后拼接JSON.parse。19/20同档reload保留矿9/血2、敌死亡、耗尽代际、修车和现有故事。最终 `audit-live.cjs` 九组通过。未复制开发截图，旧R1截断文件未用作本轮证据。

## 自然代际与浏览器容量完整闭环：PASS

角色在营地(15,193)保持playing、menu=false，真实计时记录为706→796→881→977→1092→1149秒，生命80不变；其间一次明确的同档reload回归，未增加离线时间。记录含UTC墙钟时间，见 `natural-wait-start.json`、`natural-timeline.jsonl`。敌generation0在due1125后自然成为1，三矿分别在各自due1220/1308/1335后自然成为1。旧instance与history仍保留，`natural-audit.json`逐项记录完整旧、新instance及due/观察simTime，非同一旧源复活。未改坐标、时钟、内部advance、根、库存或生成器。

新敌初始96，正常接战受伤到30后角色携矿9/血2死亡；23/25完整根证明携货、原已修车、现有故事保留且敌仍30，随后真实转身R击杀新敌。第0与第1代各有唯一对应掉落，共两份不同实例drop，不视为同敌重复奖励。第1代掉落未取，仍留现场。24文件拍于menu=false的活动时刻，即使JSON可解析也排除跨分段一致性证明，25暂停根替代它。

首次取矿2的新generation1两份，背包矿11/血2=34.5kg；然后步行靠近矿0约(82,98)。容量目标固定为 `camp-fall-resource-0` generation1，完整instance见capacity-audit.json。首次拒绝、卸货恢复、再次拒绝均为这一相同实例，未跨代替换。

|实际步骤|结论与证据|
|---|---|
|34.5kg，H再采矿0|PASS：28/29完整root完全相同，源剩3不丢。root SHA均 `dbb0b8ed586dd952c484ce5c0d361396440b77ee005a5a368bbc16aade53fc79`|
|正常绕岩返营(12,190)，存入铁陨材1|PASS：30/31包矿11→10、仓矿0→1，重量34.5→32.5kg|
|步行回同源约(81,101)，H采收|PASS：32/33同instance剩3→2、包矿10→11、重量回34.5kg|
|同源再H超限|PASS：33/34完整root完全相同，源仍2。root SHA均 `4ea746f13a11f7e93ead4a120780e0fae78ec44e16945178d8209b74d877df75`|
|满载返营(-18,190)，取仓1|PASS：35/36完整root完全相同、仓仍1。root SHA均 `ce31b716dc9fe56a00c19c8b1ce38521e14ebff2d34e57dc2e0cfb46c1cdf380`|
|拒绝后同档reload|PASS：36/37库存、战斗、代际、车和故事保留，正常显示外勤记录已保存|

实际UI拒绝时同时显示“保存失败”和明确携重上限说明；这里是业务拒绝，不是本轮发生存储I/O故障。28/29、33/34、35/36均比较完整root而非仅数量或摘要。所有原文件可JSON.parse，`capacity-audit.cjs` complete=true。

## 真实 I pending 与结束状态：PASS

在最终营地背包中，Tab定位存血按钮、Return触发正常事务后立即只读DOM，确实观察pending=true、save.status=saving；存/取按钮全部disabled，关闭按钮enabled且当前focus=BUTTON关闭。证据 `pending-observation.json`，没有注入延迟或改IndexedDB。成功后取回血液最后一份，38恢复包矿11/血2、仓矿1，最后一行移除后焦点回关闭。Shift+Tab、Tab、Return再回CANVAS#world，见final-focus.json。最终生命40、位置约(-18,190)。

审计脚本首次错误地对这两次成功转移前后完整inventory做deepEqual，因交易收据及revision理应新增而失败；初始审计保存在live-audit-pending-initial.json。已修正独立审计为items/containers/holders完全恢复且inventory revision恰好+2，9/9通过；没有改产品或证据，也没有将该脚本错误报告为产品缺陷。

## 明确未测与不扩大的范围

真实隔车攻击/追击：**未测**。原输入沿车东侧再绕北侧尝试，22记录玩家约(69.61,76.78)、新敌约(72.85,78.13)、原车(72,80)，双方都在车北侧，不能证明“敌我两侧射线被车挡”。这是原输入绕车尝试记录，不能用9组Node PASS替代实际隔车战斗通过。实际岩体挡路多次出现，但也不扩大为全墙/岩/门AI寻路实操通过。

持续驾驶没有文档化hold/down/up，维持未测；重复原W仅用于步行，不算持续驾驶。完整旧故事/舰内设施、第二处远遇、viewport矩阵、连续冲刺体耗未测。当前1280×720截图中背包中文与按钮可见可点击；未设置viewport override。仅保留原故事状态和修车分支，不声称走完剧情。

负重moveMultiplier/staminaMultiplier尚未接入连续移速/体耗，属于设计未完项，不得宣称全部设计完成。UI/WORLD独立PASS没有扩大成CORE业务PASS。原localStorage与业务IDB仍不构成跨引擎原子提交。

## 复现、完整性与清理

测试步骤：`node --test artifacts/tests/TEST-ORIGINAL-CORE-R2/independent-vehicle.test.mjs artifacts/tests/TEST-ORIGINAL-CORE-R2/runtime-consumers.test.mjs`（独立9/9，independent-combined.tap）；`node artifacts/tests/TEST-ORIGINAL-CORE-R2/audit-live.cjs`（9/9）；`node artifacts/tests/TEST-ORIGINAL-CORE-R2/capacity-audit.cjs`；`node artifacts/tests/TEST-ORIGINAL-CORE-R2/natural-audit.cjs`。后两者是完整原始根审计，不再次操纵游戏。开发11项未拿来替代本轮独立用例。

独立187基线审计确认182字节不变，5项预期覆盖，原game.js未改。结束时以finalize.cjs逐核冻结清单329文件、本树199安装文件以及served严格bundle，最终结果见final-integrity.json。evidence-manifest.json覆盖本报告、独立脚本、完整根、截图和日志；24标明不用于一致根证明，旧开发证据只读，不混为本轮实机。

实际测试页2已关闭，自有服务session67778已Ctrl+C退出，4298无LISTEN，仅曾有关闭中的TCP条目，日志service-final-netstat.txt。未用viewport override，无需恢复。最初在服务启动前创建的连接错误页1是data URL，Browser Use URL策略拒绝选取关闭；不绕过策略，清理边界记录在browser-cleanup.json（普通游戏页已关闭，错误页仍列出，工具默认临时页于回合结束回收但本报告不冒称已核验其回收）。最终浏览器警告/错误日志为空。无主目录、冻结产品或原game.js写入，无提交。
