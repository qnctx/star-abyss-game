# Godot 主线 review 修订（2026-09-30）

## 适用结论与纠正

以 Godot 为当前主线成立，实际入口为 `godot/project.godot`，不是 review 所调查的 `src/project.godot`。当前原生工程已有六公里盆地、球体、走跑、飞行、空战、载具和独立存档；完整剧情和自然成长尚未迁移完。只调查 4.6 MB 的旧 src，不能据此断言当前活跃游戏规模或把其余内容均视为垃圾。

旧 src 四文件的昼夜调度、粒子信号清理和测试退出修复存在，且已包含于 GitHub 分支 `codex/review-repair-20260930` 的提交 `d72ff9042af8c7e5f9c159ad81639d80f7512c44`。实际开发工作树仍保留 dirty，因其他会话还在开发；HEAD 旧并不代表没有可恢复的提交。旧工程缓存存在只能证明曾发生导入或编辑，不能单独证明其为当前主线。旧 372/31 测试数字和浏览器 649/649 均不能作为最新原生验收。

原 `.gitignore` 已有 `.godot/`、`[Bb]uild/` 和 `/build/`；本次无需重复补写。新增 Python `__pycache__/`、`*.py[cod]` 忽略，保留制作脚本。`tools/` 同时包含 Blender/绑定/原生素材制作，不能整目录按 HTML5 残留删除。

## 已落实

- AGENTS.md 明确当前原生主线、历史参考与资产退役边界，保留原生六公里世界、角色、天空、载具、调查和兼容存档要求。
- README、godot/README、PROGRESS 统一当前入口；src/README 标明旧工程；HTML_GODOT_CONTRACT 保留历史内容并解除当前双端同步叙事。
- 默认“启动试玩”与“启动Godot试玩”共用 `tools/start-godot.cmd`。增加 `--check` 模式，不启动引擎或导入；支持 GODOT_BIN。浏览器只通过明确命名的历史入口启动，测试室脚本注释标为历史专用。

## 归档与保留

| 内容 | 当前处置 |
|---|---|
| godot/ 生产脚本、场景、运行资产、制作源文件 | 当前主线，保留 |
| src/、playable/、历史启动及 npm 工具 | 历史参考，退出默认游戏入口；未物理删除 |
| tools/、docs/cultivation、概念图与制作源 | 按实际用途保留，不能以浏览器目录来源判断可删 |
| artifacts、Godot reports/evidence、旧 verification 文件 | 原始证据保留，完整本地备份在 E:/star-abyss-backups/review-20260930；GitHub 首次快照只纳入整理后的源码与资产范围，不包含所有录像与重复备份 |
| .godot、node_modules、Python 缓存、测试输出 | 忽略可重建缓存；本轮不删除，以免影响并行会话 |

当前生产 GDScript 及主场景未发现实际读取 playable/artifacts 的路径，只有 native_world/native_planet_coordinates 两处历史移植来源注释。这只说明原生运行引用范围；完整重新制作、导出、历史验收复现仍可能依赖 tools、参考图及证据，不能据此宣称整批删除绝对安全。

## 验证步骤及边界

本片实际结果：三个入口检查退出码均为 0，均指向实际工作树 godot/project.godot；32 个项目/脚本/场景文件内 59 处字面资源路径无缺失输入，其中 native_planet_visual_probe 的 reports/planet-world-r2/segments 是代码显式创建的输出目录；四类缓存路径均命中 git ignore。未启动引擎，未重跑原生游戏测试，未宣称视觉或性能通过。

1. 仓库根目录执行 `tools\start-godot.cmd --check`、`启动试玩.cmd --check`、`启动Godot试玩.cmd --check`：三个入口均应解析到当前工作树 godot/project.godot 并退出 0；不运行 Godot。
2. 静态枚举 godot/project.godot、godot/scripts、godot/scenes 中的字面 res:// 引用，确认文件存在；这不检查引擎导入、运行动态加载或画面。
3. `git check-ignore godot/.godot/imported/check.tmp src/.godot/imported/check.tmp build/check.tmp godot/tests/__pycache__/check.pyc`：四项都应命中忽略规则，不创建这些文件。
4. 当前原生实机和 headless 验证按 godot/README.md 的测试清单另行执行；本片不启动引擎，不把静态检查写成游戏测试通过。
