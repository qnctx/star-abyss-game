# 星渊 · Godot 原生试玩

这是原版六公里月面游戏的 Godot 4.6 原生迁移工程，并正在把原盆地接入半径 120 公里的连续球体。浏览器正式版 `playable/` 与旧 Godot `src/` 均保留；当前 `godot/` 是可直接运行、可独立存档的原生试玩切片，尚不能替代浏览器版完整剧情。

## 打开和试玩

1. 在 Windows 双击仓库根目录的 `启动Godot试玩.cmd` 可直接运行；也可用 Godot 4.6.2 导入此目录的 `project.godot`，首次等待 GLB 资产导入完成，再在编辑器按 **F5** 运行主场景。工程采用 Compatibility 渲染器。
2. 鼠标控制朝向，**WASD** 行走，**Space** 跳跃，**G** 从地面起飞／在空中上升，**C** 下降，**Shift+W** 加速飞行，**Ctrl** 精细慢飞，**V** 切第一／第三人称。空格不会触发飞行；按 **Esc** 释放鼠标，左键重新捕获。
3. **F2** 跳到裂翼岭测试原精英裂翼兽和普通地面裂脊兽；两兽已死亡时按 **F3** 重置试玩对手，重置后的对手不会再次产出掉落。近身**左键**依次左拳、右拳、上挑腿，按住**右键**格挡并观察扣血与击飞；**R** 在地面或空中施放当前境界武技，准星需朝向怪物。R4 拳劲、R5 掌波、R6/R7 横扫、R8 下劈、R9 压掌均从当前手部骨点起手，短行程结束后结算命中。死亡后在营地复活，首次击杀后靠近尸体按 **H** 拾取。
4. 测高级能力时按 **F6** 临时轮换 R4–R9 试玩境界。R6 起 **Q** 短瞬移、**Alt+Q** 远瞬移；R8 按 **R** 使用破虚裂隙。瞬移有实际距离、灵息、冷却和沿途碰撞检查。F6 是试玩开关，正式进阶规则仍在迁移中。
5. 营地的指挥站、医疗站、工坊沿用原位真实 GLB；可从门洞进入，台阶和地板由模型三角面支撑。勘探车停在原版 `(72,80)`，靠近按 **F** 上车，WASD 驾驶、Shift 加速，停稳后 F 下车；车体物理碰撞会挡在真实建筑墙前。HUD 指向最近未记录地标，靠近坐标按 **E** 记录；按 **F5** 手动保存，平时也定时保存。

## 现有范围

原版 6×6 公里盆地以 160 米块流式渲染与物理碰撞，地形高度沿用网页 10 米网格和插值；盆地外及高空接入同一星球的六面球体网格，近地形加载对应三角碰撞。紫色星空从原网页程序天空烘焙为可复现的 Godot 全景图；玄武岩地表、C2 角色、裂翼巡猎兽、勘探滑翔车及三栋营地建筑均使用已有资产。主场景只渲染一套 C2 19 骨角色，包含四向地面步态、慢跑／冲刺、悬停、加速前倾、拳脚、格挡、受击和 R4–R9 境界武技；攻击在动作释放或接触时结算。精英裂翼兽及普通地面裂脊兽使用既有概念图派生的 R3 动作 GLB，分别具备独立生命、感知、攻击和掉落；原 R11 GLB 仍保留。R4/R5 的拳掌劲沿准星短行程飞行，R6/R7、R8、R9 分别为横扫、下劈和压掌；原有 R6–R9 瞬移门保留。特效只负责画面，伤害、范围、遮挡、灵息与冷却规则由物理战斗代码决定。

球体接线保留旧盆地、营地、地标、载具和兽岭原位。旧盆地外由同一星球高度场生成六面全球网格和近场真实三角碰撞；主场景载具按径向地面行驶、停车后找安全落脚点，F2/F3 会等待竞技场碰撞加载。HUD 用径向离地高度和球面地标方向，远距按公里显示。当前独立取帧显示 17 公里森林缺少可见植被、34 公里海岸受紫雾遮盖，轨道陆海不易辨认；这些视觉问题仍在修正，不能把已通过的碰撞与存档测试当作画面验收。

原生档写在 Godot `user://star_abyss_native_v1.json`。它与浏览器的 localStorage/IndexedDB 存档分离，迁移工程不会覆盖原浏览器档。新增普通怪及武技冷却分别写在可选的 `enemy_r3`、`combat` 字段；`combat` 同时记录 F3 试玩重置的禁掉落标记，重开后也不能重复刷取。旧档缺字段时按家园点生成普通怪并从零冷却开始；旧玩家、精英怪、载具、调查和羽片字段沿用。原版坠舰内部、实体调查装置及完整两章故事门槛、地图／日志／远野／完整进阶和其他星球仍在迁移清单上；目前 E 键只记录已到达的调查地点，不能把它视为网页完整解谜的等价实现。当前也没有把浏览器存档自动转换为原生档的可靠工具。

球体原生档在上述根字段外附加 `planet`：星球身份、半径、双精度球心坐标、角色方向/速度、载具坐标/方向。无 `planet` 的旧原生档按原盆地坐标迁移；背面及近极点重载使用实际星球坐标，根 `player` 仅留旧版本可识别的安全盆地位置。地形/碰撞未就绪时延迟恢复，失败则保护原档并停止自动覆盖。接口与边界详见 [原生球体契约](docs/PLANET-NATIVE-CONTRACT.md)。

旧原生版本曾把角色、车和裂翼兽都保存到零点，导致重开后挤在车体里无法移动。新版识别该旧档时先保留 `.before-position-repair.bak`，再恢复三者各自的出生位置，保留境界、生命、物品和调查；普通碰撞重叠也会尝试附近安全落脚点。下车会检查左右及前后四处位置，全部被挡时留在车内。存档只在场景有效时、定时／F5／关闭窗口前写入，不再在场景卸载阶段读取全局坐标。

验证步骤：重开旧档后点击游戏画面并按 WASD，角色应能离开营地；靠近车按 F 上车、停车后 F 下车，应出现在车旁而非车体内。按 Esc 后会显示“点击游戏画面恢复控制”。F5 保存、关闭并重开后，应保持最后的安全位置。自动回归可用下方命令的同一引擎运行 `--headless --path godot --script res://tests/native_recovery_verify.gd`；它使用独立测试档，覆盖位置恢复、进度保留、真实步行、下车受阻与重开存档。

球体接线验证：运行下方三个 `native_planet_*_verify.gd` 独立档测试，检查旧档迁移、F2/F3、背面/近极点重载、原盆地外载具、R9 路径预加载及远野地面 R6 瞬移。远距位置、车速和瞬移施法状态由测试受控注入，仍需实际键鼠从盆地飞往远野、返回并目视确认森林、海岸、海洋和整球画面；测试不能替代手感与视觉验收。

## 开发验证

在仓库根目录执行以下 Godot 命令；若 Godot 不在所列路径，换成你安装的 `Godot...console.exe`。测试使用独立 `user://` 档位，不改默认原生档：

```cmd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_verify.gd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_blink_verify.gd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_air_cast_verify.gd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_vehicle_verify.gd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_recovery_verify.gd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_mobility_verify.gd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_mobility_independent_verify.gd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_r2_main_independent_verify.gd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_combat_flow_verify.gd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_r3_skill_verify.gd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_planet_main_verify.gd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_planet_vehicle_verify.gd
D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe --headless --path godot --script res://tests/native_planet_blink_verify.gd
py -3 godot\tests\capture_native_r2_main.py
```

最后一条在 Windows 隐藏 OpenGL 测试窗口，使用独立档位，并把主场景的移动、拳脚、格挡、R4/R6/R8/R9 施法和近兽镜头画面写入 `godot/reports/r2-main/`；不会切走正在试玩的窗口。R3 战斗接口和地空试玩步骤见 [战斗契约](docs/r3-combat-contract.md)。R3 敌人动作与武技特效均由已生成的概念图派生，未新增付费参考图；新 GLB 已在 Godot 导入并取帧，实际键鼠手感仍须另行试玩验收。模块与取证见 [世界](docs/WORLD.md)、[角色](docs/PLAYER.md)、[营地](docs/CAMP.md)、[独立验收](reports/INDEPENDENT-VERIFICATION.md)。对 `native_verify.gd` 的命令去掉 `--headless`，加上 `--rendering-driver opengl3 --disable-vsync --resolution 1280x720` 与末尾的 `-- --perf`，可在真实窗口短时采样营地静立和高空悬停；长时间飞行、战斗帧时间与输入手感仍须在实际试玩中检查。


桌面快捷方式：`星渊 Godot 试玩`，指向本工作树根目录的 `启动Godot试玩.cmd`。双击即可启动当前 Godot 版本；原脚本使用相对项目路径，保留在工作树内，通过桌面快捷方式打开。
