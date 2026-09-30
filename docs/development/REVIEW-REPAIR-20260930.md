# 2026-09-30 review 修复与提交边界

## 已修复

- 默认 `npm test` 自动发现 playable/tests、playable/src、tools 下全部 `.test.js/.test.mjs/.test.cjs`，排除浏览器 `.spec.js`、历史 artifacts 及依赖目录。完整 feature/release 的 all 规则阶段使用同一发现清单；旧 JS 子集保留为 `npm run test:legacy`。子进程失败退出码直接透传。
- planet-integration 默认使用当前 checkout 的 terrainHeight 与本地 three，不再依赖 E 盘主目录；显式 PLANET_BASELINE 仍可用于对照旧地形。
- planet-global-audit 两项起飞场景补齐现行 R4 门槛；保留真实星球、起飞、半球和车辆存档断言，未放宽生产飞行规则。
- package-lock.json 随源码保存，新克隆用 npm ci 重现依赖。

## 验收证据与目录纠正

实际开发目录为 C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game。E:/myProject/star-abyss-game 并非这次提交的源码来源。GitHub 快照是提交时捕获的状态，后续并行修改需单独集成。

三份被 review 称为缺失的报告实际存在：[QA 恢复](LOOP-RECOVERY-R2.md)、[独立逻辑审计](reports/INDEPENDENT-LOOP-AUDIT-R2.md)、[旧实机证据](reports/TEST-NPC-MODELS-GPU-R1.md)。它们明确承认自然一级至突破未通过；十级夹具只到开始服药。菜单暂停模拟时间与 CAS 等待问题已在 QA 脚本修正，但尚无新实机完整通过结论。

性能、下降最终接地、第一人称手部和动作视觉问题仍待现有开发会话验收。设计文档继续属于设计范围，不升级为实装声明。Godot 当前迁移工程在 godot/；src/ 为保留的旧工程，两者与浏览器版的同步范围以各自验收记录为准。

## 复测步骤

实际执行结果：独立提交目录 npm ci 成功；npm test **649/649 通过**，fail/skipped/cancelled/todo 均为 0，直接进程退出码 0；针对性 feature-runner、planet-integration、planet-global-audit **21/21 通过**；npm run build 三项构建成功。完整 CPU TAP 随提交保存在 reports/REVIEW-REPAIR-20260930-CPU.tap。未运行浏览器/GPU/Godot 实机验收。

1. 新 checkout 运行 npm ci，再运行 npm test；检查 TAP 汇总和进程退出码，禁止用管道末端退出码代替测试结果。
2. npm run test:feature -- all --rules-only --plan：确认清单包含 planet-integration、planet-global-audit、progression-quests 及 tools 规则门禁测试。
3. npm run build：检查浏览器 bundle、checkpoint worker 和 ascension-gallery 构建。构建成功不代表画面通过。
4. 自然成长实机需隔离存档、独占 GPU 时段，按 LOOP-RECOVERY-R2.md 分别验证自然一级与十级夹具；没有 report complete=true、每步根状态、页面错误记录和截图不能签收。

## 备份范围

提交前完整工作区（含原始 artifacts 和 Godot 证据；不含可重建 node_modules/.godot）复制到 E:/star-abyss-backups/review-20260930。GitHub 保存当前源码、运行资产、制作源文件、测试、文档及小型 QA 工具；重复备份、录屏和 Godot reports/evidence 不纳入源码提交，原文件保留在工作区及本地备份。GitHub 源码快照不等同于全部历史验收素材的异地备份。
