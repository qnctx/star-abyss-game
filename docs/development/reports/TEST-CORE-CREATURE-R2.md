# TEST-CORE-CREATURE-R2 独立联合验收

结论：**PASS（下列限定范围）**。冻结 CORE-CREATURE-R2 + WORLD-CREATURE-R3 在原6×6km游戏中通过真实接敌、R击杀、自然GLB尸体、H拾1、同档重载继续及异步资产准入联合检查。本结论不等于完整游戏/全平台发布验收。

测试树：`C:/Users/HUAWEI/.codex/worktrees/f812/star-abyss-game/artifacts/tests/TEST-CORE-CREATURE-R2/tree`。报告/证据只写f812，未修改产品源、主目录或用户存档根，无付费、提交。专用127.0.0.1:7575后台IAB，未使用4173/4214或用户页。

## 冻结与受测身份

- 唯一来源：`C:/Users/HUAWEI/.codex/worktrees/c0e3/star-abyss-game/artifacts/deliveries`。
- CORE version SHA：`890ff143162baa07177b957cb9e819013f3f3095f24b84aa8316a1bf46c4b3e0`；32/32冻结文件校验，9产品与CORE-CREATURE-R1完全相同。
- WORLD version SHA：`516363e9b557c8d4e894956737f5fd0cd22ab6e80f25aecb4af209cdd986811a`；20/20冻结文件校验。
- BASE187、I-R3 47、UI-R3 45、旧CORE-R2 31逐SHA验证；BASE后只相应productPaths覆盖。旧CORE仅提供明确基线，不从活动树取main或脚本。角色/扫描器数据按BASE外部只读资产约定取用，独立SHA见external-assets.json。
- 本轮实际HTML：`/playable/star-abyss.html?expeditionDebug`；脚本：`/playable/game.js?v=c2-idle-fix-20260909`。独立构建与HTTP实际返回均SHA `0875ddec709488787d1abc6aa065e02c5ee2c04df839f29feee88209f8baa0e6`（21,586,355字节）。没有把200当作模块正确证据；build-metafile确认九CORE模块，全部安装源末次SHA复核通过。此为本轮独立构建SHA，不复用开发报告bundle SHA。
- GLB实际URL `/playable/assets/creatures/rift-prowler-v1/rift-prowler.glb`，每次成功返回均9,029,072字节，SHA `39c6cc6ddafd84f9d269026618dec68f69eb6038bbd7810245a3376f22caf879`。DOM ready为43002顶点/35967三角/20骨/4实例。
- 继承WORLD限定报告SHA `49aa8adbd41a82c00a4ff44f4ea57cc1fdb65c67d06f522d515e9acdd4cf9811`（冻结包副本经清单校验）。不重复其完整模型矩阵，不扩大到业务全通过。

## 本轮结果

| 范围 | 结果与证据 |
|---|---|
| 原开发回归 | 13/13，仅回归：developer-regression.tap |
| 独立请求与身份 | 6/6：三并发仅最新准入；fresh替换不打开旧身份；异步runtime构建期间菜单取消销毁迟到对象；disposed拒绝；控制门重入；两个真实session竞争最后1份尸体物资CAS仅一个成功，成功请求重放不重复奖励。independent.test.cjs / independent.tap |
| 公开loader与CORE联合 | 3/3：真实GLB解析，Node仅跳过纹理解码；坏骨架/逆绑定→WORLD failed、零actors、CORE拒绝；同实例retry新promise且重复retry严格相同promise；正常恢复4实例；dispose屏蔽迟到模型。public-loader.test.cjs / public-loader.tap。不是替代浏览器PBR验证 |
| 正常开始/继续 | 原菜单开始正常；同源同档继续保留关联身份。02/03暂停根完全相同 |
| 真实战斗 | =自动步行和鼠标拖动抵达营地；实际R将96→30，正常死亡救援后再R击杀。13完整根敌HP0/alive false。原生07/12动作图、16自然侧卧尸体图，无selector表现样本 |
| H拾1→reload继续 | 15/17/18：worldId、完整inventory/drops/combat.actors一致，玩家HP80、血液包1、尸体余1；25恢复后及31/32最终仍一致。verify-evidence.cjs |
| 失败/重试输入门 | HTTP503实际网络夹具；19/20 failed、21/22 retry loading均root:null/blocked true、位置身份未变。Tab/ShiftTab/M/J/U/Esc/I/R/H/=/W失败矩阵不穿透；loading中Tab/M/J/U/Esc/R/H/=不穿透 |
| 菜单epoch | 12秒冷延迟中返回菜单；27响应ready后仍screen menu/root:null，随后正常继续。30秒retry过程也曾返回菜单再主动继续，恢复同档。24实际仍loading，不用其文件名宣称ready |
| 原UI保留 | I打开/关闭与焦点回canvas，Esc暂停/resume焦点；原第三人称角色28、地表全图6km30、原天体画面、mobility/载具标记保留。31/32最终暂停根一致 |

## 复现与边界

在本测试目录运行 `node setup.cjs`、`node build.cjs`、`node --test tree/playable/tests/expedition-runtime.test.js`、`node --test independent.test.cjs`、`node build-world.cjs`、`node --test public-loader.test.cjs`、`node verify-evidence.cjs`、`node final-audit.cjs`。浏览器路径/具体动作/网络夹具见browser-protocol.md；server.cjs只服务独立树，GLB可受控503或延迟，不改产品文件。

决定性根均20k分段读回、JSON.parse完整解析，在I冻结/暂停时采样；inventory/drops/combat actors使用完整对象比较，31/32完整root完全相同。01是运行中样本，排除一致性结论。未复用开发25/29/30截断证据。CAS曾因测试夹具选择未created掉落、缺少原sceneConfig失败，修正测试夹具后通过，非产品缺陷。

本轮未发现阻断性产品缺陷。营地初次为空符合视野外且距玩家至少45m的补充规则；正常转身撤离后生成。肩灯灰白但甲片清晰是既有视觉边界；本轮不新增性能阈值。既有四尸首帧50–79ms只作为继承边界，本轮未重复测量。

未测：驾驶完整闭环、完整旧故事、所有远点、全平台性能、Windows系统级失焦/恢复或锁屏。浏览器焦点仅覆盖游戏菜单/背包/加载遮罩。旧档迁移未知字段/写入失败由13开发回归及新身份测试覆盖，本轮真实UI使用从原菜单创建后持续沿用的档，未注入历史用户档。既有长容量闭环独立CORE-R2结果仅按任务约定继承且逻辑未改，未再等自然20分钟。

清理：自有tab3与两张错误路径产生的自有空白tab1/2已关闭，浏览器自有页列表为空；服务session13213已停止；未设viewport override。首次错误路径报告ERR_BLOCKED_BY_CLIENT，准确冻结入口同端口成功，无安全策略绕过。末次源/受测模块/served bundle/GLB核验记录在final-audit.json，证据清单在manifest.json。
