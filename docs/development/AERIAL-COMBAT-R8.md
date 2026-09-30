# R8 盆地飞行战斗

## 可玩范围

本片沿用原六公里盆地的四处掠兽、战斗演员、库存、遗留物与同一 IndexedDB root CAS。只有元婴及以上、正在飞行且仍在已加载的盆地战斗图内，才开放空中攻击。区域外保持原有调查与飞行，不生成假敌人、假掉落或星域。地面 R、营地保护圈、载具限制、落地 H 拾取均保持原规则。

`main.mjs` 接线必须把真实 `planetRuntime.position` 通过 `globalToLocal(..., planetRuntime.frame)` 转成 `{x,y,z}` 供 `expeditionContext.player` 使用，并给出 `flying`、`combatZone`、`remote`。禁止用停放位置 `parkedPlayer` 判定飞行战斗。`combatZone` 的边界由 `planetRuntime` 的已加载地表判定；越界前摇自动取消，已经扣除的真气与冷却不退，回到盆地不补发伤害。

## 操作与权威链

飞行 R 按当前**存档中的真实境界**选取招式：元婴 R4 气刃（32 m）、化神 R5 残影刃（38 m）、炼虚至合道 R6–R7 裂斩（42 m、局部 2.3 m）、星劫 R8 破虚（50 m、局部 6 m、1.8 s 前摇）、道源 R9 更大破虚（60 m、局部 9 m、2.2 s 前摇）。各阶有真气消耗与收势；R8/R9 需瞄准实际目标，失手也消耗资源。R6 空间步法另由飞行运行时负责。1/2/3 继续只调用已学习并装备的武器与两个主动槽；H2 弹体已采用俯仰三维方向，未学技能不会因飞行而获得。

飞行攻击在前摇结束时，用固定起手方向及指定中心重新计算三维接触与当前遮挡。近距地面 R 仍用原规则。掠兽保留原地面 AI 与实体，发现悬空玩家后固定瞄准点预警 1.15 s，再用真实远程攻击反击；玩家移动离开瞄准点可以躲开。所有命中经 `d3-combat` 的 `commitCast`/`resolveHit`；范围命中在同一个 `d3-session` root CAS 中结算，死亡事件由现有 director 原子物化遗留物，落地后仍按 H 取用。战斗图 scene v1 仅向后兼容增加可选玩家 `y` 和带三维原点/目标的空中 pending；旧 x/z 存档仍可读。

`combatView().ascensionCast` 提供玩家当前 R 空中招式或 `null`，字段 `id/kind/realm/origin/aim/direction/start/release/end/resolved`。`combatView().aerialCasts` 同格式列出玩家和掠兽抛射（附 `sourceId`）。位置采用盆地局部米坐标；`release` 是权威命中时刻。模型与特效可订阅这个事件，不得自行改血量或发物资。

## 高阶边界

“破虚”在本片是**已加载盆地内有冷却与前摇的局部空间裂斩**。它不会改写星球几何，也不表示可跨星。永久地形破坏需要另建持久高度差量、渲染网格/法线、水与生态重建、碰撞/导航及存档迁移；跨星需要真实目的地、场景流送与往返存档。现阶段均未建立，UI 与文案不得暗示已完成。

## CPU 验证与待实机

运行 `node --test playable/tests/aerial-combat-r8.test.mjs`：三维高度与遮挡、R4 命中至 CAS 掉落和落地拾取、掠兽预警可躲/可受击、未学槽拒绝与 H2 俯射、R8 两目标单次 CAS、越界前摇取消，以及前摇中远离目标不能隔空命中，共 7/7 通过。原有 `runtime-territory-independent.test.mjs` 7/7、`creature-territory.test.mjs` 8/8、`d3-session.test.js` 15/15、`d3-combat.test.js` 22/22 通过。五文件合跑 59/59 通过。

仍需串行 GPU/浏览器实机验收：盆地飞行时敌人能见、R/1/2/3 按键可达、俯射光效与真实命中方向一致、掠兽锁定预警可读、R8 大招前摇和命中反馈、快速飞出/返回战斗边界无跨区伤害，以及落地 H 拾取和重载后遗留物仍在。不得用测试档的高境界替代生产成长验证。
