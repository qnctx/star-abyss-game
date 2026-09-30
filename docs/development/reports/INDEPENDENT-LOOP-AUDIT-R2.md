# 前期循环独立 CPU 审计 R2

2026-09-25。范围：药品完成、根状态 CAS、任务证据与自然一级至 R0 突破。仅审查产品代码、旧浏览器证据并执行 CPU 断言；没有启动浏览器、GPU、Blender、4173 服务或付费生成，也没有修改生产文件。

## 结论与证据边界

- 旧十级满槽夹具的 `medicine-crafted-and-used.json` 是 **开始服药** 的证据，不是服药完成证据。revision 50、`simTime=40.6818667`、`camp.use.dueAt=43.6818667`，MED02 数量 1 且 `status=locked`，共享冷却仍为 0，Q01 仍为 `active`。旧 `Q01-delivered.json` 仍处于同一 revision 50 与药品锁定状态；旧报告记录 `accessDenied`，没有完成交付。
- 用当前 `evidence()` 对旧快照只读复算：实采月露苔 3、铁陨 2、玩家击杀 1、血样教学为 true，`questReady(Q01)` 为 true。因此旧交付失败的关键未满足条件是动作授权时 `camp.use` 仍非空，而非 Q01 证据不足。产品运行时在菜单打开时停止 `tick`，服药 `use-finish` 只有无菜单且经过 3 秒模拟时间才能发起；在 NPC 菜单中等待会冻结这一进程。关闭菜单并等待根状态的 `camp.use=null`、MED02 被消耗和 `cooldownUntil>simTime`，再接近 N01 交付，才是有效续测。此处没有证据认定产品死锁。
- 药品 reducer 在到期前拒绝 `use-finish`；到期后在同一根状态内消耗 MED02、清除 `use`、写入 45 秒共享冷却。旧快照的复制根经 reducer 续算后可交付 Q01；这只证明数据模型能走通，不证明浏览器动作授权、持久 CAS 或实机完成。
- D3 `createSession.execute()` 从持久根读入、校验 expected revision 与授权、在私有副本应用营地/成长动作，最后一次 `compareAndSwap` 发布；事务 ID 重试返回旧 receipt。任务证据取自已提交的采集 receipt、玩家击杀 cast/hit/尸体与血样教学状态；Q01 不再次扣血样。现有相关单测验证了失败回滚、去重和竞争修订拒绝。浏览器级连贯交易仍未验。
- 自然一级记录只证明 Q01 接取和采集，站桩近战被掠兽击倒后终止。十级夹具预设等级 10 与满槽修为，但未预置任务、物资、三节点。现有突破单测也直接设等级 10 与满槽，不能当成自然一级升满证明。N01 交付、N03/N04/N05 后续业务、三节点与 R0 突破在旧实机记录中均未通过。

## CPU 验证

- `node --test playable/src/progression-quests/quests.test.mjs`：10/10 通过。覆盖真实记录构成 Q01、精炼材料、容量失败回滚、离线时间、三节点模型、CAS 去重/竞争、交易库存及 runtime 靠近与朝向门槛。测试的 `authorize:()=>true` 夹具不证明浏览器授权。
- `node artifacts/independent-loop-r2-cpu.mjs`：通过；结果在 `artifacts/independent-loop-r2-cpu.json`。以旧 revision 50 根快照复算 Q01 证据，拒绝未到期服药，复制根到期后完成药品 reducer 与 Q01 reducer。脚本没有写回旧证据或生产存档。

## 下一个最小切片

先在隔离十级夹具中恢复实机：领取 MED02 后关闭所有菜单，等待真实 `use-finish` CAS（`use=null`、药品减少、冷却建立），再打开 N01 交付 Q01，并保存每一步的根 revision、任务状态和页面错误。此项通过后再扩至 N03/N04/N05 与三节点。自然一级路径单独设计走位/闪避战斗和连续升级验收，不以十级夹具替代。

## 参考位置

- 旧状态：`C:/Users/HUAWEI/.codex/worktrees/cb21/star-abyss-game/docs/development/PLAYABILITY-STATUS.md` 与 `docs/development/reports/TEST-NPC-MODELS-GPU-R1.md`。
- 旧实机根快照：`C:/Users/HUAWEI/.codex/worktrees/cb21/star-abyss-game/artifacts/npc-loop-breakthrough/medicine-crafted-and-used.json`、`Q01-delivered.json`、`report.json`。
- 当前代码：`playable/src/foundation/camp-state.mjs`、`playable/src/expedition-runtime/index.mjs`、`playable/src/progression-quests/index.mjs`、`playable/src/progression-quests/runtime.mjs`、`playable/src/d3-session/index.mjs`。
