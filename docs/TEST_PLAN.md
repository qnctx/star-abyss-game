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

## Oxygen Plant

1. Explore away from the crash pod and look for small glowing cyan/green plants.
2. Drain some O2 below full.
3. Walk into an O2 Plant.
4. Confirm O2 increases by about `45`.
5. Confirm the plant disappears after refilling you.
6. Find another O2 Plant while already at full O2.
7. Walk into it and confirm it does not disappear until oxygen is below full.
8. Start a new run or reload the main scene and confirm O2 Plants are generated across the terrain.

## Build Mode

1. Press `B` to enter build mode.
2. Confirm a terrain-snapped preview appears in front of the player.
3. Preview colors:
   - Green: valid position and enough resources.
   - Yellow: valid position but missing resources.
   - Purple: valid position but selected building is still tech-locked.
   - Red: invalid position.
4. Press `1`; HUD should show `Turret`.
5. Press `2`; HUD should show `O2 Station`.
6. Press `3`; HUD should show `Shield Generator`.
7. Press `4`; HUD should show `Solar Panel`.
8. Press `5`; HUD should show `Research Station`.
9. Press `6`; HUD should show `Slow Field`.
10. Press `7`; HUD should show `Signal Beacon`.
11. Confirm the build HUD uses two rows and does not overlap the Base/Scanner/HUD rows.
12. Confirm locked buildings show `Y Unlock`, blueprint cost, and `Y READY` or `Y NEED BLUEPRINT`.
13. Confirm unlocked buildings show selected building cost, `LMB READY` or `LMB NEED RES`, and upgrade/repair target status.
14. Confirm the first row includes `Y Unlock` and `R Repair`.
15. Press `X`; HUD should enter recycle mode.
16. Press `X` again; HUD should return to build mode.
17. Right-click or press `Esc` to leave build mode.

## Building Recycle

1. Build any structure.
2. Press `B`, then `X`.
3. Move the preview near the built structure.
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
8. Keep at least `1 energy` available and wait about `6` seconds.
9. Confirm `energy` decreases by `1` and Signal progress increases by about `10`.
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
18. Survive until the Extraction timer reaches zero.
19. Confirm the Signal HUD shows `victory` and the Objective line changes to extraction complete.
20. Spend all energy and wait another cycle in a separate pre-100 test.
21. Confirm the Signal row changes to `needs energy` and progress does not increase.
22. Press `F6`, then later `F7`, and confirm Signal progress, latest Radio log, collected cache state, and Extraction holdout state are restored.

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
7. Confirm the objective text stays on one line and does not overlap the build/base/scanner HUD rows.

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

1. Confirm the top-left HUD shows a scanner line.
2. Press `G`.
3. Confirm the scanner cycles through `iron`, `biomass`, `crystal`, `core`, and `O2 plant`.
4. Walk toward the displayed direction.
5. Confirm the displayed distance generally decreases.
6. Pick up the targeted resource.
7. Confirm the scanner updates to another nearby resource/O2 Plant or says none is nearby.
8. Cycle to `O2 plant`.
9. Confirm the scanner points to a generated O2 Plant when one is within range.

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
