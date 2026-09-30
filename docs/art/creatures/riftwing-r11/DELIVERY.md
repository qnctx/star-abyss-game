# 裂翼巡猎兽 R11：新增独立物种

先审看本轮批准的 `concept.png`，再以项目已有高质 `rift-prowler-v1/rift-prowler.glb` 的真实蒙皮四足、石甲材质和骨架为起点制作。历史ab11原生文件路径已不存在，因此导入完整GLB续作并交付新的可编辑Blender源；没有重跑Lux3D或额外生成。原六公里场景旧兽资产未修改。

概念图来源：本轮总控使用内置 `image_gen` 工具生成，原输出文件为 `C:/Users/HUAWEI/.codex/generated_images/01a0d79e-2cdf-7481-97d5-cac1cb7e07f1/exec-2dba82b5-45fb-4812-a48b-0943867d72f8.png`，项目内保存于 `docs/art/creatures/riftwing-r11/concept.png`。制作代理未获得完整原始生成prompt；以下仅是审图后的设计摘要，不冒充完整prompt：在既有暗石甲四足裂隙兽上新增额外成对膜翼，保留四爪、长尾、紫脉与琥珀眼；展示飞行展开、四足折翼及正面展开视图，强调层叠骨甲翼缘、分叉翼指、凹弧膜缘与地空两用结构。该图为用户本轮批准的单张参考，制作未新增生成调用。

## 资产

`playable/assets/creatures/riftwing-r11/riftwing-r11.blend` 与 `riftwing-r11.glb`。保留原兽35,967三角的身躯、甲片、头部、四爪与尾巴；新增双膜翼包含扇形凹弧后缘、纤维起伏、紫色血管、分叉骨撑、错层倒角甲片与甲片裂脉。双翼通过翼根/翼尖两个关节与渐变蒙皮权重真实折叠、展开和拍动，不是附着静态圆片。

最终预算45,163三角，新增翼9,196三角；4材质/4绘制批、单一24骨skin，GLB 10,786,180字节。原PBR纹理与顶点色保留，新翼使用灰紫膜色、石甲PBR和低强度紫脉发光；没有新增动态灯。Blender纤维微表面可继续编辑；游戏GLB携带可移植的顶点色与金属度/粗糙度PBR材质。

## 同一角色动画契约

坐标：米、Y向上、-Z朝前、+X朝右。对象 `RiftwingRig`，网格 `RiftwingBody` / `RiftwingMembraneWings`。保留 `Root/Pelvis/Spine/Chest/Neck/Head`、四足 `LF/RF/LH/RH_Upper/Lower/Foot`、`Tail01/02`。新增 `Wing_L_Root → Wing_L_Tip`、`Wing_R_Root → Wing_R_Tip`，翼根挂于Chest。

| 动作名 | 秒 | 循环 | 用途 |
| --- | ---: | --- | --- |
| ground-idle | 2.0 | 是 | 四足站立、折翼、头尾微动 |
| ground-walk | 1.1 | 是 | 对角腿交替地面步态、折翼 |
| ground-claw | 0.8 | 否 | 右前爪蓄力→前抓→回收，另外三肢支撑 |
| takeoff | 1.2 | 否 | 展翼与离地准备 |
| flight | 0.9 | 是 | 翼根拍动、翼尖随动、四腿微收 |
| dive | 1.0 | 否 | 带身体俯角的俯冲准备/回收 |
| sweep | 0.9 | 否 | 双翼横扫 |
| land | 1.3 | 否 | 由展开至折翼 |
| hit | 0.6 | 否 | 胸头受击摆动 |
| death | 1.5 | 否 | 侧倒与落地 |

所有GLB动作从t=0开始。运行时在同一个AnimationMixer上crossfade，负责物理位移、起落高度、导航、实际命中、碰撞与状态转换。clip是原地动作，根节点只含小幅视觉起伏/侧倒；不得以动画当作已实现的飞行/伤害业务。地面步态与死亡关键帧按实际原兽最低顶点校准平地高度，斜坡仍需运行时地面适配。

攻击接触点：`ground-claw`、`sweep`、`dive`均以normalized progress=0.5为最大前伸/横扫/俯角，运行时把权威命中时刻映射至该进度。地面爪抓必须使用 `ground-claw`，不使用双翼sweep冒充。

冻结GLB SHA256：`c1072aae2fd4e0f323739e1058ca8404b1c2fdd4d708fa4d7016923f6d9b9c02`。爪击右前脚中心最大位移0.8295米，其中向前0.6111米。

`measure_stride.py` 只读采样原地行走脚底蒙皮：前肢前后行程约0.694米、后肢0.586米。假设半周期支撑，参考步幅约1.28米/周期、速度约1.16米/秒；这不是带足部IK的严格无滑移契约。运行时可按实际速度/1.16缩放行走时钟。6.8米/秒需约5.86倍频，超过自然行走范围；高速地面追逐仍需专门奔跑动作或限制地面速度，不能把本clip宣称为已经匹配6.8米/秒的奔跑。

## 实际边界

`manifest.json` 的 `animatedBounds` 来自每动作17帧实际变形网格，坐标为游戏坐标，并给出保守XZ转身包络半径。折翼宽约1.49米、地面转身半径约2.152米；完整拍翼包络X约[-2.683,2.704]、Y约[-0.003,2.822]、Z约[-1.221,1.222]，转身半径约2.968米。展翼过渡保守半径约3.452米。飞行边界下沿不是身体高度，运行时根节点需放在真实离地位置。

## 验证与证据

1. 构建：`D:\blender\blender.exe --background --factory-startup --python-exit-code 1 --python tools/art/riftwing-r11/build_riftwing.py`。
2. 结构：`node tools/art/riftwing-r11/verify-glb.mjs` 已通过10动作名称/时长、24骨skin、所有primitive携带JOINTS/WEIGHTS及预算。
3. 实际运行时蒙皮：`node tools/art/riftwing-r11/verify-animation.mjs` 用Three.js GLTFLoader/AnimationMixer在CPU重新导入交付GLB，逐clip采样真实变形顶点；有限顶点、收展宽度变化、拍翼高度变化均通过。结果 `runtime-animation-verification.json`。
4. `render_verify.py` 强制Cycles CPU，审看 `ground-idle-0.2.png`、`flight-0.png`、`flight-0.25.png`、`flight-0.75.png`、`dive-0.5.png`、`death-1.png`：原兽四足和两额外膜翼完整、折翼/上拍/下拍/侧倒有清晰差异。模型资产验收不代替游戏内地空行为与战斗验收。
5. `ground_contact.py` 补带浅灰地面与接触阴影的行走两相位、落地、死亡图。死亡末帧已修正为约92°侧卧、收腿并卷翼；actor对象坐标保持[0,0,0]，body最低Y约-6.15e-8米（数值零），翼最低Y约+0.09775米，完整动画采样也无实质穿地。见 `ground-contact-verification.json` 与 `death-1-ground-contact.png`。
6. `verify_claw.py` 采样实际脚底蒙皮顶点，验证右前爪位移与LF/LH/RH支撑脚（每相位至少两脚底距地面≤3.5厘米），渲染 `ground-claw-0.25.png`、`ground-claw-0.5.png`、`ground-claw-1.png`；数值在 `ground-claw-verification.json`。

本片仅修改新物种资产、构建/验证脚本与交付证据；没有修改runtime，未占用GPU、未付费调用。
