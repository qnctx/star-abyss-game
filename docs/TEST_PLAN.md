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

## Build Mode

1. Press `B` to enter build mode.
2. Confirm a terrain-snapped preview appears in front of the player.
3. Preview colors:
   - Green: valid position and enough resources.
   - Yellow: valid position but missing resources.
   - Red: invalid position.
4. Press `1`; HUD should show `Turret`.
5. Press `2`; HUD should show `O2 Station`.
6. Press `3`; HUD should show `Shield Generator`.
7. Press `4`; HUD should show `Solar Panel`.
8. Press `5`; HUD should show `Research Station`.
9. Press `6`; HUD should show `Slow Field`.
10. Confirm the build HUD uses two rows and does not overlap the Base/Scanner HUD rows.
11. Confirm the second row shows selected building cost, `LMB READY` or `LMB NEED RES`, and upgrade target status.
12. Confirm the first row includes `R Repair`.
13. Press `X`; HUD should enter recycle mode.
14. Press `X` again; HUD should return to build mode.
15. Right-click or press `Esc` to leave build mode.

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
6. Collect at least `5 iron + 2 biomass`.
7. Press `R`.
8. Confirm the structure HP increases by about `35` and resources decrease.
9. If the structure is full HP, press `R` again and confirm resources are not consumed.

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

1. Collect at least `25 iron + 8 void_crystal + 1 energy_core`.
2. Press `B`, then `3`.
3. Confirm the HUD says `Shield Generator`.
4. Place the shield generator on green terrain.
5. Confirm resources decrease.
6. Confirm the Combat HUD shows shield value above `0`.
7. Press `N` to start night quickly.
8. Let an enemy reach the base.
9. Confirm shield decreases before Base HP decreases.
10. Wait near the base and confirm shield slowly recharges while the generator exists.

## Slow Field

1. Build at least one Solar Panel and collect `4 energy`.
2. Collect at least `15 iron + 8 biomass`.
3. Press `B`, then `6`.
4. Confirm the HUD says `Slow Field`.
5. Place the slow field on green terrain between enemy spawn direction and the base.
6. Press `N` to start night quickly.
7. Watch enemies crossing the blue field radius.
8. Confirm enemies inside the field move slower than enemies outside it.
9. Confirm enemies return to normal speed after leaving the field.

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
2. During enemy waves, confirm enemy count changes.
3. When enemies reach base, confirm base HP decreases.
4. When enemies die, confirm resources increase from kill rewards.

## Objective Tracker

1. Start a fresh run and confirm the objective line appears below the scanner line.
2. With no turret built, confirm it asks you to gather resources or build the first Turret.
3. Build a Turret and confirm the objective advances toward O2 Station, Solar Panel, Research Station, Slow Field, or turret upgrade depending on current progress/resources.
4. Press `N` to start night and confirm the objective changes to base defense while enemies are alive.
5. Let Base HP drop below full during daytime and confirm the objective asks for base repair or repair resources.
6. Confirm the objective text stays on one line and does not overlap the build/base/scanner HUD rows.

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

## Resource Scanner

1. Confirm the top-left HUD shows a scanner line.
2. Press `G`.
3. Confirm the scanner cycles through `iron`, `biomass`, `crystal`, and `core`.
4. Walk toward the displayed direction.
5. Confirm the displayed distance generally decreases.
6. Pick up the targeted resource.
7. Confirm the scanner updates to another nearby resource or says none is nearby.

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

## Known Headless Note

Godot 4.6.2 headless validation prints RID/resource cleanup warnings on exit. Current automated checks still return exit code `0`.
