# R6 元婴 Space / G 统一起飞

## 行为

用户在元婴已解锁的盆地地面按 Space 时，输入原本只标记为旧 `jump`，行星飞行运行时只读取 `lift`；行星运行时先返回，随后旧移动系统执行跳跃或玄壳助推，所以 Space 与 G 呈现两套姿势。现在主循环在行星运行时之前，将已解锁、未乘车、尚未处于旧跳跃或助推中的 Space 和 G 统一送入元婴 `lift`。若地形未就绪、室内、能量或其他飞行条件拒绝起飞，该次输入也不会掉入旧跳跃/助推；松键后可重新尝试。技能动作、服药和负重已有的禁飞输入过滤仍先于该分流。

普通 L0 存档未解锁元婴时，Space 仍为跳跃，原 G 玄壳助推不变。乘车时 Space 仍为刹车。元婴飞行成功后清除旧移动系统的空中、推力和跳跃残留，人物首帧从站立姿势向元婴动画过渡，旧喷气特效在元婴飞行时隐藏。按 C 下降且仍按住 Space 或 G 接地时，起飞键必须先松开，下一次按下才可重新起飞，避免接地反弹。R5 的下降曲线、2000 米上限、碰撞及存档逻辑保持原样。

元婴已解锁时的地面 HUD、目标说明和 F2 测试面板都说明“Space / G 起飞”。主页面说明写明普通跳跃与元婴解锁后的起飞区别；车上 Space 刹车仍单独说明。

## CPU 验证

在当前工作区执行：

```cmd
node --test playable\tests\innate-takeoff-r6.test.mjs playable\tests\input.test.js playable\tests\flight-descent-r5.test.mjs playable\tests\flight-r2.test.mjs playable\tests\planet-gameplay.test.mjs playable\tests\planet-gameplay-r2.test.mjs playable\tests\planet-integrated-runtime.test.mjs playable\tests\test-lab.test.mjs
```

结果：70/70 通过。新增测试使用真实 `createPlanetRuntime` 在盆地分别按 Space/G 起飞，核对元婴 active 与旧推力清理；实际输入快照核对 L0 Space、已解锁 Space/G、禁飞过滤及乘车 Space；另验证首帧动画不混入旧空中 clip、C+升键持续按住接地不反复起飞。相关生产模块语法检查通过。

## 构建后的人工验收

由总控构建并在独立 `?testLab=1` 测试存档及普通 L0 存档分别验证，不修改用户正式存档。测试档在盆地地面先松开所有键，按一次 Space，观察立即进入元婴自身飞行、人物不抬膝摊手且没有玄壳喷气；落地后单独按 G，确认动作、HUD 与高度变化相同。分别在第一、第三人称观察起飞首帧。飞行中按住 C+Space 直到接地，继续按住约一秒应保持接地；松开 Space 后再按可重新起飞。进入车内按 Space 仍减速；普通 L0 地面按 Space 仍跳跃。检查 HUD、F2 帮助和主页面说明中文字完整且按钮可用。此片未自行构建或启动浏览器/GPU。

## 独立浏览器结果

总控构建后由独立浏览器执行真实键盘输入，包 SHA256 `cc030126f022fa9e6365dfa76958589132274b45f64d12c2334d50b9ca4a893e`，报告 `artifacts/r6-candidate/report.json` complete=true、errors=[]。

地面 G 从0升到约19.96米，地面 Space 从0升到约19.14米；两者都进入元婴 flight.active，旧 jump/flight.airborne 和 thrusting 均为 false。两组第三人称截图均为直立飞行，未见旧抬膝摊臂姿势；第一人称也已截图检查。空中 Space 从约39.87升到62.41米。普通 L0 Space 跳到约0.79米且未进入元婴飞行；车辆前进速度约10.95时按Space降至0。共保存7张截图。浏览器未暴露直接的 jets.visible 字段，喷气核验依据旧推力状态与实际截图，不声称读取了该字段。

发布和 HTTP 包哈希核验记录为 `artifacts/r6-published.json`、`artifacts/r6-published-verification.json`。持续 C+升键接地不反弹由上述 CPU 行为测试覆盖。
