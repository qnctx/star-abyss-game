# TEST-WORLD-CREATURE-R1 — FAIL

2026-09-13，新独立测试树 `C:/Users/HUAWEI/.codex/worktrees/fe4f/star-abyss-game`。只测试，不修产品、不提交、不收费生成，不接入活动 main 或 R2 修复。证据根：`artifacts/tests/TEST-WORLD-CREATURE-R1`。本报告由同目录外层 `manifest.json` 覆盖 SHA256。

## 固定候选与范围

唯一 WORLD 控制源为主控 c0e3 树 `artifacts/deliveries/WORLD-CREATURE-R1`。version SHA256：`55a15c19d049ff71849d2a187eccab593217d4ab15741c6e8030ab1ae3405301`。47 个清单文件（包含 version）全部核验，不含外层 manifest。GLB 为 `39c6cc6ddafd84f9d269026618dec68f69eb6038bbd7810245a3376f22caf879`，rig-map 为 `8f6e54542099eec8554d56c68c32cea06a8509e8be6ff359aed7e160636b5ff5`。

独立 sandbox 先复制冻结 ORIGINAL-BASE-R1 的187文件，再只安装 I-R3 八个必要产品、UI-R3 index、WORLD-R3三产品、CORE-R2八产品，最后叠加 WORLD-CREATURE 八产品。总203个最终产品/基础路径。没有从开发活动树拿 main。`initial-integrity.json` 与 `final-integrity.json` 覆盖六套冻结源376条和最终203路径；结束全部 SHA 一致、错误0。依赖使用只读 Three r180/Node v22.14.0；预览服务沿用开发说明，非怪物原角色媒体从原项目只读提供，不把它们冒称本轮新交付。开发测试/预览脚本单列测试辅助文件。

此次结论覆盖 WORLD 模型、表现、生命周期与原静态查询。CORE 新准入门仍在另一任务开发，未纳入本候选；浏览器 selector 明示“仅表现样本”，暂停业务 tick/action 并投射程序姿态。走路/拖动/V/L 是原生输入；怪物 phase 是明确 fixture。无真实击杀、命中、奖励、根存档联调或 CORE 加载门通过声明。

## 阻断发现

### F1：缺失 Chest 的资产仍报告 ready，首次 update 抛错

独立 `sandbox/independent.mjs` I03：通过 loader fixture 解析正常冻结 GLB，仅在内存把 Chest 重命名；保留43002顶点和20骨，初始化前不提供 view。`await ready` 返回 ready/4实例。首次正常 view update 抛出 `Missing creature bone: Chest`，此后 assetStatus 仍为 ready。失败发生在 ready 已允许调用者放行之后。与“ready 包含 rig 结构验证”契约不符。

`independent-results.json` 的 `data.invalidChest` 保存 ready、首次 update 错误及后续状态。**正常 GLB 文件没有损坏，也没有修改。** 这是独立异常资产防护分支测试，不是正常模型无法加载。

### F2：失败构造遗留可视子树，成功 retry 后首实例重复

I03b 仅在内存把 LF_Upper 重命名。ready 正确 resolve 为 failed，源 geometry dispose 计数为1；但首 anchor 已遗留 `creature-visual`。retry 载入正常 GLB 后，该 anchor 的 children 为两个 `creature-visual` 和一个 `creature-ground-contact`，其余三个 anchor 各一个模型和接触根。最终 dispose 后两个源 geometry 累计释放2次，但失败子树未在 retry 前撤销。

`data.invalidLeg` 保存失败/重试 children 与释放计数。这是 staging 原子性缺陷：构造函数先挂入 anchor，抛错的 actor 尚未进入 actors Map，clear 无法撤销它。F1/F2 已提前发送主控与 WORLD；R1 未被替换为活动修复。

### F3：正常模型的稳定死亡姿态没有形成自然倒地支撑

原生新页近景 `clean-dead-stable.png`、低视点灯开 `clean-dead-crouch-lamp-on.png`、反向第三人称 `clean-dead-rear-third-person.png`：整体侧滚后腿仍明显保持伸展，身体被伸展的下侧肢体托起，呈“站姿横倒”的轮廓，缺少胸腹/肩髋自然落地和收腿。接触暗部局限在小区域，无法消除整尸悬浮观感。恢复时沿侧滚姿态回到站立，截图另见 `clean-recovery-transition.png`、`clean-recovered.png`。

补充 `corpse-extra.json` 对4地点×3yaw扫描全部43002实际蒙皮顶点（含角尾）。营地 yaw0：最低点约0，来自左前足底；左后足底最低0.024m，右前/右后足底最低0.722/0.740m；全体顶点P10为0.391m、中位0.778m。源码姿态为整体绕Z轴0.43π，再按全模型最低点统一抬高；没有死亡专用收腿/躯干倒地求解。

这些数值用于描述截图中的支撑分布，**不是任意分位数验收阈值，也不是因侧卧上侧脚离地本身判缺陷**。FAIL 的依据是正常尸体的整体支撑和肢体观感。最低一点通过原三角面检查，只证明未穿入地面，不能代替死亡美术验收。

## 独立结果与原生证据

| 检查 | 结果与证据 |
|---|---|
| 冻结 GLB 结构 | PASS：1 mesh/primitive、43002顶点、35967三角、20骨、1材质、2张内嵌PNG，均2048×2048，无烘焙 clips。`glb-inspection.json` |
| 实际浏览器加载 | PASS：4232模型 ready/4实例；两资产别名HTTP200、9029072字节、SHA与冻结GLB完全一致。`browser-final.json`、`final-integrity.json` |
| 开发回归9项 | 全通过，仅作为回归，不代替独立用例。`developer-regression.tap`（68.5秒） |
| I01并发retry | PASS：第一次故意同步抛错，ready resolve failed；32并发retry合并为同一个新promise，总loader调用2次。loading时只保留最新view，恢复后应用dead；状态快照冻结。 |
| I02销毁迟到 | PASS：disposed后的加载完成不挂载，ready resolve disposed；共享geometry/material/texture/Image.close分别一次。底层网络不声称已取消。 |
| I03/I03b | FAIL：上述F1/F2。全部ready promise本身都未reject，但错误状态契约不成立。 |
| I04实例/LOD/换代 | PASS：四实例共享几何/材质、各20骨完全独立；100次LOD出入和40次换代保持原mesh/skeleton/20片分配，不串姿态；新代不继承旧死亡滚转。 |
| I05新几何检查 | PASS仅数值范围：4地点×4个新yaw（.19/1.13/2.71/5.61），80普通姿态/320足底，112整尸死亡/恢复过渡姿态。直接getVertexPosition，独立在原6000/260 PlaneGeometry实际索引三角面重心插值，未使用bind POSITION冒充足底。 |
| I05预算/缓存 | 普通姿态最多实际3044个足底顶点，未超过3×1522预算，无全体扫描。死亡稳定命中缓存，转yaw后重新扫描43002；死亡/恢复过渡全体检查含角尾。 |
| 接触面片 | PASS几何/资源：4实例20片、每片49顶点，透明、无depthWrite、renderOrder=1，地形+7mm；独立更新世界矩阵后误差小于10µm。`contact-extra.json`。开发向上绕序回归亦通过。 |
| 离地足淡影 | 记录要求差异：chase的两足离地约65mm时面片仍visible、strength约.0472，支撑足约.17；并非“只有真实接触才显示”。未仅凭该透明度另设美术阻断阈值。未证明所有透明对象交叠排序场景均无问题。 |
| 原权威/碰撞 | PASS：新独立4800采样、.42/.65/1.1半径、gate两状态与原collidesAtHeight一致，另墙中心/门开关/原岩石中心。`static-extra.json`；原四路线/墙门岩射线开发回归全通过。definitions和queries与WORLD-R3冻结一致。 |

独立三角面普通支撑脚最低净空范围约 -0.271mm～+0.321mm；112全姿态最低净空 -3.58e-9m～3.96e-7m。这不是全部肢体自然落地的证明，F3仍成立。

### 原生路线与样本标签

先读取 computer-use 技能，以专用 cua_repl 显式创建自有4231 IAB；未用CDP、dispatchEvent、坐标写入、内部advance、改时钟。最初 `/` 预览入口CSS路径不匹配，改为开发支持的 `/playable/star-abyss.html`，只属于测试入口配置，不改产品。

4231有效已发输入段：营地0/190，原=、W停止至0/136，再至0/96；拖动转东至99/93，idle灯开关近景 `native-idle-lamp-on/off.png`。随后出现未能由已发指令解释的96/81、177°、HP0及视口变化；立即排除该段，不判产品缺陷或有效原生结算。只读核对它仍为本session自有tab1后暂停操作。`native-dead-rear-lamp-off.png` 属该异常时段，**不作为死亡验收证据**；该页后续新调查确认未提交。

为隔离干扰另建后台自有4232/tab2、全新存档，开始即选择无业务idle样本，全程已采样HP120稳定。原生路线：0/190→0/131→0/54→21/62（被原岩石阻挡）→57/26→92/81。原生拖动、=、W停止；后绕行115/97→78/111→90/95。使用L、C低视点和V第一/第三人称，均未写玩家坐标。`clean-camp-start.png` 与所有 `clean-*` 为本版原生截图。

在92/81采集正面灯开关、chase连续8帧及只读DOM姿态数据；在90/95采集反向稳定windup/attack/hurt和恢复。`clean-*-stable.png` 是等待自然帧推进后的稳定样本；不将快速selector切换截图当作已完成整个动作。连续帧 `native-motion.json` 记录真实墙钟与DOM stats，能看到足端姿态变化，但短样本且无真实追击位移，不能证明7.8m/s实际追击时无脚滑。四个地形站点全部做了Node几何，浏览器路线只在营地周边，不声称另外三站原生已走到。

### 美术观察

已直接看冻结 `CREATURE-ART-V1/concept.png`，没有打开用户资产预览。游戏模型保留双角、叠层背甲、长尾与四足爪形等概念轮廓，已经不是旧几何拼装敌人。远景小尺寸限制了裂纹/细节可辨度，不能声称与概念图像素等价。

同位置 `clean-idle-front-lamp-on/off.png`：原肩灯使深色岩甲明显趋于灰白，背甲层片与关节轮廓仍可见；关灯时更接近深色岩甲，但阴影侧细节较暗。没有证据证明贴图未加载，也没有用白色像素阈值另造阻断。足下局部暗影很弱；静态数值贴地通过，死亡整体观感仍不通过。原灯与全局阴影设置均未更改。未做低端GPU、长时驾驶、所有透明叠层与全平台表现认证。

## 性能、复跑与清理

I06是Node CPU短fixture，刻意将四actor同时置于营地附近：120帧普通chase中位3.543ms/P95 5.278ms/最大6.938ms；四只首次尸体总45.867ms，各约10.7～11.9ms，各扫描43002；稳定尸体每只0全顶点/缓存命中1。浏览器渲染截图包含真实纹理，但这些计时**不含浏览器纹理解码、GPU或全平台预算**。

在证据sandbox运行：

```text
node --test playable/tests/expedition-world.test.js playable/tests/world-creature.test.mjs
node independent.mjs
node contact-extra.mjs
node corpse-extra.mjs
node static-extra.mjs
```

预期开发9通过；independent中I03/I03b失败（不能改成通过），其余5项通过。contact/static通过，corpse输出描述数据。图片人工复核优先使用上述clean死亡/灯光文件，不能用开发旧截图替代。

测试结束：仅关闭自有tab1/2，未触及主或用户页，未设置viewport覆盖；仅向自有exec服务session23474/39105发送Ctrl-C，回归session47626结束码0。清理日志 `browser-cleanup.json`/`service-cleanup.json`。未提交；正常候选八产品与冻结源结束SHA均一致。完整验收结论为 **FAIL，等待另行新冻结/新独立测试**，不是本轮自动切换R2。
