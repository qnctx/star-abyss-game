# 默认分支与主目录衔接（2026-09-30）

## 结果

GitHub main 从 5fdb455 快进到 dc1c3c9，包含 d72ff90 的完整原生源码/资产快照及后续入口修订，不改变默认分支名称。旧 src 四文件修复在 d72ff90 中已入库。本记录随后随同一分支提交。

E:/myProject/star-abyss-game 已同步该已发布快照，补齐 godot/project.godot、原生脚本、场景、运行/制作资产及原生启动入口。它是已发布快照的工作目录；C:/Users/HUAWEI/.codex/worktrees/3ff0/star-abyss-game 仍有后续并行开发，未切换 HEAD、未覆盖其游戏代码，不能把主目录快照当作那些新切片已完成或已发布。

## 保全方式

- 先完整备份主目录到 E:/star-abyss-backups/primary-before-sync-20260930，排除可重建 node_modules/.godot 及 Git 元数据；保留原始文件、历史 artifacts 与独立子工作区文件。
- 使用独立 GIT_INDEX_FILE 创建本地保全分支 codex/primary-before-sync-20260930，提交 8140633419163cf16c608241de480b9d462beccd，涵盖当时已修改、已删除及未跟踪的非忽略文件。该分支是本地恢复记录，未把全部历史素材推送远端；原主目录索引也单独备份。
- 对比：1067 文件一致，2488 缺失，18 不同。仅补齐缺失文件并同步 13 个已核对的修复相关文件；下列 5 个本地独有文件逐字保留：docs/3D_VFX_ENGINEERING_SPEC.md、docs/DEVELOPMENT_MASTER_PLAN.md、docs/GAMEPLAY_TESTING.md、playable/src/d3-session/evidence-r3/node.json、playable/src/d3-session/evidence-r3/r2-node-regression.json。旧 .claude 子工作区的独立脏状态同样保留。
- 从已验证的本地克隆导入提交/远端引用，确认主目录没有暂存变更且旧 HEAD 为上游祖先，再用 mixed reset 更新 main 和索引；没有 hard reset、强制检出、stash 清空或删除主目录额外文件。

## 验证与复测

主目录三个入口的 --check 均退出 0，解析到 E:/myProject/star-abyss-game/godot/project.godot；31 个项目/脚本/场景文件、58 处字面路径无缺失输入，一处为显式创建的取证输出目录；四类缓存路径均被忽略。保留文件与备份逐字比较一致，GitHub main 引用已独立读取核对。未运行引擎、GPU 或导入，之前的 649/649 CPU 与构建结果仍只适用于提交快照，不当作新原生实机验收。

复核命令：git rev-parse HEAD；git ls-remote origin refs/heads/main；tools\start-godot.cmd --check；git status --short。保留的 5 项差异和历史额外文件会继续显示为 dirty/untracked，这是保全结果，不应为追求干净状态直接删除或覆盖。

需要恢复旧文件时先查看保全分支或备份，并只恢复明确目标路径；不要用全目录 reset 覆盖后续开发。
