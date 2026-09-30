# 步态 R4 — 2026-09-27

后续状态：用户再次否定此版走跑姿态，现进入[新图先行的R5重做](gait-r5/README.md)。下方限定验收是历史结果，不能作为用户对当前视觉的认可。R5实际运行时全蒙皮已复现walk约-3.99cm穿地；产品仍冻结在本页SHA等待正确新参考与后续制作。

状态：第二候选已获独立限定接受，范围为本次平地walk/jog/sprint及起停的高抬膝/僵直前伸腿修正。仅替换三步态和必要接触；使用既有生成参考图reference.png，本轮无付费生成。世界、Player速度/输入、保存、车辆、角色网格/手套、26条非步态动画保持。

## 原因与修改

旧轨迹把脚最高点放在身体下方/前方，jog/sprint大腿前摆最大63.42°/72.14°，形成高抬膝。旧通用踝锚还把walk骨盆额外压低最多6.20cm。R4改成步行低位过脚、跑步后蹬收跟再前摆，腰胸适度前倾、反相摆臂、较小骨盆起伏。

第一候选虽降低抬膝，但前摆末段触及腿长限制，近直膝向前踢。第二候选缩短前摆、略降骨盆基线保留屈膝余量、增加4°腰胸前倾，Hermite同向中间节点保留速度；jog/sprint相位约.8/.9膝屈从5.7°变为34.1°/23.9°、29.2°/17.6°。不以“越低抬膝越好”判断自然度。

| 步态 | 速度（不变） | 完整周期步幅 | 周期 | 单脚支撑占比 |
| --- | --- | --- | --- | --- |
| walk | 1.6m/s | 1.4m | 0.875s | .55 |
| jog | 6.8m/s | 4.0m | 0.588235s | .20 |
| sprint | 10m/s | 4.6m | 0.46s | .18 |

相位仍按实际水平速度/步幅推进，右脚错开半周期。`_lock_gait_contacts`单独锁鞋跟/尖接触点，允许踝随滚动上升，保持作者膝弯曲方向，不为步态额外压骨盆。`_gait_contacts[side].world`为真实支点；步态下`_foot_anchors`为随滚动变化的踝目标，不应再用踝点零速度证明足底防滑。战斗继续使用R3支撑逻辑；地面过渡仍0.15s。

## 证据与边界

`evidence/gait-r4/before`旧版、`after`第一候选、`candidate2`第二候选互不覆盖。前/侧/后夹具同镜头/灯光/速度，每次442个真实`_physics_process(delta)`帧、7.3667物理秒、time_scale=1、112张采样PNG。GIF按实际物理采样时差编码，不是真人输入。相位sheet用于诊断，不能代替连续最终蒙皮观看。

| candidate2侧视稳态左腿 | walk | jog | sprint |
| --- | --- | --- | --- |
| 大腿最大前摆 | 27.73° | 39.35° | 40.14° |
| 骨盆上下幅度 | 1.39cm | 2.52cm | 2.51cm |
| 踝最高点相对身体前后位置（正为身后） | +.387m | +.580m | +.616m |
| 步态IK额外压骨盆 | 0 | 0 | 0 |

这些数值只解释画面，不作为自然度通过线。代表鞋底点按踝刚性变形估算，平地支撑误差约-12.1～+11.3mm。另以Blender求值完整蒙皮检查三步态118个作者帧，有限性/跨度/边长筛查通过（最大边0.30481m），但局部网格最低高度walk/jog/sprint为-4.02/-1.09/-1.43cm。因此严格完整鞋底不穿地尚不通过，不能用简化鞋底估计覆盖完整蒙皮结果；没有扩修坡面或足底系统，也没有宣称真人键鼠手感。见`gait-r4-deformation.json`。

`build_gait_r4.py`从冻结R3 Blender源仅替换三条动作，断言51根rest、网格与权重源哈希不变。`verify_gait_r4.py`逐导出数据比较：29动画中仅三步态变化，26非步态channel/sampler/accessor、所有mesh属性/索引、inverse-bind accessor完全一致。`gait-r4-preservation.json`和`gait-r4-export-check.json`记录结果。

- GLB SHA256：`942f372de11641e9c8189f2aef39ed68956e4eed1d54bd14243cb86f022e2430`
- 驱动SHA256：`95d3a7df91e2dfe5128fd0a649c0e8696457f4d8dd07f178374a4018dabb78c6`
- 独立[FINAL-REPORT.md](../../reports/gait-r4-independent/FINAL-REPORT.md) SHA256：`b8be7481317ca30320c6817e5dc8a2f2915bba384c45f02fcf52cb7c85a0cc83`。实际产品自动物理810帧，376张侧面采样，time_scale=1；13.5物理秒/13.447844墙钟秒，中位帧间隔33.387ms，最长60.424ms，输入观察不匹配0、采前后源变化0。最终蒙皮连续序列可读出屈膝前摆、后跟回收和交替支撑，六段起停未见明显跳姿/膝反折；前walk/jog和后sprint已查看。独立限定接受本次平地修正，不宣称完美自然、完整鞋底或坡地通过。报告已收录上方开发者测得的完整网格最低高度，未冒充其独立复测。
- 三视图101组存在读回开销，只作同镜头姿态证据；近正常时间节奏依据另采的轻量侧视。开发者也打开`evidence/gait-r4/preview.html`正常播放对比并检查播放过程截图，截图观察不等于真人试玩或人类完整视频审看。
- 最终适配器关联回归：1537个真实物理回调、25.6167物理秒/25.4969墙钟秒，time_scale=1、实际delta均约1/60秒。三步态→停止→五类地空施法，51骨rest稳定、掌/脚socket有限、各施法计时跨释放点一次，failures=[]、pending=[]。保存到`evidence/gait-r4/regression/`，未覆盖R3证据；没有重新声称验证Main伤害或真人输入。最终逐文件指纹见`evidence/gait-r4/final-manifest.json`。

## 创作依据

重新阅读[Animation Mentor / Jason Martinsen人体步行教学](https://www.animationmentor.com/blog/tutorial-animating-human-walk-cycle/)，采用接触、压低、经过、推离关键姿势、髋胸反转、连续脚部移动与手臂跟随；[Game Anim跑步拆解入口](https://www.gameanim.com/2016/02/26/10882/)仅为作者参考入口，未声称观看其嵌入视频。数值为此C2角色本地制作/测量，并非生物力学标准。

## 复现与试玩

在指定C: worktree根执行。R4使用下列构建入口；R3 build.py是历史重建，会写回旧步态，不应作为当前步态构建入口。

```cmd
D:\blender\blender.exe -b --python godot/assets/motion-r2/build_gait_r4.py
python godot/assets/motion-r2/verify_gait_r4.py
D:\blender\blender.exe -b -t 2 --python godot/assets/motion-r2/verify.py -- --gait-r4
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --editor --import
python godot/assets/motion-r2/capture.py res://assets/motion-r2/gait_r4_probe.gd --capture --tag=candidate2 --view=side
python godot/assets/motion-r2/gait_r4_summary.py before candidate2
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://assets/motion-r2/r3_live_probe.gd -- --out=res://assets/motion-r2/evidence/gait-r4/regression
```

1. Ctrl+W、W、Shift+W依次检查1.6/6.8/10m/s，从前/侧/后观察后收脚跟、落地屈膝、摆臂和膝盖方向。
2. 检查起步、松键停止、走/跑/冲刺切换，排除旧高抬膝与第一候选直膝踢脚。
3. 最终真人试玩另检查转向、倒退、侧移、坡地；它们不由本平地合成夹具宣称通过。
