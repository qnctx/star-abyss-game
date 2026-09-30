import datetime,hashlib,json,pathlib
here=pathlib.Path(__file__).resolve().parent
def read(name):return json.loads((here/name).read_text(encoding='utf-8'))
manifest=read('FINAL-MANIFEST.json')
combat=read('combat-live.json')
checks=read('combat-assertions.json')
melee=read('melee-final-audit.json')
visual=read('visual-final-summary.json')
ui=read('small-ui.json')
hitmiss=read('hit-miss-final-audit.json')
important=['godot/scripts/native_player.gd','godot/scripts/native_main.gd','godot/scripts/native_motion_r2.gd','godot/assets/motion-r2/c2-motion-r2.glb','godot/scripts/native_enemy_r3.gd','godot/scripts/native_vfx_r3.gd','godot/assets/vfx-r3/qi-cleave-r3.glb','godot/scenes/main.tscn']
hash_table='\n'.join(f'| `{name}` | `{manifest["files"][name]}` |' for name in important)
case_table='\n'.join(f'| {r["distance"]:.1f} 米 | {"命中" if r["hit"] else "落空"} | {r["gap"]:.6f} 米 | {r["root_move"]:.6f} 米 | {r["beast_move"]:.1f} 米 |' for r in melee['cases'])
body=f'''# R3 独立验收最终报告

**当前结论：已测程序闭环通过；近战短踏进与R8视觉缺陷已复测关闭。不是全部游戏、美术或真人手感无条件验收。**

报告生成 UTC：{datetime.datetime.now(datetime.timezone.utc).isoformat()}。仅写本目录，未修改产品代码或生成图片。工作目录 `C:\\Users\\HUAWEI\\.codex\\worktrees\\3ff0\\star-abyss-game`。HEAD `{manifest['head']}` 仅作背景；大量未提交内容以文件SHA256识别。

最终带输入观测的完整长链：UTC **{combat['utc']}**，**{len(combat['rows'])} 个真实自动物理帧，{checks['passed']}/{checks['total']} 项程序断言通过**，源脚本及记录的GLB在运行期间无变化。随后Main/Ascension/VFX仅增补空招与真命中的视觉区分，UTC **{hitmiss['utc']}** 另做300帧完整场景定向，**{hitmiss['passed']}/{hitmiss['total']}**通过；不冒充两次全部文件SHA相同。未冻结玩家或敌人，未手动调用产品物理步进。输入为Godot事件注入，场景开始的传送/视角是测试夹具，不是人工操作。

**保留一个未归因异常：** 前一轮长链玩家曾在Y=3.52593停高且仍为flight，未记录C物理按下状态；不能宣布原因已修复。单点独立/开发复查和最终同产品SHA完整长链均能下降。最终长链逐帧确认Cdown=true、mouse_mode=2，玩家Y依次11.81359→6.25446→2.08320→-0.57660→地面-2.170263；1432帧flight=false/on_floor=true，1462帧敌人landing，1552帧ground。总控接受保留该异常，不猜改、不无限复跑。

## 当前证据入口

| 证据 | 结论及范围 |
|---|---|
| [combat-live.json](combat-live.json)、[combat-assertions.json](combat-assertions.json) | 当前完整长链、输入/支撑/碰撞状态、动作事件、真实伤害、掉落与存档重建；29/29仅代表所列断言 |
| [hit-miss-final.json](hit-miss-final.json)、[hit-miss-final-audit.json](hit-miss-final-audit.json) | 最后一次三文件小改的完整场景双案例：空招miss短消散无目标爆散/无伤害，真命中impact并扣28000；10/10 |
| [melee-final-audit.json](melee-final-audit.json)、[2.0米](melee-final-2.0.json)、[2.3米](melee-final-2.3.json)、[2.6米](melee-final-2.6.json) | 同一最终Player/Motion脚本/51骨GLB的三距离对照，3段均通过，含营地真实墙挡步 |
| [visual-final.json](visual-final.json)、[visual-final-summary.json](visual-final-summary.json) | 2140物理帧；最终人物支撑脚与五境界事件；只有后续R8外形变化由下行单招证据覆盖 |
| [cleave-final.json](cleave-final.json)、[最终R8截图](cleave-final-release.png) | 最终弯曲竖刃默认后视轮廓可见，脚本/最终GLB稳定；不再是几乎不可见细线 |
| [small-ui.json](small-ui.json)、[960×540 R9截图](final-small-ui.png) | 实际窗口及图像均960×540；最终场景SHA稳定={ui['scene_unchanged']}；HUD区域自动点击能到达攻击输入={ui['attack_input_through_hud']} |
| [FINAL-MANIFEST.json](FINAL-MANIFEST.json) | 当前产品逐文件SHA、每份证据SHA以及与当前版本差异；禁止拼成虚假的同仓版本 |

## 已测结果

### 接触、释放与战斗

最终三距离对照使用同一Player `917a50bd…`、motion脚本 `02f549b4…`、GLB `e0f5cb5d…`。三段物理delta均1/60，起手到接触约0.166667秒，接触前无受伤，敌兽在这段恰未移动（AI没有禁用）。

| 起手中心距离 | 结果 | 接触骨点到兽体 | 玩家实际踏进 | 兽移动 |
|---|---|---|---|---|
{case_table}

2.3米不是固定落空要求：总控决定按新可见前倾和真实0.18米踏进后的接触结算，2.6米用作落空对照。三段实际走近营地墙后再拳，出拳前后位置不变，中心到墙距0.45344米，没有靠穿墙完成踏进。

完整长链中的另一击，敌兽在起手后侧移，手点gap约0.345米，正确落空。这不能用“起手2米”强行要求命中。最终该断言校验命中与实际骨点接触相符；没有把未触及的拳改成命中。同批静止至接触的三距离对照仍独立保留。

- R4、R9起手→释放→命中各一次，蓄力时间符合契约；当帧手骨、Main权威源、VFX释放源一致。
- 最后hit/miss定向中，空招只发一次miss且impacted=false、敌人HP不变；真命中只发一次impact且missed=false，HP86400→58400。两招都正常自动物理运行，没有用假目标伤害充当命中。
- 普通兽先承受R4的28000伤害，后被R9击杀；H实际使库存0→1，F5保存后重建场景，库存、死亡和剩余掉落恢复；`enemy_r3`及`combat`字段存在。未测试非零冷却跨重开倒计时。
- 实际爪击伤害4200，格挡承伤1050；真实敌爪命中后R9蓄力取消，后续无该次释放/补伤害。
- 同一裂翼兽有ground→takeoff→air→landing→ground；空中shard实伤有记录。5米接近先lunge再claw，有实际命中，旧1.6秒必须爪击的手动步测试不适配新选距。
- sweep/dive存在预兆及释放事件；本轮不将它们每一招的特定命中位置全部标通过，也未完成格挡后玩家反制命中的独立专项。

### 移动、足部和特效

最终人物的正常物理实速walk/jog/sprint为1.5995/6.79994/9.99939米/秒。同脚支撑且锚点未变化的相邻样本分别99/39/33对，可见脚踝平面位移在记录精度内为0。**这是支撑脚踝证据，不是鞋底旋转完全不滑、复杂坡面不穿地或整段动画手感的证明。** 最终2140帧为35.667物理秒/37.097墙钟秒，包含PNG读取。

俯仰飞行、C/Shift+C和Space隔离在前述飞行切片有独立正常输入证据；该飞行采集Player为`2f790de5…`，后来只有近战短踏进等改动，不能把旧飞行JSON标成最终`917a50bd…`。当前最终长链另验证了飞行/真实受击/持续C/落地。这里不追加无变化系统的重复全套测试。

R4/R5/R6/R8/R9均有唯一start/release/impact，VFX版本为`r3-existing-reference`。独立默认第三人称截图确认R4手部气劲、R5/R6宽弧、R9裂纹可辨；R8最初宽轴朝侧，开发仅调整其面宽轴/弯曲后，最终单招截图可辨竖向新月刃。旧细线问题已关闭；不以开发截图替代这些独立取景。

960×540的最终R9两行操作提示完整显示，中文无明显裁切，HUD点击区域未阻断注入的主场景攻击。未测其它DPI、分辨率和真实桌面鼠标体验。

## 性能及未测边界

独立隐藏Intel UHD/OpenGL 1280×720窗口，最终长链稳定阶段渲染delta中位数/p95多为16.67ms；启动/首次流式加载阶段及PNG读取有约150ms峰值。完整原始render_rows保留，不能宣称全程60FPS或前台键鼠不卡顿。

未测或未无条件通过：真人键鼠手感、独立正常速度视频、完整鞋底旋转/侧向坡面接触、所有怪物技能逐招几何命中、格挡后反制命中、完整六公里巡航/全部调查及车辆回归、精细手指动作艺术质量。保存夹具检查与当前击杀拾取重开均通过，但不是浏览器完整剧情迁移验收。

## 复测和实际试玩步骤

从仓库根运行：

```cmd
py -3 godot\\reports\\r3-independent\\run_render_probe.py combat_live_probe.gd
py -3 godot\\reports\\r3-independent\\assert_combat.py
py -3 godot\\reports\\r3-independent\\run_render_probe.py melee_targeted_probe.gd
py -3 godot\\reports\\r3-independent\\run_render_probe.py melee_targeted_probe.gd --distance-2.3
py -3 godot\\reports\\r3-independent\\run_render_probe.py melee_targeted_probe.gd --distance-2.6
py -3 godot\\reports\\r3-independent\\final_melee_audit.py
```

真人试玩顺序：平地Ctrl+W/W/Shift+W看足底；Space跳跃、G升空后上下鼠标配W，再比较C/Shift+C；F2近兽、右键格挡再左键反制；F6切R4/5/6/8/9用R核对人体发力和手部源；击杀H拾取、F5重开核对库存/死亡；重点复查持续C是否再次停高，如有则保留输入捕获和碰撞状态。测试脚本不代替这些真人步骤。

## 当前版本SHA256

| 文件 | SHA256 |
|---|---|
{hash_table}

## 历史资料

[ACCEPTANCE.md](ACCEPTANCE.md)保留从初始计划到修复的过程。旧28/29、27/29、0d3db/b00d模型、R2回退和细线截图均是历史；不得用来宣称当前版本失败或当前版本通过。时间戳前缀原始JSON/log没有删除。最终manifest明确列出早期取景与当前Main、cleave的差异，相关功能由当前长链/最终R8/同人物批次证据分别覆盖。
'''
(here/'FINAL-REPORT.md').write_text(body,encoding='utf-8')
print('UI:',ui['scene_unchanged'],ui['attack_input_through_hud'],ui['image_size'])
print('FINAL-REPORT.md SHA256',hashlib.sha256((here/'FINAL-REPORT.md').read_bytes()).hexdigest())
