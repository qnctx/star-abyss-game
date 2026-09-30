# 第一阶段岩壁相机修复独立复验

结论：**PASS（仅本次岩壁相机缺陷与相关几何采样范围）**。R2历史报告FAIL保留，未改其冻结输入。

独立树 artifacts/tests/PHASE1-SCOPE-PREP/r2-camera-fix 复制自 PHASE1-R2 的src，仅叠加主控修复的camera.mjs，SHA256 `d64d3d3c924043aaad7b32a2a3b2655629f2db560d21860587ed06d55fbbdfd1`。副本输入记录camera-fix-input.json。

1. 重跑7簇全部6469个实际Three渲染mesh向下射线采样，顶面/支撑差异仍最多1.049mm；相机漏挡由107降至0，地面人物碰撞与168个横向视线采样无新增失败。
2. 独立camera-fix-replay.mjs直接读取R2保存的107个旧失败坐标，使用默认0.22m相机半径逐一重放。107点cameraBlocked均true；107次从顶上1m扫向顶内0.25m均occluded=true，且最终相机位置严格高于实际mesh顶面。
3. 原第一章物理/剧情26965帧往返结果可引用R2报告：此次只改相机查询，人物/剧情/几何未改。未重算或重复计数该回归。

证据：outcrop-camera-fix-audit.mjs/json、camera-fix-replay.mjs/json、prepare-camera-fix.cjs，均在上述PHASE1-SCOPE-PREP目录。未修改产品代码。

限制：这是独立几何/逻辑复验，无原生画面或自然玩家镜头操作。纹理、色彩、整体地图美术与完整浏览器第一章由其他验收承担。后续R3冻结若相机文件SHA或几何变化，应复核差异后再引用，不能直接继承为整版PASS。

## PHASE1-R3 AI独立补充检查

仅读取 artifacts/deliveries/PHASE1-R3 冻结源，整份manifest重新SHA核验。独立脚本 ai-r3-independent.mjs 与JSON证据位于同一PHASE1-SCOPE-PREP目录；5组必要测试全部通过，未复制开发测试，未修改产品。

- 20/60/144Hz跨±π转向保持最短角度方向，单步不超过5.5rad/s限制，有限步收敛。
- 超过6m近距感知的遮挡目标保持旧lastSeen；重新可见时立即更新新位置，最后见到后超过3秒清记忆。
- 直达路线中玩家仅侧移1m，下一帧已改变朝向并更新目标，无旧4m/1.5秒阈值迟延。
- 所有路径封死时40帧不越障、不NaN；通路打开的下一帧恢复移动，未出现永久空路径卡死。隔墙攻击启动明确拒绝。
- 经真实createExpeditionRuntime与createSession的内存CAS消费者，正常生成一敌并进入攻击前摇；玩家改变位置且墙在命中前出现时，整个前摇敌人方向与提交pending.yaw保持不变，实际命中结算不扣玩家HP。后摇结束后撤墙、移动目标，追击正常恢复。

源码审查与以上范围未发现新增AI阻断。近距6m感知可在无视线时更新目标属于现有感知规则，但攻击启动与命中均仍检查LOS；该现象不能误报为隔墙伤害。存储busy期间暂停tick仍是现有权威事务行为，本轮未新增无界异步移动。

这些是独立逻辑/运行时消费者测试，不替代原生AI灵活度、动画自然度及复杂地形全覆盖的实玩结论。
