# Gait R5 independent reference review

## Developer runtime skin baseline received

Motion reports `gait-r5/evidence/baseline-skin.json` using Godot `MeshInstance3D.bake_mesh_from_current_skeleton_pose()` after `frame_post_draw`, 442 automatic physics frames / 66 samples. Reported minima: walk -3.99236 cm, jog -1.26517 cm, sprint -1.85664 cm, stop -1.07262 cm. Source inspection confirms a full baked vertex scan transformed by each mesh's global transform, compared with the actor-root flat plane. This is useful developer evidence that the API runs and reproduces the known problem; it is **not yet an independent replay or an actual terrain-collider clearance measurement**. GPU readback can stall rendering, so eventual depth sampling and normal-time visual playback must retain separate timing evidence. Independent delivery testing must resolve the real supporting surface/radial normal and record the lowest vertex, mesh and phase, rather than relabel actor-root Y as universal terrain clearance.

Status: both newly generated references inspected before reported product construction; **neither complete cycle sheet passes as drawn**. Generation batch is exhausted (2/2 reported); verification requests no additional generation and edits no product.

Files: `godot/assets/motion-r2/gait-r5/concept-walk-r5.png` and `concept-run-sprint-r5.png`. The actual pixels, not their titles, were reviewed.

## Walk

Contact poses 01/05 can inform heel-first extension and opposite arm/leg silhouette; the lower pose in 02/06 can inform cushioning. They still require consistent left/right identification in the final action. The purported passing poses 03/07 keep the legs separated and do not depict the swing leg passing under the pelvis as required. UP 04/08 largely repeat extended contact-like poses instead of a coherent rise/push-off stage. The HEEL detail has the heel lifted and forefoot down; its label contradicts the image. Do not use that detail as heel-strike geometry. Front/back silhouettes and local clothing proportions are useful references, not proof of a correct cycle.

## Run/sprint

RUN 01/02 and rear-heel detail provide useful local flexed-support/recovery cues. The later panels largely repeat silhouettes without a clearly drawn opposite-side cycle; changing the L/R text does not establish limb alternation. SPRINT 01–08 are near repetitions of a push-off pose, so they do not provide a valid complete support/flight/recovery/contact cycle. Local forward lean and bent trailing-knee shapes may inform design, but the full sequence cannot be copied or approved as timing evidence.

## Required mapping before 3D acceptance

Preserve both original references and prompts. Motion should document each retained panel/local detail, each rejected label/phase, and the corrected full left/right phase table before construction, then map it to Blender frames and exported action names. Correcting phase errors must be explicit; it must not be described as the generated full-cycle image having passed. If the remaining visual references cannot support the intended design, escalate that exact gap to the controller rather than silently generating more images or reverting to parameter-only tuning.

Final acceptance still requires actual normal-time Godot skin motion through full cycles and six start/stop transitions, comparison with the corrected design, and final deformed shoe vertices against runtime support. Prior authored walk minimum -4.02 cm remains a known unresolved issue; proxy ankle/sole-point checks cannot clear it. Naturalness is a visible continuous-motion judgment, not an angle or anchor threshold.
