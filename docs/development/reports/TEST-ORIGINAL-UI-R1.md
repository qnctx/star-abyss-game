# TEST-ORIGINAL-UI-R1

结论：**FAIL，仅针对冻结 DEV-ORIGINAL-UI-R1 的界面模块范围**。确认三类阻断验收的问题：未知数值被投影为零；390 窄屏新增界面遮挡原 HUD；仓库标题更新导致物资操作焦点丢失。另有真实 Shift+Tab 的输入协调失败，列为 CORE 联合验收边界，不能用隔离 DOM 通过代替实机通过。未修被测实现；修复必须冻结新版本、另建新 TEST。

测试日期：2026-09-12。独立任务工作树：`C:/Users/HUAWEI/.codex/worktrees/1325/star-abyss-game`。总控：`01a094be-fe94-7c23-9b24-13f777c81d8d`。全部证据位于本工作树 `artifacts/tests/TEST-ORIGINAL-UI-R1/`。

## 冻结来源与隔离

- 先读主目录 `E:/myProject/star-abyss-game/docs/development/ORIGINAL_GAME_REBASE.md` 及冻结 `docs/development/reports/DEV-ORIGINAL-UI.md`。
- 唯一来源：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/DEV-ORIGINAL-UI-R1`，manifest 26 文件。版本文件 SHA256：`a8f4ab39bb5ef27407756816731c3026095e8bc86163ecdac5c07441634ac714`。
- 同目录上级交付 `ORIGINAL-BASE-R1` 的 187 文件先逐个核对 bytes/SHA，再装载。初始 `git status --short` 为空；与快照不同的 4 个 tracked 文件逐个比对 HEAD（允许 CRLF 规范化），备份到证据目录 `head-backup/` 后替换。没有覆盖未知脏改动。
- 覆盖前原 CSS SHA256：`5999e0bc1cb0d5140d31292e3008d159933a5649ef8accb2f0178466d4a97d80`。R1 CSS 完整保留基线前缀，后附新增规则；新增规则也修改原 `.compass/.navigation-hud/.location/.suit-status/.hud-controls/.capture-hint`，所以不能只验新增面板。
- 最终：冻结基线 187/187、冻结 UI 26/26、自有 UI 26/26 均通过；自有原基线除授权覆盖 CSS 外 186/186 相同。原 `game.js`、main、scene、ui 未修改。未写主目录、被测开发目录、冻结快照或资产。
- 自有服务绑定 `127.0.0.1:4207`。仅使用测试目录 `preload.cjs` 将冻结 preview 的 listen 4196 改为 4207 并保存输出，业务代码未修改。冻结 preview 的 console 仍显示 4196，是其原文本，实际访问与资源证据均为 4207；没有占用 4196/4173。测试结束已停止该服务，恢复视口并关闭自建标签。

## 加载真实性与测试方法

专用 `cua_repl` 以明确 URL 初始化 IAB：`http://127.0.0.1:4207/playable/star-abyss.html`。没有调用 Windows SendInput、私有 CDP 或其他浏览器自动化后门，也没有遇到本轮策略停止。

亲自点击“继续调查”进入原全屏月面、星空和原角色。DOM 显示 `#world` 为原 Three canvas，新增 `.expedition-hud` 数量为 1。原 script 实际 src 为 `/playable/game.js?v=c2-idle-fix-20260909`；新增 fixture 模块 src 为 `/playable/src/expedition-ui/fixture.mjs`。读取实际 URL 的响应体做 SHA 比对，不能以 HTTP200 代替挂载：

| 文件 | SHA256 | 结果 |
| --- | --- | --- |
| 原 game.js（含上述 ?v= 请求） | `9703737f30428f905906ae38e8934a46ef8f01e9ffc0e4e2bb9e5d2d5d9049d9` | 冻结字节一致、原场景真实渲染 |
| game.css | `af7cfb0bce87254f18bec9e2a5084cbc846a8b6c97d66ee051d80432c60f4d6f` | 冻结字节一致、样式实测 |
| expedition-ui/index.mjs | `b25a93f836cf3d0496f217fd83be9684dde4dc95e5c33944956b9d373e4b5b4c` | 冻结字节一致、HUD/事件实测 |
| 冻结 fixture.mjs | `5aa9e1233c01c703b15b1575cd93a81bee8a23a179b8358874b56045ad623ec9` | 冻结字节一致 |

证据：`loaded-dom.json`、`http-hashes.json`、`1440-world.png`。CSS 无版本 query；未杜撰所有资源都有 `?v=`。资源校验与 DOM/真实点击共同证明加载。

独立 fixture 是测试目录 `independent-fixture.mjs`。`build-harness.cjs` 从已校验原 HTML 生成测试页面 `independent.html`，仅加 `<base href="/playable/">` 和独立 fixture script，继续加载冻结原 bundle、UI 和 CSS。该页面与测试控制按钮都不是产品入口。它提供长列表/未知投影/定时更新和 DOM 断言，业务动作只记录，不改原游戏库存或保存。浏览器 `evaluate` 仅作 DOM 只读测量；测试刺激由真实点击/键盘或明确标记的独立 fixture 执行。合成 DOM 点击和键盘断言未冒充原生实操。

资产由冻结 preview 只读映射主目录 `playable/assets`；没有重建原 bundle、复制全部资产或使用动态开发目录。

## 按范围判定

| 模块/范围 | 判定 | 证据与限制 |
| --- | --- | --- |
| 冻结来源与加载 | PASS | 187 基线、26 UI；最终哈希、实际原场景和动作 |
| 开发 Node 3 项回归 | PASS 3/3 | `developer-node.tap` |
| 独立 Node 5 项边界 | FAIL 3/5 | null HP、null 容量两个失败，`independent-node.tap` |
| 短列表 1440/768/640/390 × 900 | PASS（短列表限定） | 每宽度原 T/C/V/U/J/M/Esc 与关闭/存入/取出 10 按钮，共40中心命中且无按钮横向溢出；画布宽度1440/768/640/390.4，高度900 |
| 长中文40行及滚动 | 部分 PASS，整体 FAIL | 四宽度无面板横向溢出；390滚到第40行及仓库，关闭头固定、取出实点可用；390面板覆盖原T按钮，见D2 |
| store/take/rescue/attack | PASS（请求层） | 原生点击/Return日志含稳定id与quantity:1，attack不是skill；库存仍2/3，救援未改变生命 |
| pending/error/mounted | PASS（投影层） | pending禁用攻击/存取；失败显示保存失败且数量不变；mounted禁用攻击、隐藏附近按钮，原HUD保留 |
| storage.enabled / unit | PASS | enabled=false无存取按钮；格/L/kg正确；缺单位明示“单位未提供” |
| 未知投影 | FAIL | undefined/NaN/Infinity与未知save enum保留未知；null/空字符串变0，见D1；未提供items仍显示“暂无物资”，也不能据此证明空库存 |
| 重复render/listener/destroy | PASS | 100次更新一次store回调；destroy幂等、root移除、keydown移除；10次创建销毁无监听遗留；原生destroy后Tab仍开原地图 |
| 持续update焦点 | FAIL | 120次仅生命更新保留焦点；仓库标签更新丢焦点，见D3 |
| Tab/Esc/关闭恢复 | PASS（普通Tab/Esc） | Tab从关闭到存入，Return发store；Esc关闭且返回背包按钮；隐藏HUD不拦截原Tab |
| Shift+Tab | 实机 FAIL / 联合边界 | 独立合成反向循环通过；原bundle启用input时真实Shift抢焦点，见B1，不宣称实机通过 |
| 原M/Tab、J、U互斥 | PASS（冻结fixture协调范围） | 开背包后实点原M/J/U，新增HUD隐藏并关闭；原Tab开/关地图正常，焦点回原world |
| 原T、V | PASS（界面/观察限定） | 实点T导航变动力耦合芯回收匣46m；V切第三人称出现原角色，再切回第一人称 |
| menu权威/toggle通知 | PASS（接口模拟） | 模拟CORE只处理menu、忽略toggleInventory通知，单次打开和关闭各一次权威变更；不代表真实CORE已接入 |

独立 DOM 两批证据分别为 `independent-dom.json`（含120次计时更新的逐帧采样）与 `independent-dom-final.json`（13条断言，11通过、2失败均指同一仓库标签焦点缺陷，含一次原生定时更新复现）。不要把逐帧采样数当不同测试用例数。

## 缺陷与修复验收条件

### D1 / P2：未知数值被强制转成零

位置：冻结 `playable/src/expedition-ui/index.mjs:3`。`Number(null)`、`Number('')` 得到0，既影响生命/灵力也影响容量。

复现：运行 `node --test artifacts/tests/TEST-ORIGINAL-UI-R1/projection.test.mjs`；或独立页面继续调查，选择“空值数据”，打开背包。投影 `{player:{hp:null,maxHp:null,resource:'',maxResource:''},inventory:{slots:{used:null,max:null}}}`，实际生命/灵力 `0 / 0`、格数 `0 / 0`。截图 `390-null.png`。未定义字段显示破折号，只测 undefined 会漏掉该缺陷。

预期与复验：null、空白、无效类型及非有限数字显示未知；合法0仍显示0；数量null保持破折号；缺失items与明确空数组应区分未知库存/空库存；未知save不显示成功。当前“缺失数据”场景显示“暂无物资”，见 `390-missing.png`，不得解释为真实库存已知为空。

### D2 / P2：390窄屏新增布局遮挡原HUD

位置：冻结 `playable/css/game.css:37`、`:48`、`:50`（面板高度/窄屏原仪表及附近提示布局）。原CSS前缀未变，不代表追加规则没有回归。

复现A：390×900，独立场景“长中文40行”，打开背包。面板 rect 为 x8、y145、w374.4、h655，底部800；原T按钮 rect 为 x26.8、y749.1、w139.2、h30.9。原按钮中心(约96,764)被新增第10行文字覆盖。实际点击该坐标后焦点在面板，导航不变；只读命中返回物资span，不是原T。证据 `390-long-top.png`、`390-long-blocked-track.json`、`layout.json`。关闭背包后原T可点，短列表亦可点，明确是内容增长触发。

复现B（截图观察）：390关闭背包、正常fixture时，新增附近交互横条覆盖左侧原玄壳提示文字，并与原鼠标捕获提示相交。见 `390-track-third-person.png`；这不证明业务输入暂停/驾驶。初入原场景的临时原toast还可能盖在背包物资文字上，`390-long-top.png` 保留了该现场，不应把它剪掉后宣称完全无重叠。

预期与复验：四指定宽度在短/长列表及附近提示可见时，原T和所有原菜单按钮均可正常点击，中文提示不相互遮盖；长列表只在专用内容区域滚动，关闭头不离屏，画布仍全屏。应按原HUD实际占用区域安排面板和提示，不能仅提高新增z-index隐藏问题。640/768/1440长列表的T中心命中通过，见 `long-widths.json`。

### D3 / P2：仅仓库标签变化就重建物资按钮并丢焦点

位置：冻结 `playable/src/expedition-ui/index.mjs:74`、`:75`、`:44`。inventoryKey把整个storage对象纳入同一key，标签变化会对背包和仓库两侧都执行replaceChildren。

复现：独立页面正常场景打开背包，点击“延时仓库标签更新”，立即点击“存入1”令其获得焦点。2秒后仅storage.label更名，items/id/quantity和pending都不变。焦点由 `<button>存入 1</button>` 变成BODY。原生回调与独立DOM断言均失败：`native-label-focus.json`、`independent-dom-final.json`、`390-label-focus-lost.png`。

预期与复验：独立更新仓库label或其他列表外字段时，当前物资按钮焦点和滚动位置保持；列表确需重建时按稳定id恢复仍有效的操作焦点。原先100/120次仅HP更新仍应通过，单次点击只发一个请求，destroy清理继续通过。

### B1：真实Shift+Tab被原input抢焦点，须CORE联合验收

已亲自尝试真实组合键，不能报告通过。独立键盘记录捕获 `Shift` 与 `Tab` 均 `isTrusted:true`、Tab的shiftKey=true；Shift事件时focus为关闭按钮，Tab到达前focus已变成canvas。因此从关闭反向应去“取出1”，实际去了“存入1”。`independent-dom.json` 的keys保留证据。较早小写`shift+Tab`调用无焦点变化，只保留为尝试，不作为正向证据。

对应原冻结 `playable/src/input.mjs:9` 将Shift列为移动键，`:62`会capture，`:27`调用canvas.focus。该fixture没有接CORE输入释放，不能要求本UI测试偷偷改原input来获得通过。合成只发带shiftKey的Tab时反向循环通过，证明该结果与完整按键序列不同。修复/联合验收条件：CORE打开新增菜单时释放/停用原输入，真实Shift+Tab、Tab、Esc、Return均在菜单内工作；关闭后再恢复世界输入和焦点，不双切menu。暂停战斗、I/R/H业务必须另作真实集成实测。

## 原生动作与证据索引

`native-actions.json` 保留冻结fixture控制台动作时间、URL和JSON；`native-observations.json` 保留焦点、菜单、库存读数；`independent-final-actions.json` / `independent-before-reload.json` 保留独立fixture记录。所有inventory/rescue内容均明确是fixture，未把mounted当实际驾驶。

| 实操 | 证据 |
| --- | --- |
| 1440进入原月面、背包、Tab/Return存入、实际点击取出、Esc/关闭归还焦点 | `1440-world.png`、`1440-inventory.png`、native动作/观察JSON |
| 768背包/pending；640背包/error/rescue及点击返回安全站 | `768-inventory.png`、`768-pending.png`、`640-inventory.png`、`640-error.png`、`640-rescue.png` |
| 390背包、mounted投影、原T追踪及V双视角 | `390-inventory.png`、`390-mounted.png`、`390-track-third-person.png`、`390-world.png` |
| 原M/Tab地图、J记录、U进化与背包互斥 | `390-map.png`、`390-records.png`、`390-evolution.png`、native观察JSON |
| 长列表末尾滚动、取出实际点击、中文自然换行 | `390-long-bottom.png`、`390-long-scroll.json`；scrollTop1724.8、scrollHeight2322、clientHeight597、scrollWidth=clientWidth358 |
| 缺失/空值/仓库禁用 | `390-missing.png`、`390-null.png`、`390-storage-disabled.png` |
| destroy后原Tab打开地图 | `native-destroy.json`：hudCount0、mapVisible true、focus close-journal-button |

证据中的右下fixture控制条可能压到原导航说明，是测试工具，不应集成到产品。D2的T按钮遮挡坐标位于左侧，命中新增物资span，与fixture控制条无关。无横向scroll不等于无视觉重叠，判定同时使用截图和实际点击。

## 复跑与未测范围

本工作树已有冻结副本，**不要再次运行setup.cjs覆盖现场**。模块复跑：`node --test playable/tests/expedition-ui.test.js`；独立边界：`node --test artifacts/tests/TEST-ORIGINAL-UI-R1/projection.test.mjs`。浏览器复现用 `node --require ./artifacts/tests/TEST-ORIGINAL-UI-R1/preload.cjs playable/src/expedition-ui/preview.cjs`，按前述4207两个URL进入。测试结束停止该进程。`setup-audit.json`记录装载前备份依据；`final-hashes.json`逐文件列冻结/本地SHA；`evidence-manifest.json`列报告与全部测试证据SHA。

未验：CORE真实I/R/H输入与业务、菜单暂停战斗/输入释放/恢复、真实伤害/死亡/救援、真实store/take原子保存、满包失败、刷新读档恢复、实际修车/驾驶、原任务全流程。现有角色和月面渲染、菜单显示及动作请求层通过不等于这些业务通过；没有测试新资产或重新打包游戏。

最终仅提供可复现缺陷与冻结证据，不修被测产品、不扩大范围、不申请合并或替换主bundle。
