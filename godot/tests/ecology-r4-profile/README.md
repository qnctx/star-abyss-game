# Isolated ecology profiling (prepared, not yet run)

These subclasses call production super methods and add inclusive elapsed-time counters. They replace only the service inside the isolated test scene; Main and production code remain unchanged.

Run after the shared engine window is released:

D:/Python/python.exe godot/tests/native_environment_damage_capture.py native_environment_damage_integrated.gd forest conservative profile

Results go to godot/reports/ecology-damage-r4/habitat-forest/profile/. The original failing baseline is retained. Initial stream, the single damage call, and settling/rebuilding have separate counters. Nested timers must not be added together: mesh_load and part_shapes are included in materialize, clearance is included in fell_tree, and all are included in damage. Counters add instrumentation overhead.

The same forest location and attack selection are retained. Diagnostics capture exact state before clear, immediately after clear and after rebuild, plus target registration, pending/retry/cell status and active motion/debris counts. Performance budgets stay 320/260k.
