# Star Abyss Manual Test Plan

Use this checklist for the next hands-on playtest in Godot 4.6.2.

## Launch

1. Open `src/project.godot` in Godot.
2. Press `F5`.
3. Confirm the main scene loads without script errors.

## Movement

1. Walk with `W/A/S/D`.
2. Hold `Shift + W`; movement should continue and feel faster.
3. Press `Space`, land, then confirm movement still works.
4. Hold `Ctrl`; camera should lower and movement should slow.
5. Hold `Z`; camera should lower further and movement should slow more.
6. Walk over uneven terrain and slopes; the camera should follow terrain height.
7. Walk around rocks and zone entrances; if a collision edge catches the player, movement should recover.

## Death Drop

1. Collect several resource types, preferably including `iron`, `energy`, and `blueprint`.
2. Move away from base and let O2 reach zero.
3. Confirm the player dies, then respawns after the normal delay.
4. Confirm about half of carried resources are removed from inventory.
5. Confirm the HUD shows a `Drop:` direction/distance recovery hint.
6. Confirm the Objective line asks to recover dropped resources when there is no more urgent defense/repair objective.
7. Follow the `Drop:` hint to the orange crate.
8. Walk into the crate.
9. Confirm dropped resources return to inventory and the crate disappears.
10. Repeat death before collecting the previous drop.
11. Confirm the new death drop merges with the previous lost resources rather than leaving multiple confusing packs.
12. Press `F6`, then `F7`, and confirm an active death drop remains recoverable after load.

## Oxygen Canister

1. Collect at least `2 biomass + 1 energy`.
2. Confirm the HUD shows an `O2 Kit:` line with `H craft READY`.
3. Press `H`.
4. Confirm biomass decreases by `2`, energy decreases by `1`, and O2 Kit count increases by `1`.
5. Drain some oxygen by exploring away from base.
6. Press `Q`.
7. Confirm O2 increases by about `60` without exceeding max O2.
8. Confirm O2 Kit count decreases by `1`.
9. Try pressing `Q` while oxygen is already full.
10. Confirm no O2 Kit is consumed.
11. Save/load with at least one O2 Kit and confirm the count is restored.
12. Die while carrying O2 Kits and confirm they can be included in the recoverable Death Drop payload.

## Game Over Restart

1. Build at least one structure and start night with `N`.
2. Let enemies remain alive, then drain O2 to trigger the death panel.
3. Click `重新开始`.
4. Confirm the run returns to daytime, enemies are cleared, built structures are removed, Base HP is full, shield is reset, inventory is empty, and the player has full O2.
5. Repeat after the base is destroyed and confirm the game unpauses after restart.

## Oxygen Plant

1. Explore away from the crash pod and look for glowing cyan/green plants with an `O2` label.
2. Drain some O2 below full.
3. Walk into an O2 Plant.
4. Confirm O2 increases by about `45`.
5. Confirm the plant disappears after refilling you.
6. Find another O2 Plant while already at full O2.
7. Walk into it and confirm it does not disappear until oxygen is below full.
8. Start a new run or reload the main scene and confirm O2 Plants are generated across the terrain.

## Build Mode

1. Press `4` to select the Build tool, or press `B` to enter build mode directly.
2. Confirm the center crosshair remains visible and the build preview follows the terrain point under the crosshair.
3. Move the mouse while build mode is open:
   - Mouse left/right turns the view.
   - Mouse up/down pitches the view so you can aim at ground, slopes, or sky.
   - The preview should stay snapped to the terrain point under the crosshair.
4. Aim into the sky and confirm placement stays invalid instead of sticking to a flat invisible plane.
5. Preview colors:
   - Green: valid position and enough resources.
   - Yellow: valid position but missing resources.
   - Purple: valid position but selected building is still tech-locked.
   - Red: invalid position.
6. Press `Tab`; HUD should cycle to the next building type.
7. Press `Shift+1`; HUD should show `Turret`.
8. Press `Shift+2`; HUD should show `O2 Station`.
9. Press `Shift+3`; HUD should show `Shield Generator`.
10. Press `Shift+4`; HUD should show `Solar Panel`.
11. Press `Shift+5`; HUD should show `Research Station`.
12. Press `Shift+6`; HUD should show `Slow Field`.
13. Press `Shift+7`; HUD should show `Signal Beacon`.
14. Confirm ordinary `1-5` still switch tools; for example, press `2` and confirm Build mode exits and Harvester is selected.
15. Confirm the build HUD uses two rows and does not overlap the Base/Scanner/HUD rows.
16. Confirm locked buildings show `Y Unlock`, blueprint cost, and `Y READY` or `Y NEED BLUEPRINT`.
17. Confirm unlocked buildings show selected building cost, `LMB READY` or `LMB NEED RES`, and upgrade/repair target status.
18. If HUD says `LMB NEED RES`, confirm Inventory is missing the listed cost; this is resource shortage, not an invalid location.
19. Press `X`; HUD should enter recycle mode.
20. Put the crosshair on a built structure and confirm the preview turns blue and the HUD shows refund text.
21. Press `X` again; HUD should return to build mode.
22. Right-click or press `Esc` to leave build mode.

## Toolbelt And Buried Harvest

1. Confirm the bottom HUD shows `Tools:` with slots `1 Weapon`, `2 Harvester`, `3 Scanner`, `4 Build`, and `5 Repair`.
2. Press `1`; confirm the Weapon slot is highlighted and left-click can fire.
3. Press `3`; confirm Scanner is highlighted and left-click no longer fires the weapon.
4. Press `G` until the scanner targets `iron` or `crystal`.
5. Follow the scanner direction until it reports a `buried ... depth ...` signal.
6. Confirm a colored `DIG ... 0/N` marker appears on the ground when the buried resource is revealed.
7. Press `2`; confirm Harvester is highlighted.
8. Put the crosshair on the revealed marker and left-click until the `DIG` progress completes.
9. Confirm the marker disappears and the left-side `Inventory:` count increases.
10. Aim the Harvester at a visible labeled resource and left-click; confirm it can collect the visible resource without walking into it.
11. Press `4`; confirm build mode opens, then press `2` and confirm it exits build mode and selects Harvester.
12. Press `Esc` or right-click to leave build mode, then press `1` to return to Weapon.
13. Press `5`; if a built structure is damaged, put the crosshair on it and left-click to repair.

## Building Recycle

1. Build any structure.
2. Press `B`, then `X`.
3. Put the crosshair on the built structure.
4. Confirm the preview turns blue when a recyclable structure is targeted.
5. Confirm the HUD shows the targeted structure label and expected refund.
6. Left-click.
7. Confirm the structure disappears.
8. Confirm about half of its original resource cost is refunded.
9. Press `X` again to return to normal build mode.

## Turret Upgrade

1. Build at least one turret.
2. Generate at least `5 energy` from Solar Panels.
3. Generate at least `1 blueprint` from a Research Station.
4. Collect at least `10 iron`.
5. Press `B`.
6. Move the preview near the turret.
7. Confirm the HUD shows `Up Turret Lv 0/3` and `READY`.
8. Press `U`.
9. Confirm `10 iron + 5 energy + 1 blueprint` are consumed.
10. Confirm the turret becomes slightly larger.
11. Upgrade the same turret to level `3`.
12. Confirm the HUD shows `MAX` when the turret cannot be upgraded further.
13. During night, confirm the upgraded turret fires faster or kills enemies faster.

## Building Repair

1. Build at least one structure near the base.
2. Press `N` to start night quickly.
3. Let one enemy reach the base while the base shield is empty or depleted.
4. Press `B` and move the preview near the damaged structure.
5. Confirm the HUD shows `Repair <structure> HP current/max`.
6. Confirm the Base HUD row shows a short damaged-structure summary such as `Struct Turret 40/100 | B+R READY`.
7. Collect at least `5 iron + 2 biomass`.
8. Press `R`.
9. Confirm the structure HP increases by about `35` and resources decrease.
10. If the structure is full HP, press `R` again and confirm resources are not consumed.

## Enemy Structure Targeting

1. Build a Turret or Slow Field between the enemy approach direction and the base.
2. Press `N` to start night quickly.
3. Let at least one enemy reach the built structure before reaching the base.
4. Confirm the enemy stops or slows near the structure instead of sliding forever against it.
5. Confirm the structure can lose HP from repeated enemy attacks.
6. Press `B` and aim the preview near the damaged structure.
7. Confirm the repair HUD shows the damaged structure HP.
8. Confirm the Objective line changes to structure repair during daytime once the base is safe.
9. If the structure is destroyed, confirm it disappears and enemies continue toward the base.
10. Confirm enemies that destroy structures do not grant kill rewards unless killed by the player/turrets.

## Turret Placement

1. Collect at least `20 iron + 5 void_crystal`.
2. Press `B`, then `1`.
3. Place a turret on green terrain with left click.
4. Confirm resources decrease.
5. Confirm the turret stays in world and fires at enemies during night.

## O2 Station

1. Collect at least `15 iron + 10 biomass`.
2. Press `B`, then `2`.
3. Place an O2 Station on green terrain.
4. Walk away and let oxygen drain.
5. Return near the O2 Station.
6. Confirm O2 refills while inside its radius.

## Shield Generator

1. Generate at least `1 blueprint` from a Research Station.
2. Press `B`, then `3`.
3. Confirm the HUD says `Shield Generator locked | Unlock 1 blueprint | Y READY`.
4. Press `Y`.
5. Confirm `blueprint` decreases by `1` and the selected Shield Generator no longer shows locked.
6. Collect at least `25 iron + 8 void_crystal + 1 energy_core`.
7. Place the shield generator on green terrain.
8. Confirm build resources decrease.
9. Confirm the Combat HUD shows shield value above `0`.
10. Press `N` to start night quickly.
11. Let an enemy reach the base.
12. Confirm shield decreases before Base HP decreases.
13. Wait near the base and confirm shield slowly recharges while the generator exists.

## Slow Field

1. Generate at least `2 blueprint` from a Research Station.
2. Build at least one Solar Panel and collect `4 energy`.
3. Press `B`, then `6`.
4. Confirm the HUD says `Slow Field locked | Unlock 2 blueprint | Y READY`.
5. Press `Y`.
6. Confirm `blueprint` decreases by `2` and the selected Slow Field no longer shows locked.
7. Collect at least `15 iron + 8 biomass`.
8. Place the slow field on green terrain between enemy spawn direction and the base.
9. Press `N` to start night quickly.
10. Watch enemies crossing the blue field radius.
11. Confirm enemies inside the field move slower than enemies outside it.
12. Confirm enemies return to normal speed after leaving the field.

## Solar Panel

1. Collect at least `18 iron + 6 biomass`.
2. Press `B`, then `4`.
3. Confirm the HUD says `Solar Panel`.
4. Place the solar panel on green terrain.
5. Confirm resources decrease.
6. During daytime, wait about `5` seconds.
7. Confirm the Resource HUD shows `energy` increasing.
8. Press `N` to start night.
9. Confirm `energy` stops increasing during night.

## Research Station

1. Build at least one Solar Panel and wait until you have `5 energy`.
2. Collect at least `20 iron + 5 void_crystal`.
3. Press `B`, then `5`.
4. Confirm the HUD says `Research Station`.
5. Place the research station on green terrain.
6. Confirm resources decrease.
7. Wait about `20` seconds while you still have at least `5 energy`.
8. Confirm `energy` decreases by `5`.
9. Confirm `blueprint` increases by `1`.
10. If energy is below `5`, confirm blueprints stop increasing.

## Signal Beacon

1. Build at least one Solar Panel and Research Station.
2. Collect at least `30 iron + 10 void_crystal + 10 energy + 2 blueprint`.
3. Press `B`, then `7`.
4. Confirm the HUD says `Signal Beacon` and shows the full cost.
5. Place the Signal Beacon on green terrain.
6. Confirm build resources decrease.
7. Confirm the top-left HUD shows a `Signal:` row.
8. Keep at least `1 energy` available and wait about `12` seconds.
9. Confirm `energy` decreases by `1` and Signal progress increases by about `5`.
10. Continue powering until progress crosses `25`.
11. Confirm a Radio log line appears under the Signal/Save HUD rows.
12. Confirm the HUD also shows a `Cache:` direction/distance hint.
13. Follow the cache hint until you reach the Signal Cache.
14. Walk into the cache and confirm resources are added.
15. Confirm the cache disappears and the Objective no longer asks for that same cache.
16. Continue powering through `50`, `75`, and `100` if resources allow; confirm the latest Radio log changes and new caches can appear at each milestone.
17. When Signal reaches `100/100`, confirm the run enters an Extraction holdout:
   - The Signal HUD shows `Extraction: hold mm:ss`.
   - The Objective line asks you to defend the extraction zone.
   - If it was daytime, the game starts a night attack.
18. Survive until the Extraction timer reaches zero (180s).
19. Confirm the Signal HUD shows `victory` and the Objective line changes to extraction complete.
20. Spend all energy and wait another cycle in a separate pre-100 test.
21. Confirm the Signal row changes to `needs energy` and progress does not increase.
22. Press `F6`, then later `F7`, and confirm Signal progress, latest Radio log, collected cache state, and Extraction holdout state are restored.
23. **P0 验证**：在信号进度达到 50% 时存档，读档后确认 energy 不会在一帧内被多次扣除（读档后信号台有 1 秒启动延迟）。
24. **P0 验证**：在撤离坚守剩余时间归零时存档，读档后确认不会立即显示 victory，而是等一帧 _process 处理后才完成。
25. **P0 验证**：在撤离坚守剩余 60 秒时存档，读档后确认剩余时间正确恢复且撤离仍处于 active 状态。
26. **P2 验证**：走到东侧熔岩区（x>20），HUD 底部应显示 `熔岩区 | 氧耗 x3.5 | 适应 Lv0 | 建议 Lv2+`。
27. **P2 验证**：在熔岩区内建造一座 Turret，等待数秒后确认该 Turret 的 HP 缓慢下降（0.1 HP/s），HUD 出现 `Struct Turret .../100` 损耗提示。
28. **P2 验证**：回到坠毁区（基地附近），确认基地附近的建筑 HP 不受熔岩区损耗影响。
29. **P2 验证**：调制熔岩适应 Lv2 血清后，再次进入熔岩区，确认结构损耗停止（适应等级达标后 `get_structure_drain_rate` 返回 0）。
30. **P2 验证**：进入极寒区（z>20）确认 HUD 显示 `极寒区 | 氧耗 x3.0 | 适应 Lv0 | 建议 Lv2+`，且氧气消耗明显加快。
31. **P2 验证**：进入重力异常区（z<-20）确认移动速度下降到 0.7x，HUD 显示 `重力异常区 | 适应 Lv0 | 建议 Lv2+`。
32. **P3 验证**：白天在基地半径内（距坠毁点 <10m）且 energy≥5 时，HUD 应显示 `T 传送 5 energy`。
33. **P3 验证**：收集至少 5 energy，站在基地半径内，按 `T`，确认玩家被传送到已注册区域入口（极寒区/熔岩区/重力异常区之一），energy 减少 5。
34. **P3 验证**：夜晚按 `T`，确认玩家不移动、energy 不消耗，HUD 显示 `T 传送（仅白天可用）`。
35. **P3 验证**：白天走到远离基地 10m 以外（例如 x=30），按 `T`，确认玩家不移动、energy 不消耗，HUD 显示 `T 传送（需在基地半径内）`。
36. **P3 验证**：白天在基地半径内但 energy<5 时，按 `T`，确认玩家不移动、energy 不消耗，HUD 显示 `T 传送（需 5 energy）`。
37. **P3 验证**：按 `F6` 存档后按 `F7` 读档，确认区域入口 beacon 仍注册在 TeleportManager 中（按 `T` 仍可传送）。
38. **P4 验证（图纸分布）**：开局在基地半径 10m 内走一圈，确认最多只捡到 1 个教学 blueprint 芯片（不再"一堆图纸"）。
39. **P4 验证（图纸分布）**：走出基地 18m+ 后，确认不同方向散布着其余 4 个教学 blueprint 芯片。
40. **P4 验证（Tab 切建筑诊断）**：捡若干资源后按 `B` 进建造模式，连续按 `Tab` 切换建筑，确认资源数量不变；若资源异常减少，控制台会输出 `[BuildManager] Tab 切换异常消耗资源！` 警告日志。
41. **P4 验证（重量系统）**：HUD 库存行末尾应显示 `负重 X.X/25kg`，未超重时无额外标记。
42. **P4 验证（重量-速度）**：收集超过 25kg 资源（如 60 iron = 30kg），HUD 显示 `负重 30.0/25kg !超重!`，移动速度明显下降到约 0.9x。
43. **P4 验证（重量-氧耗）**：超重状态下，氧气消耗速度加快到约 1.1x（60 iron）或 1.5x（100 iron）。
44. **P4 验证（重量软惩罚）**：超重不会阻止拾取，只会减速 + 加速耗氧；丢弃/消耗资源使负重回到 25kg 内后，速度和氧耗恢复正常。

## Tech Unlocks

1. Start a fresh run and enter build mode.
2. Select `3` Shield Generator and confirm it is locked before spending blueprint.
3. Try left-clicking on valid terrain while locked and confirm no Shield Generator is placed.
4. Without blueprint, press `Y` and confirm nothing unlocks or consumes resources.
5. Generate `1 blueprint`, select `3`, press `Y`, and confirm Shield Generator unlocks.
6. Select `6` Slow Field and confirm it still requires `2 blueprint`.
7. Generate `2 blueprint`, press `Y`, and confirm Slow Field unlocks.
8. Confirm unlocked Shield Generator and Slow Field remain buildable while switching selections during the same run.

## Combat HUD

1. Confirm the top-left HUD shows:
   - Base HP
   - Shield value
   - Day/Night phase
   - Wave number
   - Enemies alive
   - Build hint
   - Resource scanner hint
   - Day/night countdown
   - Wave direction
   - Wave variant label
   - Objective line
   - Signal Beacon status after building one
   - Latest Radio log after signal milestones
   - Signal Cache direction/distance while a cache is active
   - Extraction holdout countdown after Signal reaches `100/100`
   - Locked-tech/unlock status while build mode is open
   - Damaged-structure summary when built structures are below full HP
   - Zone pressure line: `极寒区 | 氧耗 x3.0 | 适应 Lv0 | 建议 Lv2+` (shows current zone, oxygen multiplier, adaptation level, recommended level)
   - `F6 Save F7 Load` in the main build hint row
2. During enemy waves, confirm enemy count changes.
3. When enemies reach base, confirm base HP decreases.
4. When enemies die, confirm resources increase from kill rewards.
5. Let one enemy reach the base and confirm no kill reward is granted for that breached enemy.

## Objective Tracker

1. Start a fresh run and confirm the objective line appears below the scanner line.
2. With no turret built, confirm it asks you to gather resources or build the first Turret.
3. Build a Turret and confirm the objective advances toward O2 Station, Solar Panel, Research Station, tech unlocks, Shield Generator, Slow Field, turret upgrade, Signal Beacon, signal power, or active Signal Cache recovery depending on current progress/resources.
4. Press `N` to start night and confirm the objective changes to base defense while enemies are alive.
5. Let Base HP drop below full during daytime and confirm the objective asks for base repair or repair resources.
6. Damage a built structure while Base HP is full and confirm the objective asks to repair damaged structures or gather `5 iron + 2 biomass`.
7. Let O2 fall to 25% or lower while carrying at least one O2 Kit and confirm the objective says `Use O2 Kit (Q)`.
8. Repeat with no O2 Kit but at least `2 biomass + 1 energy` and confirm it says `Craft O2 Kit (H)`.
9. Repeat with no kit and not enough craft resources and confirm it says `Find O2 Plant or return to base`.
10. Confirm the objective text stays on one line and does not overlap the build/base/scanner HUD rows.

## Wave Warning

1. During daytime, confirm the Combat HUD shows `Next night mm:ss`.
2. Press `N` to start night quickly.
3. Confirm the Combat HUD changes to `Night ends mm:ss`.
4. Wait for the first enemy to spawn.
5. Confirm the Combat HUD shows `From N/S/E/W` or a diagonal direction.
6. Compare the direction with where enemies are approaching from.
7. Confirm the countdown keeps decreasing while playing.

## Wave Variants

1. Press `N` to start night quickly.
2. Fight through waves and watch the Combat HUD variant label next to the wave number.
3. Confirm wave `3` shows `Scout`; the highlighted enemy is smaller, cyan, and faster.
4. Confirm wave `4` shows `Tank`; the highlighted enemy is larger, gold, slower, and harder to kill.
5. Confirm wave `5` shows `Elite`; the highlighted enemy is purple and stronger than normal.
6. Confirm wave `10` shows `Boss`; the highlighted enemy is red, larger/stronger, and visually distinct.
7. Confirm normal waves still show `Normal` and use the regular dark red enemy look.
8. Kill variant enemies and confirm they grant extra rewards beyond normal random drops.

## Resource Scanner

1. Press `3` to equip Scanner.
2. Confirm the top-left scanner line becomes active.
3. Press `G`.
4. Confirm the scanner cycles through `iron`, `biomass`, `crystal`, `core`, `O2 plant`, and `BP`.
5. For resource modes, follow the displayed direction.
6. If the hint says `buried`, confirm it includes depth, distance, and direction.
7. Confirm the nearest buried resource becomes visible as a `DIG ...` marker.
8. Press `2` and dig the revealed marker with left-click; confirm the `Inventory:` count increases when it completes.
9. If the scanner points to a visible resource instead, walk into it to auto-pick it up; no key press is needed.
10. Confirm nearby visible resources have readable floating labels and distinct shapes:
    - `IRON`: orange ore/rock cluster.
    - `CRYSTAL`: purple crystal cluster.
    - `BIO`: green spore/pod cluster.
    - `CORE`: cyan glowing energy core.
    - `BP`: flat gold data chip with a taller gold beacon.
11. Cycle to `O2 plant`.
12. Confirm the scanner points to a generated O2 Plant with an `O2` label when one is within range.
13. Confirm early visible resources and buried markers are on ground level without needing to jump.
14. When a buried resource is revealed, confirm the `DIG` marker includes a small resource-shaped icon, not only a flat circle.
15. Look for the 5 visible `BP` data chips around the crash basin and confirm walking into one increases `BP` in Inventory.

## Base Repair And Wave Shortcut

1. During daytime, confirm the top-left HUD includes `N start night test`.
2. Press `N`.
3. Confirm the phase changes to `Night` and enemies begin spawning without waiting for the full day timer.
4. Let one or more enemies reach the base.
5. Confirm Base HP decreases.
6. Collect at least `10 iron + 5 biomass`.
7. Walk near the base pod.
8. Confirm the HUD shows the base repair hint.
9. Press `E`.
10. Confirm Base HP increases by about `25` and resources decrease.
11. When Base HP is already full, press `E` near the base again and confirm resources are not consumed.

## Save And Load MVP

1. During daytime, collect several resources.
2. Build at least one Turret and one utility structure if possible.
3. Unlock Shield Generator or Slow Field if you have enough `blueprint`.
4. Damage or upgrade one built structure if possible.
5. Press `F6`.
6. Confirm the game does not pause or crash.
7. Confirm the top-left HUD briefly shows `Save: Saved`.
8. Spend or collect some resources after saving.
9. Recycle or damage a structure after saving.
10. Press `F7`.
11. Confirm the top-left HUD briefly shows `Save: Loaded`.
12. Confirm inventory returns to the saved amounts.
13. Confirm tech unlocks return to the saved state.
14. Confirm saved structures reappear with position, HP, upgrade level, and Signal Beacon progress if one was built.
15. Confirm unlocked Radio logs, collected Signal Cache state, and the latest Radio log message are restored.
16. Confirm Base HP, shield values, wave number, and phase timer return close to the saved state.
17. During night, save while at least one enemy is alive.
18. Press `F7` and confirm the enemy reappears with the same rough position, health state, and variant label.
19. Confirm the Combat HUD enemy count matches the restored enemies.
20. Optional: delete or rename the save file, press `F7`, and confirm the HUD briefly shows `Save: No save file`.

## Known Headless Note

Godot 4.6.2 headless validation prints RID/resource cleanup warnings on exit. Current automated checks still return exit code `0`.
