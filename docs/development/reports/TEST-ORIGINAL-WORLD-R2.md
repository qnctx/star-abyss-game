# TEST-ORIGINAL-WORLD-R2

结论：**FAIL，仅 WORLD 静态查询与显示范围**。两项阻断：W-R2-01 蓄力足底穿地、W-R2-02 死亡整尸悬空。四地点 R2 同版原输入实走完成；未把驾驶、AI或真实业务整合列为通过。2026-09-12封存；不修改被测源码，修复须新冻结、新TEST。

唯一受测源：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-ORIGINAL-WORLD-R2`；version SHA256 `e7f13376d896e62f03eb3c36172ada0dba8a5fa8439b3e58931fb015cd7d0dfb`。测试树 `C:/Users/HUAWEI/.codex/worktrees/4a51/star-abyss-game`，初始 HEAD `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4` 且 tracked 干净。先核验 187 基线与 R2 外清单 26 文件，旧 HEAD 差异以 git diff HEAD 确认干净（包含检出换行差异），逐项备份 old-head 再装入。没有改被测产品三源、原 main/scene/game.js 或冻结交付。

证据：`artifacts/tests/TEST-ORIGINAL-WORLD-R2/`；初始逐项清单 initial-hashes.json，结束时 final-hashes.json，完整测试证据清单 evidence-manifest.json。开发历史截图仅作为冻结文件核验，不作为本轮实机通过证据。

## 已确认缺陷 W-R2-01：windup 足底穿地

冻结 index.mjs 在 update 中给整个 body 设置 rotation.x=-.22；腿为其子节点，按未倾斜髋部位置求地形后再跟随 body 旋转，导致足底穿入或悬在地形。营地敌人 (95,87)、yaw=0、hp=10、phase=windup，最低蹄顶点经原 PlaneGeometry 三角面 Raycaster 独立求地面后，净空 -0.1232626868 米。四地点×yaw 0/π4/π2/π/4.9×time 0/0.17 的最差值为 -0.14421453 米。该问题属于 WORLD 显示自身，不归咎于 CORE/AI。

精确复现：`node --test artifacts/tests/TEST-ORIGINAL-WORLD-R2/independent.mjs`，第5项应失败；见 independent.tap、independent-measurements.json。没有写入页面内部坐标或运行状态；失败在独立 Three fixture 中复现，并标明与实机静态 idle fixture 不同。

修复验收条件：重新冻结新版本、另开新 TEST；四处坡地、多 yaw、多运动时间与 windup 均应使用原渲染三角面验证。站立接触脚不得穿地超过4厘米，摆动脚应有明确离地语义；不以抬高全身掩盖前后脚穿地/悬空。死亡整姿态另验，不把尸体全部蹄底必须贴地作为要求。R2 不修改。

## 已确认缺陷 W-R2-02：死亡整尸悬空

冻结 index.mjs 使用 body.rotation.z=π×0.43、body.position.y=.75 固定倒地姿态。独立遍历整只敌人所有mesh真实顶点（不限于蹄底）求最低点，再对原渲染地形做射线：四地点×五yaw的20样本最低点仍高于地面0.08302~0.16096米；营地yaw=0为0.1541913017米。由于整尸最低点仍离地，不能解释为正常侧卧脚抬起。

复现：`node --test artifacts/tests/TEST-ORIGINAL-WORLD-R2/corpse.mjs`，输入定义位置、hp=0、alive=false、phase=dead、yaw=0；corpse.tap / corpse-measurements.json。独立fixture显示检查，不冒称实际击杀。修复后新版本须用整尸真实顶点和原渲染地面证明接触（±4厘米），并补死亡过渡、不改权威位置/业务；新TEST重验。

## 自动检查与边界

- 6 个冻结开发 Node 用例全部通过，developer-tests.tap。
- 独立固定地点、稳定资源 ID、12源4敌、原6公里地形索引三角面与查询插值对照通过。
- 原墙门/道具三维盒射线、门开闭 LOS、错误坐标/半径拒绝通过。40块原静态岩石用原 rock-render-chunks 构建后独立射线，80点真实渲染表面与碰撞高度一致，穿岩 LOS 拒绝；rocks.tap / rock-measurements.json。
- 深冻结 view 不写权威，缺失隐藏，采尽残留，死亡恢复，掉落删除，240/360/180米严格LOD边界，2000次不同掉落ID更替后几何/材质保持相同引用，dispose两次只释放一次且不动旁系scene对象，通过。这是分配复用与生命周期测试，不是浏览器长时堆内存证明。
- idle 足底范围 -0.01254~+0.01967m；patrol/chase/return -0.01472~+0.08425m；windup -0.14421~+0.10344m。运动范围是接触数值，不代表 AI/碰撞移动通过。每种地点/yaw/phase/time 最低点均另有真实地形三角射线对照。
- 缺失/非有限 player 隐藏，非有限 enemy 坐标隐藏；null view、非数组集合/null成员抛 TypeError。当前契约要求结构化view，未承诺错误集合容错，因此记录但不另判缺陷。
- 实测资产为4 geometry、8 material；开发报告“9 material”与实际不符，是文档计数差异。

## 原游戏浏览器实机

专用 cua_repl 打开独立 `http://127.0.0.1:43261/playable/star-abyss.html`，未占用其他测试端口。实际DOM script为 `/world-preview.js`，兼容原 game.js query 后替换；canvas.dataset.worldModule=expedition-world。served SHA256 `9f453f2d1e7a6e813a9d683cf4e2d365a804aa8d8b6d88168a4d2723d0735b9e`，22,844,463 bytes。served.json。HTTP200、原角色画面和开发旧截图均未单独当作挂载证据。

所有移动使用原 = 自动前进、拖动转向、V/F原输入；等待为真实墙钟步行，没有 evaluate 改坐标、内部 advance、dispatchEvent 或其它输入注入。只读 DOM 用于坐标/HUD/渲染统计采样。专用端口全新存储，从开始调查(0,190)出发。

- 营地：(0,190)→(0,145)→(0,52)→(70,94)→(87,103)。转向拍摄 camp.png，WORLD4可见、原角色/星空与矿簇/掠兽同场。
- 原维修：(98,64) F回收动力芯→(75,79) F修车→F登乘原(72,80)载具，V驾驶第一人称→F下车(75,80)。vehicle.png、vehicle-first-person.png。持续驾驶未测；上车不等于驾驶通过。
- 东侧：(75,80)按119°步行，经(364,241)/(583,362)/(778,470)/(1083,639)至(1172,688)，再近看(1180,675)。east-arrival.png / east-hooves.png 可见原镜阵、矿簇、掠兽与足底；途中远处LOD截图 east-transit.png。
- 北侧：从(1180,675)按约1°步行，经(1189,234)/(1199,-224)/(1207,-554)/(1215,-952)至(1218,-1071)，再近看(1227,-1077)。north-arrival.png / north-hooves.png；原石柱/南侧开放通路与矿簇/掠兽同场。
- 西侧：从(1227,-1077)按约233°持续步行，经(922,-847)/(592,-598)/(376,-435)/(149,-263)/(-141,-44)/(-357,119)/(-598,301)/(-836,481)，最后原拖动调229°→(-861,500)→(-1015,634)→(-1041,657)→(-1062,675)，近看(-1058,672)。west-arrival.png / west-hooves.png / west-original-survey.png，原断环设施与开放侧可见。一次45秒等待超过工具默认30秒导致绑定重置，重新获取同URL页面观察后用原W明确停止，再继续短步；没有重载、设位置或绕过用户停止指令。

四点及连接途中未发现 WORLD 新增视觉/碰撞物阻挡原路线；原设施保留，1280×720原中文UI可读、底部按钮可见，F/V/Esc均实际操作。原调查设施的完整任务/门禁流程未测，不把开放侧可见和通行当作全任务完成。

LOD：east-transit.png和north-transit.png为远处隐藏；西侧(-836,481) worldVisible=1，仅敌人，近处=4，资源恢复显示。全为R2同版。静态足底几何验证四点通过，东/北/西另有第一人称近景；camp.png为营地实际同场视图。

最后在单独的、显著标记“独立表现fixture，无战斗/存档”的HTML页面，亲自cua_repl点击idle/windup/dead，fixture-idle.png / fixture-windup.png / fixture-dead.png作为缺陷辅助画面。该入口只存在测试证据目录，不替代原产品入口，不作为实际击杀证据。

实机静态 view fixture 没有真实战斗/采集存档。AI追击/路径规划、动态载具阻挡、真实命中/奖励/库存/掉落根状态、重载业务一致性、完整旧调查任务/门禁以及持续驾驶不在此次已测结论内，需 CORE 根状态联合入口另开整合TEST。

性能为本机1280×720各地点约1秒均值样本，DOM字段源于原renderer只读统计。机器信息见machine.json，route-log.json记录位置/画面状态。示例西侧远处(-836,481)、第三人称、1对象：19.80ms/55calls/259800triangles；西侧近处(-1058,672)、第一人称、朝301°、4对象：16.66ms/30calls/179774triangles。不同地点/视角不可直接比较为优化收益；不宣称长时P95、低端机或整体游戏性能达标。最终浏览器error/warn日志为空（browser-final.json）。

## 复跑与交付完整性

从本测试树运行 `node --test playable/tests/expedition-world.test.js` 应6/6通过；`node --test artifacts/tests/TEST-ORIGINAL-WORLD-R2/independent.mjs` 应4通过1失败；rocks.mjs与state-boundaries.mjs各1通过；corpse.mjs应1失败。共14项，12通过、2个明确几何缺陷失败。失败不是环境或缺失依赖导致。

结束复核：基线187/187、R2外清单26/26的冻结源与本树字节均与原清单一致；version SHA仍为指定值，详见final-hashes.json。Three/原角色和装备4依赖哈希一致，readonly-dependencies.json。报告与全部证据（含测试脚本、TAP、截图、备份、测量）见evidence-manifest.json。原入口暂停后关闭本轮两测试tab，自有43261服务PID35316已停止，未停止其它端口。测试结束停止扩展，通知总控及WORLD开发，等待新冻结后由全新TEST验收。
