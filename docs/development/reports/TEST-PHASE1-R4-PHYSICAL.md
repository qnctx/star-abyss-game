# PHASE1-R4 独立物理复验

结论：**PASS（限定逻辑与几何范围）**。唯一产品源为 artifacts/deliveries/PHASE1-R4，141项manifest输入SHA重新核验。R3至R4对比只有phase1-terrain.mjs与game.js不同；AI、故事、岩壁几何、相机文件相同，R3独立AI5组结论引用原报告，不重复计数。

- 完整第一章实体路线往返：26965帧通过，包括物理碰撞、交互距离/视线、错序恢复、途中读档、黑匣子回营与幂等。仍是Node积分fixture，不是原生实玩。
- 新地形基面7簇岩壁6469点：实际Three渲染mesh与支撑顶面最大误差1.049mm；相机/人物地面碰撞无漏挡，168方位横截面LOS无漏挡。
- 原107失败点保留x/z，再用Three Raycaster测R4实际顶高，以新顶上1m向顶内0.25m复放相机扫掠：107/107阻挡且停在新顶面外。

测试修正说明：直接照搬R2旧绝对y的首次脚本失败；新基面变化后其中27点原高度已经位于R4岩顶上方，这些空中点不应强制判障碍。按相同x/z、相对于真实新mesh顶部的穿入深度重测通过。初次失败日志camera-r4-replay.mjs.log保留，最终权威结果camera-r4-replay.json明确坐标策略，未改产品掩盖测试。

证据均在 artifacts/tests/PHASE1-SCOPE-PREP：route-r4-independent.mjs/json、outcrop-r4-audit.mjs/json、camera-r4-replay.mjs/json、r4-difference.json；prepare-r4.cjs可复跑。未执行重复全量测试，未修改产品。原生新岩谷/完整玩法观感由独立浏览器任务给出，不由本报告代替。
