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
6. Right-click or press `Esc` to leave build mode.

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

## Combat HUD

1. Confirm the top-left HUD shows:
   - Base HP
   - Shield value
   - Day/Night phase
   - Wave number
   - Enemies alive
   - Build hint
2. During enemy waves, confirm enemy count changes.
3. When enemies reach base, confirm base HP decreases.
4. When enemies die, confirm resources increase from kill rewards.

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
