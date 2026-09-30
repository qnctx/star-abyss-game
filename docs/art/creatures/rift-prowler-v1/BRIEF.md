# Rift Prowler visual replacement

Generated with the built-in image tool; the requested Image 2.5 model cannot be selected or verified through this interface.

Single full-body realistic lunar quadruped, three-quarter front view, light grey studio background. Muscular low torso, articulated digitigrade legs and three-toed claws, angular predatory head, recessed amber eyes, dark slate layered weathered chitin, purple mineral inclusions, worn pale horn edges, leathery joints and short tapered tail. Neutral separated-leg modeling pose. Avoid primitive blocks, toy/cartoon appearance, excessive glow, text and props.

Production: generate one textured Standard G1 model from this concept, target 100000 faces, no four-view enhancement, ZIP and PBR GLB. Retain source, then use local Blender for game-scale cleanup and animation preparation. Final game integration and independent visual verification remain pending. The user approved this 20-credit batch; task 3444708 was submitted in the China region. Resume this task only; no additional submissions are authorized.

The original quote expired before approval was executed and was refreshed at the same 20 credits: quote_24a62fc20b184b5f8697ed52fab8ec4d, valid through 2026-09-13T22:05:27.30665138+08:00 at submission. Local Blender 5.2.1 is available at D:/blender/blender.exe. Private uploaded input URL and full quote remain outside the project. At 2026-09-13T14:04:04Z, provider status was 1 (running), with no model output yet. The authoritative attempt record is task.json; a submitted task is not a delivered model.

Rig handoff: use metres, Y up, -Z forward, soles at y=0. Provide independent skinned Upper/Lower/Foot chains for all four legs, torso/head/tail bones, sole reference nodes and actual sole vertex groups, and a rig map with pole directions and joint limits. Names may be mapped. WORLD can supply procedural animation; clips are optional, but a single static mesh is not sufficient. Document full bounds including horns and tail separately from the existing collision dimensions. The integration must check deformed sole vertices and full-body death contact against original terrain. Preserve generation source files.

Final loading contract: createExpeditionWorld returns root/update/dispose/ready/assetStatus/retry. assetStatus.status is loading, ready, failed or disposed. ready never rejects; only ready permits CORE attachment, simulation and combat. retry on failed starts a new load and replaces ready; loading reuses its promise, ready reuses success, disposed cannot reopen. Failed staging is released; disposed instances release late-arriving resources and resolve disposed. This supersedes the earlier suggestion that every retry must destroy and recreate WORLD. The CORE gate must follow the current attempt and never release from an obsolete promise.

## 2026-09-14 正式怪物接入完成

先概念图，再Lux3D生成、Blender整理与20骨绑定的裂隙兽已替换原几何占位怪物。CORE-CREATURE-R2 + WORLD-CREATURE-R3独立联合限定PASS，298项清单文件核验归档；仅安装10个变化产品文件，保留原6×6km月面、角色、载具和存档。准确受测bundle及GLB已在4173 HTTP复核。回滚备份与安装SHA见 versions/INTEGRATED-CREATURE-R2.json，独立范围见 reports/TEST-CORE-CREATURE-R2.md。

试玩步骤：http://127.0.0.1:4173/ 刷新后继续，WASD移动、V换视角、R近身攻击、H拾取、I背包、Esc暂停。加载失败可重试或返回菜单；不要清除旧存档。关机后双击项目根启动试玩.cmd恢复服务。实测击杀、侧卧倒地、拾1、刷新同档包1/余1不变，加载延迟/503/菜单取消和并发门通过。未宣称完整驾驶、旧故事、全远点或全平台验收；肩灯照射偏灰白、四尸首次姿态计算峰值仍为既有边界。后续所有新/重做3D仍按AGENTS.md先图后模型执行，本轮不是所有游戏资产已重制。
