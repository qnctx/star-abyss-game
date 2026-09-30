# TEST-WORLD-CREATURE-R3 — PASS（限定 B14 与加载回归）

独立测试树：`C:/Users/HUAWEI/.codex/worktrees/186b/star-abyss-game`。2026-09-13 开始；仅测试，无产品修复、无提交、无新付费。结论为 **PASS：R3 修复本冻结资产公开 loadAsset 注入的有限逆绑定不一致 B14，并通过本轮加载、释放、retry、基本动画与原入口正常加载烟测。** 不扩展为任意 glTF 校验、真实击杀/奖励/拾取或 CORE 新加载门验收。

## 冻结与历史

唯一 WORLD 测试源为 `C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries/WORLD-CREATURE-R3`。20 清单文件和外 manifest 均核验；version SHA256 `516363e9b557c8d4e894956737f5fd0cd22ab6e80f25aecb4af209cdd986811a`。九产品仅 `creature-validation.mjs` 从 R2 `83c4a19799b0c0ff1c66da6da82f081eb300e9ad8208050a0d1f6dc65df11a89` 改为 `0cd087869b4627ea1af5cec8ea1c3a2b02ae1ce94efbddbce090fff9ed281244`，其他八产品实际字节 SHA 不变。

`setup.cjs` 独立装载 ORIGINAL-BASE-R1、DEV-I-R3、UI-R3、WORLD-R3、CORE-R2 与本 R3 冻结产品，共204最终基础/产品路径。包括外 manifest 的355冻结记录独立校验。原项目 node_modules 和非怪物媒体仅只读共享；未使用开发活动代码。主项目 R2 报告 SHA `f59f2f82f5a9fb66ccb315f260aa509030332f57b1726d7bcb4928a9b22403d9` 已核验，R2 报告和旧证据共280文件记录首尾校验。前两版 FAIL 历史未修改；旧结果只作复现来源与明确基线。

## 本轮独立检查

`sandbox/independent.mjs` 11项全部 PASS；开发14项加载测试全部 PASS，仅作为回归，不冒称独立测试。额外原开发动画/世界9项亦通过，详见两个 TAP；其中原完整三角地形用例运行约55.4秒，未继续扩测或据此重新声明全地形视觉验收。

| 独立检查 | 实测结论 |
|---|---|
| 正常真实GLB | 20骨 rest-world × inverse 最大单位阵残差约6.34868e-7，小于1e-5；四个私有骨架，idle/chase/windup/attack/hurt/dead/恢复矩阵有限，源 inverse 数组始终不变。精确残差逐骨见 independent-results.json。 |
| B14 旧注入重放 | 保留真实GLB全部顶点/骨/权重，仅 LH_Lower boneInverses[3].elements[13] 加2。无初始view时 ready 返回failed，错误包含 inconsistent rest bind LH_Lower；首次idle update不抛且仍failed；零actor、所有anchor无children且隐藏。旧R2的1818点/最大1.668m变形是历史测量，本R3拒绝后不创建变形实例，不伪造本轮变形测量。 |
| 另一真实骨 | Head inverse X平移加0.025，被对应 rest bind Head 拒绝，证明不是只针对LH_Lower索引。 |
| mesh绑定两侧 | bindMatrixInverse Y加2、bindMatrix X加0.01分别拒绝；监测scene.updateMatrixWorld调用次数均0，证明发生在其刷新inverse掩盖输入之前；两侧输入数组均未被修正。 |
| 容差边界 | 真实Root inverse X增量1e-6与8e-6均ready，2e-5为failed；独立计算实际矩阵残差判定，输入inverse保留。不是任意glTF都必须恒等的断言。 |
| F1/F2 | 真实Chest/LF_Upper重命名，无view直接failed，无首次update异常，无anchor残留；正常retry恢复。 |
| 失败释放与并发retry | 六种损坏场景分别验证geometry/material/skeleton/共享texture/image.close各一次；17次并发retry共享同一promise，总loader调用2；loading的hurt被最新idle覆盖，恢复四实例，每anchor恰一个visual和contact且anchor身份不变。dispose两次不会重复释放失败源。 |
| 迟到dispose | B14失败后正常retry尚pending时dispose，迟到真实GLB五类资源各释放一次，无挂载，状态disposed，后续retry不再调用loader。未声称取消底层网络。 |

正常默认 main 通过固定长度和 SHA 后加载冻结GLB；本缺陷及修复限定公开注入loader的解码后结构契约。没有把正常生产路径描述为会加载被篡改字节。开发字节长度/SHA拒绝测试也通过。

## 原入口烟测

computer-use技能 + 专用cua_repl创建自有后台IAB tab1，端口4253。准确入口为 `http://127.0.0.1:4253/playable/star-abyss.html`。`sandbox/serve.cjs` 从冻结原main构建，只追加公开ready结果到canvas.dataset的只读观察，不添加表现fixture、不增加加载门、不改位置/时钟/业务函数。共享原角色与非怪物媒体只读。

首次访问服务根 `/`，HTML相对样式路径未解析，`native-menu.png`和browser-menu.json保留该测试器入口错误。随后使用准确原入口，相同冻结产品正常样式显示，保存 `native-menu-correct-entry.png`。本次自有端口开始调查形成的存档被继续，点击原第三人称按钮得到 `native-character.png`：原角色、地图、残骸、天空和原UI可见，位置X0/Z190，生命120/120。未进行业务击杀或表现样本代替业务验收。

`browser-final.json` 实际GLB ready / 4实例 / 43002顶点 / 35967三角 / 20骨，warn/error为空。`http.log`记录实际请求GLB 9,029,072字节、SHA `39c6cc6ddafd84f9d269026618dec68f69eb6038bbd7810245a3376f22caf879`。原角色画面正常并不声称已近距离复验掠兽美术。浏览器不允许鼠标捕获的提示存在，正常按钮可点击；没有绕过捕获、私有CDP、dispatchEvent或viewport覆盖。

F3原灯视觉、全地形支撑与模型/rig/动画八产品SHA不变，明确继承R2限定PASS，不重做完整长路或全套性能认证。CORE新加载门、真实战斗闭环保持联合测试范围。

## 复跑、完整性与清理

在证据 `sandbox` 中执行：

```text
node --test playable/tests/creature-loading-r2.test.mjs playable/tests/creature-bind-r3.test.mjs
node independent.mjs
node --test playable/tests/expedition-world.test.js playable/tests/world-creature.test.mjs
```

预期分别14/14、11/11、9/9通过。Node跳过图像解码；真实浏览器另验加载。额外尝试缩小测试名时cmd未转义竖线导致命令解析失败，没有执行产品测试；此前完整9项已退出0，因此未重复运行。此测试器命令错误不计产品失败。

已关闭自有tab1，对自有服务session3909发送Ctrl-C；`service-cleanup.json`确认4253拒绝连接。未触及4173、用户页面或他人服务。结束核验见 `final-integrity.json`，所有355冻结记录、204受测产品/基础路径、280旧只读文件错误0。报告、精确脚本、状态、测量、截图、日志及独立装载文件SHA均纳入 `artifacts/tests/TEST-WORLD-CREATURE-R3/manifest.json`（manifest自身SHA在交付消息单列）。
