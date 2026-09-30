# R4 元婴飞行下降键：C

飞行专项试玩入口：`http://127.0.0.1:4173/star-abyss.html?testLab=1`。等待外勤加载完成后，确认标题为“元婴自身飞行 · 离地最高 2,000 米”，再开始测试。无参数普通入口保留真实主线进度；未达到元婴的 L0 存档仍是最高 4.5 米的旧玄壳助推及其动画，不能用来验收新版元婴飞行。2026-09-26 已在用户内置浏览器核对两种入口，并在独立测试档确认 30 米新版第三人称悬停和 C 下降提示；普通存档未升级或重置。

试玩反馈指出 Ctrl 与浏览器快捷键组合冲突。元婴自身飞行现在按住 **C** 下降，松开后悬停；G 起飞/上升，空中 Space 也可上升。原盆地地面 C 仍为蹲伏/起身，Ctrl 仍为慢走。飞行下降只读取明确的 `descend` 输入，不再把地面 `walk` 当成下降。判断用真实的 `planetRuntime.active`，仅解锁飞行或启用行星运行时不会屏蔽盆地地面蹲伏。飞行活跃时 C 不触发蹲伏动作，底部无效的蹲伏按钮隐藏，落地后恢复。远区径向地面仍保留此前站姿航行规则，本片没有扩展该处蹲伏能力。

F2 实验室的高度跳转仍进入 `hover` 测试模式；点“恢复键盘飞行”后才会响应真实键盘 C。实验室“持续下降”按钮继续通过明确的 `descend` 输入工作。F2 模式、飞行碰撞、能量、降落条件及存档未改。旧 R2/R3 报告里 Ctrl 下降是当时版本的实测记录，本页记录当前按键变更。

CPU 验证：

```cmd
node --test playable/tests/input.test.js playable/tests/flight-hud-r2.test.mjs playable/tests/test-lab.test.mjs playable/tests/flight-r2.test.mjs playable/tests/planet-gameplay.test.mjs playable/tests/planet-gameplay-r2.test.mjs
node --check playable/src/main.mjs
node --check playable/src/ui.mjs
node --check playable/src/planet-runtime.mjs
```

结果：63/63 通过，三个语法检查通过。输入测试覆盖地面 C 一次蹲伏、飞行活跃时 C 持续下降且不蹲伏、松键停止、Ctrl 慢走不下降、暂停清除按键以及系统快捷键原有边界；飞行测试继续覆盖悬停、受控下降、地表碰撞与能量。

手工复验步骤：在可飞行测试档盆地地面按 C 确认蹲伏/起身，Ctrl 确认慢走；按 G 升空，确认底部蹲伏按钮隐藏，按住 W+C 观察高度下降且水平前进、松开后悬停，Ctrl 单独按下不下降；实际落地后 C 再次可蹲伏，按钮恢复。F2 跳到 30 米先确认停悬，点“恢复键盘飞行”再用 C 下降着陆；另用“持续下降”按钮验证既有自动模式。检查 HUD、目标提示、主菜单与 F2 的中文键位说明一致。

最终构建 SHA256：`6b6a96b6553c6ea060acecc15af5449219bd10c88a87e0b809ce492532866fe0`。独立浏览器使用真实键盘验证 200m W+C 同时前进下降、松C后悬停、单Ctrl不下降、30m C安全落地、盆地 C 站立→蹲伏→站立；F2/HUD 中文提示有截图，页面错误0。证据 `artifacts/r4-candidate/report.json`。浏览器测试未按 Ctrl+W 关闭窗口；本片没有新增 Ctrl+W 拦截来代替更换下降键，也未改既有地面 Ctrl 组合处理。
