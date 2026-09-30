# R7 隔离 3D 步态候选

2026-09-30。本轮沿用已获人类批准的四张 R6 动作图方向，没有新增图片或收费服务。本文件只报告候选作者侧结果，**不代表自然度通过，也不代表用户验收**。生产 Blender、GLB、clips 和共享 Player/Motion 未由此构建覆盖。

## 可审候选

当前供主控 Godot 对照的候选为 `next.glb`，可编辑源为 `../source/gait-r7-candidate/next.blend`。SHA-256 为 `49e8dc0f3b119d8fb248067117283fdf1215add7af1f0c1704ae2beaf52f4244`。

最初版本 `candidate.glb` 保留原样，SHA-256 为 `18a8bc45545f43c310cd545191e41e9cc1ee77ecb56629a1596a400cf015a976`。它的步行高位支撑目标不可达而产生限长，不应作为完成版本；保留用于和第一轮取证对应。当前候选在离线全鞋底接触校准过程中求出支撑所需的骨盆高度，并保留自由摆动腿的相对姿势，不靠截短腿部掩盖不可达。

所有 `.blend` 均放在有 `.gdignore` 的 `source/gait-r7-candidate/` 中，Godot 只需导入指定候选 GLB。

## 重新编排的动作

完整图像映射与阶段目标见 `POSE-EVENTS.md`；实际编排在 `gait_r7.py`：

- 摆动腿使用明确的大腿前后角和膝屈曲关键姿势。步行离地后小腿折回、低位经过、伸膝准备脚跟接触；jog 先在髋后收小腿，再由髋驱动前摆，再展开回扫落地。
- sprint 使用更紧凑的后收、更明确的髋后伸和约 20° 躯干前倾，区别于约 8° 的 jog 躯干前倾；肩与肘有独立事件曲线。
- 支撑段保留真正鞋跟、全脚、前掌的滚动过程及接触向后的位移；左右相差半周期。横向骨盆重心移向支撑侧，胸廓与骨盆反向转动。
- 只复用 R6 的通用 Hermite 插值、四元数和二段骨长解算函数，以及原资产保全导出工具；没有调用 R6 的 `gait_pose` 来改几个幅度参数。

兼容契约未改：walk/jog/sprint 的 stride 为 1.4 / 4 / 4.6 m，stance 为 .60 / .22 / .20，速度为 1.6 / 6.8 / 10 m/s；动作长度仍为 52/60、35/60、28/60 秒，均为 120 Hz 真实骨骼关键帧。

## 作者侧检查

`next-export-check.json` 证明只替换了候选中的三个步态。其余 26 个动作逐通道输入/输出访问器完全一致；网格、索引、权重、材质分配、51 骨 inverse bind、材质 JSON 和四张内嵌 PNG 字节均与不可变 R7 基线相同。

`next-authoring-report.json` 保存每个关键帧的真实鞋底、目标修正、腿长可达性、关节姿态和骨盆接触调整。最终目标限长为 0 帧，旧代理预估阶段的临时超长仍单独记录，没有删除问题数据。

以 240 Hz 重新加载可编辑源并采实际变形鞋底，结果为：

| 项目 | walk | jog | sprint |
| --- | ---: | ---: | ---: |
| 鞋底最小高度 | +1.824 mm | +0.481 mm | **-0.506 mm** |
| 大腿前后范围 | -20.56°～+32.66° | -29.25°～+45.00° | -30.51°～+48.96° |
| 膝屈曲范围 | 10.00°～38.92° | 12.00°～112.01° | 12.00°～118.91° |
| 最高膝盖相对髋 | -346 mm | -291 mm | -270 mm |
| 51 骨循环矩阵误差 | 0 | 0 | 0 |

冲刺仍有约半毫米帧间负高度，不能写成完全无穿地。源蒙皮检查不证明游戏 GPU 蒙皮、脚锁、混合过渡或视觉自然度合格；由主控在实际 Godot 原速、同事件骨架和蒙皮实帧中继续核对。

## 复现与检查步骤

在本工作树根目录运行，全部为 Blender 后台 CPU 操作，不运行 GPU 渲染：

```bat
D:\blender\blender.exe -b -t 2 --python godot/assets/motion-r2/gait-r7/build_candidate.py -- --next
D:\blender\5.2\python\bin\python.exe godot/assets/motion-r2/gait-r7/verify_export.py --next
D:\blender\blender.exe -b -t 2 --python godot/assets/motion-r2/gait-r7/verify_source_dense.py -- --next
D:\blender\5.2\python\bin\python.exe godot/assets/motion-r2/gait-r7/check_production_untouched.py
```

视觉检查重点：步行接触腿与前摆末段是否形成自然剪刀轮廓、髋下支撑是否柔和伸展、双支撑与低位过腿是否连贯；jog 后收是否紧凑而非拖脚；sprint 是否有明确更前倾、更有力后蹬和更快收腿的级差；双臂是否真正参与，脚尖是否朝前。任何候选整合到生产前仍须主控审核最新生产资产和共享代码，不能直接用旧快照覆盖。
