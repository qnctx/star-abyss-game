# TEST-ORIGINAL-UI-R3

结论：**PASS，限冻结 DEV-ORIGINAL-UI-R3 的独立 UI 修复验收；B1 原生 Shift+Tab 仍为 CORE 控制门联合边界，未通过本 fixture。** 旧失效焦点 P2 和768导航背景重叠 P3 均未复现。没有修改产品，也没有把 fixture 展示数据或开发联合记录算作真实战斗/仓库业务通过。

2026-09-12；独立树 `C:/Users/HUAWEI/.codex/worktrees/28db/star-abyss-game`；总控 `01a094be-fe94-7c23-9b24-13f777c81d8d`。本轮证据 `artifacts/tests/TEST-ORIGINAL-UI-R3/`，与旧R2只读证据分开。

## 来源和隔离

读取控制树c0e3冻结R3报告、preview及fixture说明，主目录 `E:/myProject/star-abyss-game/docs/development/reports/TEST-ORIGINAL-UI-R2.md` 和旧独立测试fixture/脚本。主目录不是控制树，首次路径定位失败后由git worktree list确认主路径；未修改主目录。没有使用D1独立小场景。

装载前git status为空，HEAD `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`。先完整校验 ORIGINAL-BASE-R1 的187文件及 DEV-ORIGINAL-UI-R3 的45文件 bytes/SHA，再覆盖当前干净测试树；4个旧tracked文件及基线CSS覆盖前均备份，见setup-audit.json/head-backup。基线manifest SHA `d04e06cd54805dd679124a9924bd3f5d2645674d7926e3976da61b746188488e`；R3 manifest SHA `92749c65c389d6b7d11cc0594744a29ff47c401e2adbffcba59b855ca5e92095`。冻结源码、旧证据、原bundle/main/scene/input未改。最终哈希复验见final-hashes.json。

自有端口4237，preload仅把冻结preview的listen端口4196替换为4237；console仍显示冻结原文字4196，不作为端口依据。独立HTML来自已核验原HTML，仅加base及本轮测试fixture，仍加载原game.js；资产只读映射主playable/assets。专用mcp__cua_repl显式IAB localhost入口，真实点击开始/继续调查进入原月面/星空，390 V显示原角色。loaded-dom.json记录真实script raw/resolved URL、CSS、全视口canvas和唯一expedition-hud。没有私有CDP连接、注入键鼠事件或改原input。本轮没有工具要求stop；selector/等待超时仅观察后恢复。

实际HTTP响应字节与本地冻结副本一致（http-hashes.json），不是只看HTTP200：

| 资源 | served SHA256 |
| --- | --- |
| `./game.js?v=c2-idle-fix-20260909`（相对原playable基址） | `9703737f30428f905906ae38e8934a46ef8f01e9ffc0e4e2bb9e5d2d5d9049d9` |
| `src/expedition-ui/index.mjs` | `404b50c71f30dca855f5763b4c008b8e37a42392643153ac695bd7796338ff2c` |
| `css/game.css` | `4125a8d07d4c7d358bacb0e8059b5634d78bc248a030b788d2b49afd792732f1` |
| `src/expedition-ui/version-r3.json` | `bf3d932c8a3f0b858e39e4e193a7b33a0940747b3008c456e93812d8dd717739` |

## 验收结果

| 项目 | 本轮结论与证据 |
| --- | --- |
| Node回归 | 12/12；node-regression.tap。本轮执行旧独立8项+开发4项，不称新独立用例 |
| 旧独立DOM回归 | 24/24；independent-dom.json。旧删除/禁用/停仓3失败已转通过，含单次store、未知数量、destroy exact style/listener/observer及10次remount |
| 四种焦点失效 | PASS；native-remove/disable/storage/pending.json及390截图，每种真实2.2秒延时、before为ore-id存入按钮、after为enabled data-close；随后trusted Enter使面板hidden，焦点归还背包 |
| 新增取出按钮边界 | PASS；native-extra-take-fallback.json，herb-id在停仓/pending后均enabled关闭；停仓内容缩短scroll由22.4合理夹到0，pending保持22.4 |
| 稳定label | PASS；native-label.json，ore-id同节点、scroll保持0 |
| 连续HP | PASS；native-hp120.json，120次30ms真实计时更新全部same，目标ore-id；120帧是1项序列，不计120个用例 |
| 40行尾项重排 | PASS；native-reorder.json，long-39 sameNode、quantity7，scroll前后2036；390-long-bottom.png显示末尾中文、取出与固定关闭；真实take发herb-id请求 |
| 数值/空态回归 | PASS；projection-modes.json与截图，null/非法类型为未知，缺items与[]分别显示信息未知/暂无物资，新增空字符串HP/quantity仍未知；DOM/Node验证disabled |
| 四宽短长+原T | PASS；layout-matrix.json，390/768/1280/1920×900，8次T真实点击，8按钮×3采样×8组=192/192命中；面板内容无横向溢出、canvas维持视口 |
| 768导航间隔 | PASS；短长导航底162.1，面板顶174.1，间隔约12.000004px；8组navigationOverlap均false；768短长toast截图人工核对 |
| 四宽附近提示 | PASS；nearby-full.json检查完整容器含交互按钮，与仪表/捕获/导航/toast/菜单/任务/位置无相交；4次交互按钮中心可命中 |
| 四宽M、390 J/U/V | PASS（原菜单与渲染范围）；nearby-map.json、original-JUV.json及截图，原菜单显示时新增HUD隐藏，Esc/返回探索后恢复，V切到第三人称角色 |
| 销毁后原Tab | PASS；native-destroy.json，HUD计数0，trusted Tab打开journal-screen，焦点close-journal-button |
| B1原生Shift+Tab | **FAIL / CORE联合边界**；native-shift-tab.json，关闭按钮上Shift可信，原input先抢canvas，Tab可信但最后到ore-id存入而非末尾herb-id取出 |

四种失效的同步after均为BUTTON、close=true、disabled=false、inPanel=true，未停BODY/旧节点/disabled。Enter后panelHidden=true且aria-expanded=false；这一步为原生键盘后续操作，不是只验证同步DOM断言。取出额外边界也从真实点击herb-id开始。

布局截图已核对八组中文短长列表、390尾部及原角色。专用滚动视窗边缘半行裁切可滚入，列表没有横向裁字；固定关闭可达。390导航在下方，gap字段为负只表示上下关系，不等于相交，应以navigationOverlap和矩形看待。面板覆盖后方任务等非操作场景HUD是既有菜单布局，本结论不声称所有产品矩形零相交。右上TEST控制条为测试装置，展开会盖背包区域；矩阵时已收起，不把其占位区域算产品无遮挡证据。

## 执行误差和未测范围

首次展开控制时点击背包实际命中label，产生无有效itemId样本并进入原暂停；已保存native-first-attempt.json，不计该label为PASS。为可复跑，在本轮fixture增加重置短列表按钮，并让延时按钮自动收起控制，再真实点业务按钮；只改测试fixture。HP等待工具约3秒提前超时，随后只读完成HP120和120条序列，不重发刺激。附近碰撞初次误用原容器ID导致null；查DOM确认class后重做，nearby-map.json只测文字框，最终完整容器以nearby-full.json为准。

未修改input来绕过B1。总控转述CORE开发联合结果（a6f0的27-ui-r3-native-focus.json等）仍只是外部开发证据，未读取并算作本独立PASS。真实营地IDB事务、末份存取、暂停simTime/HP及输入恢复，须由单独CORE联测确认。

本fixture仅权威投影与请求日志；不证明真实攻击/采集/伤害/死亡/救援成功、库存原子保存/满包拒绝/刷新读档。没有持续实机驾驶、修车路线或完整任务流程测试，均明确未测。V切第三人称、原地图、6×6km入口标识和原canvas渲染不能替代驾驶/世界全流程验收。极端矮屏、其他宽度不在本轮范围。

## 复跑与清理

已装入冻结，不要重跑setup覆盖现场。Node：`node --test playable/tests/expedition-ui.test.js playable/src/expedition-ui/evidence-r2/projection-replay.test.mjs artifacts/tests/TEST-ORIGINAL-UI-R3/projection.test.mjs`。启动自有服务：`node --require ./artifacts/tests/TEST-ORIGINAL-UI-R3/preload.cjs playable/src/expedition-ui/preview.cjs`。使用上述独立URL，具体原生步骤见artifacts/tests/TEST-ORIGINAL-UI-R3/cases.md。evaluate只读，样本由真实控制按钮触发。

结束已恢复viewport、关闭本轮IAB页、停止自有服务42542；finalize.cjs复验4237 ECONNREFUSED、232份冻结源及叠加后本地文件。evidence-manifest.json包含本轮脚本、原生截图、JSON、TAP、备份及本报告SHA，自身除外。没有创建修复补丁、合并、替换主bundle或修改冻结文件。本独立UI修复验收结束。
