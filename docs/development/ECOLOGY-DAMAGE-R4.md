# 生态与环境破坏 R4（开发验收中）

当前运行版本 `ecology-r4.2`：首碰撞RID与岩表面fallback版288项独立检查、武技短R通过；支撑修复首版再过原suite288项，当前最终候选681d4ff6的新增支撑用例/真实R跨OS/自然cell定向仍待运行。此前局部真实GPU破坏/站立实例隐藏/恢复为旧版本证据。三生境真实GPU基线已完成，森林重载一致性、过渡地带结构分布及瞬时性能未通过；参考美术、真实武技/Main跨进程联合仍未完成。各轮失败报告保留。

编辑目录：`C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game`。本切片只拥有 `native_planet_ecology.gd`、`native_environment_damage*`、R4 生态资源/源码、专用测试和本文。旧 6 km 月面、人物、天空、车辆、调查与原 v1 主存档由原实现继续负责。

## 图像到模型

本轮使用内置 imagegen，批准上限 4 张，实际生成 4 张；没有调用外部付费 3D/API。完整提示词与生成模式见 `docs/art/ecology-damage-r4/prompts.json`。

| 参考图 | 实际对应 |
|---|---|
| `01-species-age.png` | 松/栎/桤木各幼龄、成熟、老龄；9 种独立分枝结构，3 个 LOD |
| `02-branch-root.png` | 分段渐细树干、主枝/侧枝、分叉叶簇、根张；同源碰撞段 |
| `03-tree-fracture.png` | 断口保留树桩、主干沿受击方向铰接倒伏；独立枝条落地 |
| `04-rock-fracture.png` | 有限玄武岩实体 6 块裂解体与低底座；局部碎块运动/落地 |

内部结构审查：保留松针与主干，不照抄首图老松近似阔叶老树的偏差；树冠用末梢折面叶片和可见枝网制作，不使用球状树冠。岩体只破坏有限实体；未实现任意整球体素开挖。Blender 源码为 `godot/assets/planet-ecology-r4/build_ecology_r4.py`，可编辑库为 `source/ecology-r4.blend`（该源码目录 `.gdignore`，避免运行期触发 Blender 导入），`manifest.json` 记录参考图 SHA256、每个模型的部位、实际尺寸、碰撞段和三角数。

生境依照场数据的森林/湿地/河流/冷区/山地和连续空间斑块选择；桤木偏湿、松偏冷/坡地、栎偏温和林地。年龄选取独立于 LOD。局部候选通过根系占地、水深、真实支撑面/坡度与冠根间距审核；不在旧月面保护范围生成。

## 统一伤害接口

生产 `NativeWorld` 原有生态挂载自动创建组 `native_environment_damage` 的唯一服务。武技只调用该服务，不维护第二份树岩健康。

```gdscript
service.damage({
    "origin": contact_position, # scene-space Vector3
    "radius": 0.6,
    "direction": attack_direction, # optional; normalized internally
    "reach": 2.0, # >0 finite capsule; 0 sphere
    "power": 80.0,
    "damage_type": "slash", # blunt / slash / blast
    "source": "player", # caster, NOT cast id
    "cast_id": unique_release_id,
    "phase": 0 # each legitimate multi-hit phase has its own index
})
```

返回 `hits`（`entity_id/kind/part/point/normal/damage/destroyed/blocked/collider/rid`）、`hit_points`、`changed`、`blocked`、`query_id`。`collider/rid` 为运行期引用，绝不写入存档。按施法者、cast_id、phase、实体去重；跨施法不互相吞伤害。有限胶囊先对实际枝干段做距离筛选，再以14次有界二分求沿攻击方向首次进入扩张胶囊的世界距离，以此排序，避免穿轴交点浮点法线翻向后选到更远主干。调用方仍需做技能轨迹遮挡；环境服务另对每个候选做 mask 17 物理 LOS，只有无阻挡或首碰撞体属于目标实体才施伤。`occlusion_origin/exclude_rids` 控制发力点/忽略 RID，`stop_on_first/max_targets` 控制穿透，球爆炸 `falloff="linear"` 按真实部位表面距离衰减。

防滥查询上限：半径 32 m，胶囊长度 64 m，每次最多 32 实体。树干生命幼龄 100、成熟 220、老龄 300，枝条 45 起；有限岩体 550，斩击对岩体倍率 0.3。最终境界消费/招式时机由武技模块拥有。

可选 `contact_rid` 仅供直接扫掠传入同次物理首碰撞体。字段存在时必须为有效RID，否则返回空结果；在部位几何扫描前只保留原body或当前part body匹配的实体。首墙属于非生态时不产生生态候选。伤害物化会更换body，返回hit.rid不保证等于调用前contact_rid；调用者应使用稳定entity_id识别。扩散砸地AOE不传该字段。岩体真实凸壳可能先于内部chunk胶囊被击中；仅outcrop且代理无候选时允许同次 `contact_point/contact_normal/contact_shape` 补充。服务限制接触点到原有限段≤radius+5mm，并沿法线±1cm重验物理表面RID/shape与5mm点误差，仍经过原LOS；树木和未提供这些字段的AOE不走该补充路径。当前服务SHA `5858ce9af948faa84d6566e85efb8e9a8a78346a26f5562db4bee7125d192dad`，补丁待武技短R及独立边界复跑。

`deform_surface=true` 且 power≥600 时发 `surface_impact_requested(query)` 并返回 `deformation_request`，每次施法阶段最多一次。它是地形服务请求，不能表示坑已成功。真正地表网格/碰撞/持久化由地形 owner 接入，失败或地表未就绪不得显示成功。

## 碰撞、运动与预算

完好实体使用 MultiMesh；首次受伤切换到分部位节点，禁用原完整碰撞。树干倒伏是围绕真实断口的受控铰接运动，以对应木质碰撞段对地表检测落点；枝条/裂解岩块使用真实 RigidBody3D、局部向下重力与 CCD。运动完成保留对应落地障碍。流出时清理运行节点，保留稳定实体状态；重新流入按损伤姿态重建。

完好主干在整个近物理域保持连续硬碰撞；LOD0 额外阻挡主枝，其他距离细枝保留部位命中查询，断后强制建立真实动态形状。默认保守预算为 320 实例、260,000 三角；分带 100k/70k/90k，可配置 `instance_budget/triangle_budget/detail_budgets`。900 实例/1,300,000 三角仅为可选候选上限，不能当默认性能完成。最多 6 棵树同时倒伏、24 个运动碎块，物理时间上限 3.4 s；超限将最老碎块落地冻结，不无限积累活动刚体。冻结残骸保留为静态障碍，后续重击可清理。持久化最多 2048 个已修改实体；满额在新实体任何破坏前拒绝并返回 `budget_exhausted=true`，已有记录仍可继续受伤，不丢旧状态。该上限不代表全游戏性能已经验收。

## 保存契约

服务默认纯内存，不猜用户默认存档路径。Main 使用 `export_state()/import_state()` 将完整 envelope 内嵌主档作为权威快照，原子主档提交后侧档仅作镜像备份；没有 inline 的旧档才走匹配 identity 的侧档兼容。Main owner 明确调用 `bind_save_slot(path, seed, identity, restore)`，主档成功写入后调用 `save_state()`，新游戏/重置调用 `reset_state()`。侧档 path 与具体主档槽绑定，主档新增唯一 identity，旧主档缺 identity 时不恢复可能残留的侧档。

独立 JSON envelope 含 version、generation=`ecology-r4.2`、world_seed、slot_identity、稳定 tile/kind/candidate ID；tmp→bak→正式文件写入，错误通过 `state_error` 和 `persistence_failed` 可见。损坏侧档保留并阻止自动覆盖；没有侧档代表完整生态。此接口的 Main 生命周期接入由总控指定的 Main owner 合并验收。

## 验证步骤与当前证据

1. 本地资源重建：`D:/blender/blender.exe --background --python godot/assets/planet-ecology-r4/build_ecology_r4.py`。
2. CPU bake：Godot `--headless --path godot --script res://tests/native_environment_damage_bake.gd`。
3. CPU 解析/挂载：`native_environment_damage_smoke.gd`。已通过。
4. CPU 真实物理局部链路：`native_environment_damage_visual.gd` 不加 `--visual`。断枝/去重/断干/岩裂解/回收/独立侧档重载已通过；结果 `godot/reports/ecology-damage-r4/visual-test-results.json` 中 `actual_godot_frames=false`，不能作为视觉通过。
5. 独立审查/测试：`native_environment_damage_independent.gd`，已查出并修复幼桤木主干段误筛、同 cell 清理重复访问、深层坏档、保存中断运动、细枝断后无动态形状等问题；首轮130项中129通过，1项为已诊断的headless MultiMesh变换回读限制。排序修复版本243项通过，覆盖容量/深复制/备份/IO重试；新接触过滤与新增边界用例等待独立复跑，不把未执行项算通过。
6. GPU 视觉：同一脚本真实窗口渲染并传 `-- --visual`；已保存三树种年龄视图、俯视、相机固定的完整→断枝→倒干→裂岩→落地→重载，局部机制通过，参考美术复核未通过（见下节），继续返工。
7. 真实星球：已在 forest/transition/wetland 三固定场坐标完成 NativePlanet GPU基线、支撑几何与伤害重建检查。运行 `D:/Python/python.exe godot/tests/native_environment_damage_capture.py native_environment_damage_integrated.gd forest`，另两次将末参换为 `transition`、`wetland`。详见下表；该独立场景不等同Main全游戏。

所有测试使用专用场景与 `res://reports/ecology-damage-r4/` 侧档，不读取/写入用户正在游戏的默认存档，不操控用户游戏窗口。GPU 与其他开发会话明确排队；局部测试不等于全游戏完成。

## 2026-09-29 实际视觉返工记录

首轮 GPU 图和数值完整保留在 `godot/reports/ecology-damage-r4/first-visual-failed/`。首轮未通过：树冠疏薄、岩面规则、湿生选择使 153 棵树全部为桤木。已依据同四张参考修正末梢叶量/体积、近景曲线枝干和平滑树皮、岩体轮廓/断面、湿生混交斑块；远LOD去细枝管面腾出预算。第二轮固定相机明确看到站树被隐藏，倒地与重载图像吻合，但逐字 JSON 比较有差异，正保存逐字段诊断并采用仅数值1e-5容差的严格结构比较。第二轮岩面棋盘色与底盖木色仍判问题并继续修复。真实森林/过渡/湿地三生境与武技端到端仍待相关owner稳定窗口，未签整体验收。

最新远LOD每树仅220–824三角（松254/416/390、栎220/286/304、桤368/582/824），保留各年龄主干和对应叶簇轮廓。近LOD仍使用真实渐细曲线枝网和独立折面叶片，远LOD省去末梢管面并合并叶喷丛表现。30种全部LOD合计381,552三角是资源库总数，不是每帧绘制数；运行仍由上述260k默认限制。实际Intel UHD帧间隔p95、生态stream峰值、shape数、伤害查询us与内存的采样脚本已加入，等待World runtime稳定后执行，当前不虚报性能数字。

第二轮独立 GPU 复拍（Intel UHD OpenGL）与462个mesh bake均exit0；该轮 `visual-test-results.json` `actual_godot_frames=true, failures=[]`。旧standing零basis隐藏已在真实GPU断言通过；静态图08/09同相机一致。逐字段持久化诊断只发现岩块chunk_0旋转矩阵第3值由-0.000644688960164785变为-0.00064468896016478，差4.9873299934333204e-18，其他实体ID、health、broken、pose集合严格一致；见 `reload-semantic-diff.json`。这证明局部资源/破坏链路，并不代替真实生境性能或武技端到端验收。

## 2026-09-30 逐图质量审查与结构返工

上述第二轮证据另存 `godot/reports/ecology-damage-r4/second-visual-functional-art-rejected/`，明确为“功能通过、美术未通过”。独立审查者只读四张概念图与03三行、04–09实拍，没有用测试断言代替视觉判断。

| 参考→实拍 | 已成立 | 未满足与源码返工 |
|---|---|---|
| 01树种年龄→03三行 | 松的层冠、栎的侧展、桤的多干可以区分；非同一模型缩放 | 成年/老栎仍狭长单杆，老松缺断顶。改栎为低位2/3粗叉、缩短主干并扩大冠幅；老松保留断顶与枯叉 |
| 02根枝→03三行/04 | 枝条实际接主干，根张入地 | 三种根均像放射尖脚，桤缺须根，基部平接头明显。补桤贴地分叉细根，主干/树桩断面边缘改不规则起伏 |
| 03断树→04–06/08–09 | 局部断枝、主干旋转倒地、移除原站树、保存恢复相同姿态 | 木纤维与短程木屑未完全还原；静态图不能单独验证完整速度/回弹曲线，不能声称概念全部落地 |
| 04岩裂→04/07–09 | 六块实际独立运动并保留恢复姿态 | 规则底盘、同类竖柱、细密条纹不合格。改单一不对称母岩凸壳，以高低错开种子/斜向Voronoi平面切六块，得到大小不一的矮板/斜块/顶块；保留咬合断面，外缘削角，内外断面分色，取消周期细条纹 |

返工沿用本批4张参考，未新增图像生成。此处记录几何修改方向；重建、烘焙和同相机复拍通过前不改为美术通过。默认320实例/260k三角不变。真实三生境Intel UHD性能、实际技能命中环境、Main内嵌快照跨进程重载仍未完成。

第三次局部GPU已复拍：资源30变体、477烘焙mesh、408,926库总三角，岩体已变成斜向咬合碎块，栎树已有低位粗叉。固定旧横扫实际打断 `branch_05`，原测试“trunk broken”失败，状态明确为两根低枝断落、整株未倒。该失败不能通过移动测试瞄点掩盖；它同时暴露当前多主干仍合并为一个trunk的结构语义缺陷。

因此暂不冻结为最终资源。正在 `.gdignore` staging 中修复共同基部→各主干→所属枝叶的父子结构：命中 `stem_XX` 时其尚连接的完整子树作为一个刚体脱离；已先断的枝条不重新并入；只有共同基部 `trunk` 被破坏才驱动其余整株倒伏。状态增加可选 `fragment_roots` 保存每件碎片所属脱离事件，落地/导出每个成员的同一刚体姿态，恢复后保持对应障碍。主干碰撞在全部近景LOD保留。生产文件当前为飞行验证冻结，候选尚未运行，必须重建+结构断言+存档恢复后才能验收。


当前r4.2已重建：30变体、519烘焙mesh、406,998三角（资源总数）。远LOD松254/416/388、栎220/380/456、桤380/594/836、岩422；所有stem段保持物理碰撞。旧版959个运行文件已备份至 `artifacts/ecology-damage-r4-compatibility/runtime-r4.1-before-subtrees.zip`，含逐文件SHA256并通过CRC；恢复说明见同目录README。没有备份/改写用户存档。r4.2 import对旧generation明确报 `environment_generation_mismatch:`，保存保护持续生效；原无生态字段的v1存档不走该不兼容分支。


## 当前功能验收与美术余项

首接触排序修正后的独立报告为 `independent-services-r42-contact-final.json`，243 checks、0 failures；服务SHA `3ef55e9c707f3b4861e24e2f436162040cc00c3ff75f778a2aa81c717ed4243b`。此前235项通过对应排序修前，不能代替新排序回归。固定基部扫掠的独立采样进入距离：trunk 1.4111m，邻干1.6888m；完整与先断枝/干两状态均先命中基部。

最新局部Intel UHD OpenGL报告 `visual-test-results.json` 为actual_godot_frames=true、failures=[]，实际命中branch_00→stem_00→trunk。多干树一根主干与仍连接枝叶作为一个刚体脱离，兄弟主干保持；先断枝不重新并入；基部破坏才令剩余冠体倒伏。子树按一次断裂事件作为残骸清理单元。08/09同相机轮廓和姿态一致，无原站立实例重影。独立图审指出宽镜头下断口与单干脱离细节不够清晰，追加局部镜头脚本已准备但未复拍。

总控独立美术审查仍判未通过：老松需要更明确的扭曲粗干/枯冠，老栎需要真实中空及枯断枝，桤木根干需去灰环并强化贴地分根；叶片颗粒与齐整叶簇仍不匹配参考。最低修正为同批参考下重塑以上结构、真实树洞内壁、分级根路与按树种组织的叶簇，在现预算内置换面数。当前AI/武技验证依赖已冻结，以上只列方案，尚未改生产/新增生成，不能以树种结构已不同宣称最终美术满意。

## 2026-09-30 三生境真实GPU基线（未通过整体验收）

Intel UHD、OpenGL、默认320实例/260k三角，分带100k/70k/90k。每处650次生态更新；帧间隔跳过前120次后采529个真实frame_post_draw间隔。生态stream_us仅包围ecology.update_stream，包含冷启动650次更新；damage_query_us包围整次同步damage调用，包含候选/LOS/首次部位资源加载与物化/倒伏终点规划，不能称为纯几何命中耗时。内存为Godot MEMORY_STATIC，非进程RSS或GPU显存。

| 生境/场坐标 | 初始实例/三角 | 初始树种 松/栎/桤 | 硬碰撞shape | 帧p50/p95/max ms | stream p95/max ms | damage ms | MEMORY_STATIC bytes | 结果 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| forest (25000,6000) | 251 / 159774 | 101/14/95 | 2548 | 15.614/22.020/23.960 | 10.681/153.518 | 232.202 | 66172289 | exit1：伤害卸载重载一致性失败 |
| transition (13000,-6000) | 320 / 216536 | 174/0/0 | 1061 | 17.677/21.415/30.815 | 8.607/242.554 | 151.916 | 59442308 | exit1：区域多树形检查失败；重载通过 |
| wetland (25000,3000) | 287 / 259594 | 65/13/91 | 2034 | 17.453/18.417/20.717 | 9.708/248.604 | 125.769 | 64542987 | exit0：功能通过；卡顿仍未验收 |

原始证据：`godot/reports/ecology-damage-r4/habitat-{forest,transition,wetland}/integrated-results.json`，对应10–14同相机树木前后/重建及鸟瞰图，完整日志在父目录。初始实例/三角取各日志FRAME=600，表中树种/shape也来自破坏前；JSON snapshot在重建后，不能混当同一时刻。重建后forest为238/159824、transition320/220936、wetland287/259594。森林首次报告未保存状态逐字段与target_registered诊断，需相同点位复跑定位，不能换样地规避失败；其后两处已补诊断且严格状态相等、目标重新注册。

性能风险明确存在：153–249ms同步stream峰值、126–232ms整次伤害会产生卡顿。下一步CPU计时拆分候选扫描、部位遍历、LOS、首次资源加载、碰撞形状创建、MultiMesh更新与倒伏地表采样；优化候选空间筛选、近距离物理激活和每帧有界构建，不提高预算掩盖性能。森林当前LOD0预算为0且前景使用中LOD，实拍叶片呈巨大尖片，必须连同按tile中心选LOD的规则复核。过渡地带硬阈值选松应检查连续生境混合，不要求每个样地强塞三树种。

性能拆分已准备未执行：`godot/tests/ecology-r4-profile/`使用生产子类包围计时，命令末尾增加 `forest conservative profile`，结果写forest/profile独立目录保留原失败。initial_stream / damage_call / settle_and_rebuild分别计数；计时为嵌套inclusive，不能直接求和。新增clear前、clear后即时、重建后状态及目标cell/pending/retry诊断。完成武技独占窗口后才运行。

## 2026-09-30 首碰撞与砸坑残骸联合进展

武技短R报告contact-convex-r42已验证原瞄点松树/岩体、墙挡树、树挡敌、单墙初始重叠；contact-ambiguous-r42已验证同时重叠不同物体时拒绝不明确环境伤害。服务当前SHA5858ce9a…5d192dad；独立新增contact反例已准备未运行，不能借此前243项认证该补丁。跨OS真实毁坏/坑武技报告25+14通过，但persistence-crater-default.png显示岩片悬旧地表，此项明确未通过。

CPU只读定位：World成功commit后的失效调用已连接；Ecology仅遍历cells，手动registered fixture不在其中；service_clearance仅查Planet，在旧盆地未ready后用record旧切平面，导致freeze位置错误。候选诊断见artifacts/ecology-damage-r4-support-candidate/diagnosis.md。生产冻结待武技释放，不能先强移视觉位置或把存档通过作为支撑通过。

参考美术仅artifacts候选补老松扭曲粗干/枯叉与老栎实际开放树洞内壁；Python语法通过，尚未Blender构建、三角测量、碰撞/GPU验证；桤根与叶簇余项未完成。四张生成额度已用完，未新增生成。

悬片证据范围修正：该实拍首先验证的是武技直接register_entity夹具（parent独立、cell=id，未加入ecology.cells），尚未证明自然streamed生态存在同样现象。服务旧盆地查询与直接注册目标的支撑缺口仍需修复；自然cell变形后换anchor/恢复旧poses必须另测。武技已释放窗口，先独立contact回归后同址forest profile，生产5858ce9a暂保持。

支撑修复切片进展：接触fallback版本5858ce9a独立288/0通过；support首轮4492版原suite再次288/0（新support特有用例尚未运行）。最终候选damage681d4ff64c310c975f8abe18f5021d92d5373cfe737f3b105a017f140bc778ee、ecology73e2c462a670b31cf3d632834a00b65d0d05d9ebf9e664688fca2310f6b99db1，已parse，加入运动中重新支撑RB的当前姿态查询。World commit触发所有registered受影响组支撑复核；真实loaded owner terrain ray，不以旧平面确认成功；缺碰撞保留冻结姿态并排队；fragment_roots组恢复动态CCD与径向重力；pose_anchor保存原锚点，root变更时保持碎片世界姿态后重验，避免双下降。每physics tick处理一组。最终候选完整独立/真实R跨OS/自然cell验证仍待运行，当前不能记功能全通过。

自然路径专项脚本已准备未运行：`native_environment_damage_natural_support.gd`读取正式World的transition自然physical outcrop，必须属于ecology.cells；正式服务毁坏后等待settle，再用World真实异步commit降地，测当前碎片mesh世界矩阵、实际shape、terrain不穿透及mask1真实支撑接触；独立World+environment快照在新OS process恢复并复核世界姿态。命令：`D:/Python/python.exe godot/tests/native_environment_damage_capture.py native_environment_damage_natural_support.gd transition`，consumer末尾加 `conservative reopen`。结果natural-support/{producer,consumer}.json和01–04图。这里直接服务施伤、自然cell/commit路径；实际R由武技联合另验，二者不混称。

最终681版新增support首跑329 checks/1失败，原始报告independent-services-r42-support-first-failure.json保留。唯一失败为组合health/断裂/锚点严格比较；CPU发现原内存148.60000000000002被Godot JSON写成148.6（2.84e-14差），尚待逐字段实跑确认。独立测试已拆分：重载health与实际保存JSON按type/float64字节精确相等，broken/fragment_roots/12项新anchor独立严格校验；原memory→JSON数差另记录ULP，不放宽全状态容差。自然script parse绿但运行待武技完整释放。

333项最终support diagnostics全部通过，报告independent-services-r42-support-diagnostics-final.json；329/1原因确认memory→JSON恰-1ULP（-2.84e-14），saved→loaded数值/type/float64字节全同；broken/fragment_roots/anchor各项严格通过。

真实R新版producer140/144未过，未运行consumer。六活动chunk实际terrain gap均约-4e-5..+.00164m，碰撞形状/正常settle通过；固定stump坑前-.228m为原设计埋底，坑后两个stump最低+.927/+1.048m且全体顶点高于地面，是directregistry base/root生命周期缺口。另chunk4 firsthit被chunk1/terrain遮挡，保持原30次证据，尚未定性backend丢形状；武技补intersect_shape有界自身证据。自然路径单独producer正在运行，不把fixture问题扩大到所有cells。
