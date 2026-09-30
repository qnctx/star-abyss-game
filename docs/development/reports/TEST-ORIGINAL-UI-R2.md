# TEST-ORIGINAL-UI-R2

结论：**FAIL，限冻结 DEV-ORIGINAL-UI-R2 界面模块**。D1 已修复；D2 的原390长列表遮挡已修复，但768仍有布局边缘残留，不能声称所有矩形零相交；D3 的标签/HP/重排保焦点通过，**删除或禁用当前项目没有可操作的焦点退路（P2）**。真实 Shift+Tab 继续实机失败，单列 CORE 输入释放联合边界 B1。没有改被测源码；修复应冻结新版本，再开全新 TEST。

测试日期：2026-09-12。独立工作树 `C:/Users/HUAWEI/.codex/worktrees/eead/star-abyss-game`；总控 `01a094be-fe94-7c23-9b24-13f777c81d8d`。全部新证据位于 `artifacts/tests/TEST-ORIGINAL-UI-R2/`。这是独立单版本复验，未续旧 TEST。

## 来源、隔离及实际加载

先读主 `E:/myProject/star-abyss-game/docs/development/ORIGINAL_GAME_REBASE.md`、主 R1 TEST 报告，以及冻结 R2 开发报告顶部。唯一源码为总控工作树 `c0e3/.../artifacts/deliveries/DEV-ORIGINAL-UI-R2`，**43文件**；版本文件 SHA256 `27de348c55a7a89ed03f2a179596ea7a8373e102d201fa113b826874e3050574`。承载基线为同级 `ORIGINAL-BASE-R1`，**187文件**，未从动态开发目录取源码。

初始 `git status --short` 为空，HEAD `5fdb455d3c46601ebd584e64bcf72a2b5c82baf4`。装载脚本先逐文件校验所有冻结 bytes/SHA，再核对已有冲突属于干净 HEAD（允许CRLF规范化）；4个旧 tracked 文件备份后替换，原CSS再次备份后覆盖R2。未覆盖未知修改。证据 `setup-audit.json`、`head-backup/`。未执行 freeze/prepare，未动主目录、冻结源、旧R1证据、原bundle、main、scene、input及资产。

专用 IAB 由 `cua_repl` 明确 URL 打开 `http://127.0.0.1:4227/playable/star-abyss.html`，实点开始/继续调查进入原月面、星空、飞船和角色。自有 preload 仅把冻结 preview 的 listen 4196 改到4227；原console仍输出4196是冻结文本。资产只读映射主 `playable/assets`。无私有CDP、OS输入或策略绕过。本轮未遇策略停止。结束已恢复视口、关闭自建标签、停止自有服务，最终连接4227返回ECONNREFUSED。

`loaded-dom.json`记录真实原HTML script src、CSS和挂载：原canvas全屏，`.expedition-hud`恰好1个。`http-hashes.json`读取实际URL响应字节并比对冻结本地副本，不以HTTP200代替验证。

| 实际资源 | SHA256 |
| --- | --- |
| `/playable/game.js?v=c2-idle-fix-20260909` | `9703737f30428f905906ae38e8934a46ef8f01e9ffc0e4e2bb9e5d2d5d9049d9` |
| `/playable/css/game.css` | `4125a8d07d4c7d358bacb0e8059b5634d78bc248a030b788d2b49afd792732f1` |
| `/playable/src/expedition-ui/index.mjs` | `37907711fc7912705b58c633dacc053186c98fe40d9b2f5f153bf92576d66699` |
| `/playable/src/expedition-ui/fixture.mjs` | `5aa9e1233c01c703b15b1575cd93a81bee8a23a179b8358874b56045ad623ec9` |

独立页面为 `/artifacts/tests/TEST-ORIGINAL-UI-R2/independent.html`，从已核验原HTML仅追加base和独立测试fixture；继续加载原game.js、R2 CSS和UI模块。独立fixture提供样本、按钮、定时刺激和DOM断言，未接CORE或写真实HP/库存。浏览器evaluate仅只读DOM；样本刺激在测试fixture，真实按钮和键盘由cua执行。新Node测试初次导入路径写错，修正测试路径后3/3通过，未改产品文件。

## 执行结果

| 范围 | 判定 | 本轮证据 |
| --- | --- | --- |
| 冻结来源、加载、结束哈希 | PASS | 187基线、43UI冻结全通过；本地除授权CSS覆盖外一致；`final-hashes.json` |
| 原独立projection 5项 + 开发Node 4项 | PASS 9/9 | `regression-node.tap`；仅回归 |
| 新独立Node边界 | PASS 3/3 | `projection.test.mjs`、`independent-node.tap`；非法类型矩阵、合法0/数字串、保存状态 |
| 冻结开发DOM replay | PASS 12/12 | `developer-dom-replay.json`；只算回归，不算新独立 |
| 新独立DOM | **FAIL 21/24** | `independent-dom.json`；3条失败均为下述D3退路；数量类型逐项计数，未把120帧当120用例 |
| D1数值/quantity/未知库存/保存状态 | PASS | Node及DOM，`projection-modes.json`、390-invalid/missing/empty截图 |
| D2 390长40行原T、尾部take、关闭 | PASS | 实点T导航变为131m巡迹勘探车；滚至40行并实点take；固定关闭可达，截图及动作记录 |
| D2 四宽长短+toast | 功能通过，零相交要求未完全满足 | 8组每组原T/C/V/U/J/M/Esc/关闭3点采样全部通过，共192点；8次T实际点击；768导航背景边缘相交7.1px，见下述D2余项 |
| D2 附近提示、尺寸切换、全屏 | 限定样本PASS | 四宽nearby无与仪表/捕获/导航/toast/按钮相交；原画面中文截图审视；`layout-matrix.json`、`open-panel-resize.json` |
| D3 label/120HP/末尾重排quantity | PASS | 真实延时2.2秒后更新，`native-label.json`、`native-hp120.json`、`native-reorder.json` |
| D3 删除/disabled/仓库停用退路 | **FAIL / P2** | 独立DOM3失败；native-remove/disable.json再次原生复现 |
| 单次回调、destroy恢复toast、监听/observer清理 | PASS | 独立DOM含120更新后一次store、精确原style恢复、10次remount；native-destroy.json原Tab地图可用 |
| attack/menu/storage/unit/mounted/pending/error | PASS（请求/投影限定） | attack事件名正确；回归menu权威开关各一次，toggle只通知；pending禁用业务，mounted禁攻击，未虚构保存成功 |
| store/take/rescue实际点击 | PASS（请求层） | 独立最终动作log：稳定ore-id/herb-id/long-39，quantity:1；rescue只发请求，显示HP仍75 |
| 原M四宽、390 J/U/V | PASS（菜单与渲染限定） | `original-menu-checks.json`、四宽map截图、390-original-character.png；未当成驾驶/任务流程验收 |
| 原生Shift+Tab | **FAIL / CORE联合边界** | `native-shift-tab.json`；Shift与Tab均trusted，焦点先被原input夺到canvas |

独立fixture控制条位于右上，展开时会覆盖顶栏，已收起后再测产品按钮；曾一次点击背包实际落到测试label按钮，记录中第一条无itemId的label采样不作为D3通过证据。第二条明确ore-id、标签从“独立仓库”变到新名称才计通过。收起的测试条仍占右上少量截图空间，不属于产品布局；未将该区域作为零遮挡证明。长列表滚动中的半行裁切属于专用滚动视窗，完整文本可滚入；不是静态中文横向截断。

## D1复验

新独立Node分别给HP、maxHP、resource、maxResource及三种容量输入undefined/null/空串/空白/boolean/对象/数组/NaN/±Infinity及非有限字符串，均为未知；合法数值0、负0及数字串0保留0。新DOM给quantity输入同类非法值，均显示“× —”且禁用；quantity=0显示“× 0”且禁用。缺items显示“物资信息未知”，明确[]显示“暂无物资”。未知save enum显示“保存状态未知”，pending显示正在保存、error显示保存失败。未以这些样本推断真实保存已经成功。

## D2实操及残留

390×900长40行panel为x8、y145、w374.4、h302.8，底部447.8；原仪表从459.8开始，T为y749.1至780。实际T将导航从求救信号变为巡迹勘探车残骸131m，原toast在面板右下独立区域；不再复现R1长面板覆盖T。长列表滚至尾部，scrollHeight2322/clientHeight244，滚动值约2076.8，实点取出发herb-id请求；第40行和关闭均可达。随后聚焦long-39时滚动值2033.6，重排后保持。body各宽scrollWidth等于clientWidth；canvas为390.4/640/768/1440×900，亚像素宽误差0.4不算画布缩小。

四宽各短/长列表实点原T、截图保留临时toast，检查原按钮左上20%、中心、右下80%采样，不只中心命中。面板开启状态按1440→768→640→390切换尺寸另测，未溢出、关闭仍可达。截图包括 `*-normal.png`、`*-long.png`、`*-*-toast.png`、`*-nearby-matrix.png`；390-long-bottom.png核对尾行中文。附近提示与原仪表/捕获/导航及toast在上述样本分开，未隐藏附近按钮来冒充通过。

**D2余项 / P3**：768宽原导航框x556..746、y112..162.1；面板x84..684、top155，两者背景相交128×7.1px。`768-navigation-edge.json`显示实际文字最下153.3、箭头最下153.66，均在面板上方，截图未发现文字被遮，因此不标P2文字遮挡，也不能声明“所有矩形互不相交”。源码layout仅处理 `p.top > r.top + 90` 的下方障碍，对顶部已有HUD跨界不避让。修复验收应给768导航框和面板至少明确间距，并回归四宽。另关闭面板后恢复原toast位置的768附近截图中，toast贴近原位置提示下缘；未做独立原CSS对照，作为联调视觉复核项，不归因到新源码缺陷。

## D3 / P2：失效项目没有焦点退路

位置：冻结 `playable/src/expedition-ui/index.mjs:41`、`:61`、`:62`。rowList只恢复仍存在且enabled的稳定ID，未为删除、禁用、storage.enabled=false移除按钮提供可用fallback。

复现A：独立页面选择短列表，打开背包；展开测试控制，点“延时删除焦点项目”，立即收起测试控制并实点“存入1”。2.2秒后只在fixture投影删掉当前ore-id。定时记录before为BUTTON/ore-id，after为BODY，旧节点isConnected=false；未关闭背包。证据 `native-remove.json`。

复现B：恢复短列表，点“延时禁用焦点项目”，收起测试控制并实点“存入1”。2.2秒后投影quantity=0。同步记录仍聚焦同一ore-id按钮，但disabled=true；后续只读观察已掉到BODY，始终未转到可操作控件。`native-disable.json`与独立DOM同样失败。`390-disabled-focus.png`仅为UI外观，焦点判定以时序JSON为准。

复现C（隔离DOM）：当前存入聚焦时把storage.enabled设false，按钮移除，焦点BODY。DOM24项中的第15、16、17项失败。其余相关恢复通过：label更新仍是同一button；120次30ms计时HP更新120帧全保焦点；40行末尾long-39反转列表且quantity变7，ID/节点/scroll2033.5999755859375全保留。重排后焦点物品移到视窗外但scroll不变，是此次保留ID和scroll合同的结果，未把它算可见点击测试。

修复验收：当前操作项失效时立即转移至面板内明确可操作的近邻或关闭按钮；不得停在BODY/disabled/已移除节点。删除、数量归零、pending禁用、仓库停用均应验证退路，保留正常label/HP/重排身份与滚动结果，单次回调与destroy继续回归。测试不自行修源码。

## B1与范围限制

真实输入“打开背包→Shift+Tab”：Shift事件trusted=true，发生时焦点关闭；Tab事件trusted=true、shift=true，但到达前已在原canvas；最终到ore-id存入，预期是末尾herb-id取出。`native-shift-tab.json`明确保留完整序列。随后普通Tab/Return取出、Escape关闭及返回背包按钮通过。冻结开发DOM合成shiftKey Tab回归通过不等于真实组合键通过。

这是原input仍启用的fixture/CORE共同边界，未改input、未复制CORE动态control-gate。CORE接入此冻结R2或后继修复版后，必须另验真实Shift+Tab、菜单战斗暂停、关闭/退出输入恢复与单次menu权威切换。

本轮没有验证真实R/H/I战斗与采集业务、伤害/死亡/救援成功、store/take原子保存、满包失败、刷新读档恢复、修车驾驶、原任务完整流程。fixture库存显示始终是样本，攻击/存取/救援仅发请求；地图、原角色及canvas渲染通过不代表这些业务通过。

## 复跑和交付索引

已装载冻结副本，**不要再次运行setup.cjs覆盖现场**。回归：`node --test playable/tests/expedition-ui.test.js playable/src/expedition-ui/evidence-r2/projection-replay.test.mjs`。新独立Node：`node --test artifacts/tests/TEST-ORIGINAL-UI-R2/projection.test.mjs`。

浏览器复跑：`node --require ./artifacts/tests/TEST-ORIGINAL-UI-R2/preload.cjs playable/src/expedition-ui/preview.cjs`，使用4227上述原入口和独立页面。开发DOM回归页面 `/playable/src/expedition-ui/evidence-r2/replay.html`，点运行DOM断言；不要跑freeze/prepare。停止自有进程后运行 `node artifacts/tests/TEST-ORIGINAL-UI-R2/finalize.cjs`复验来源和服务关闭并更新清单。

`independent-final.json`汇总原生请求、完整trusted键序列、DOM断言和定时采样；`native-*.json`为关键过程单独保存。`layout-matrix.json`逐项记录矩形/三点命中/原导航/toast及canvas；`projection-modes.json`记录八种投影DOM；`developer-dom-replay.json`只属旧测试回归。`final-hashes.json`逐文件列冻结源及本地副本SHA，确认最终43文件未变；`evidence-manifest.json`列本目录全部脚本、截图、JSON、TAP、HEAD备份和本报告的路径/bytes/SHA，自身除外。文件清单是交付证据，不把开发截图混成独立截图。

本轮验收已结束；不修产品、不合并、不替换主bundle。完成后通知总控并停止扩展。
