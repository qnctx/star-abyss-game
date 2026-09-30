# Ecology r4.2 — CPU and existing-image review, 2026-09-30

No Godot/GPU launched. This is an independent reading of owner evidence and existing images, not an independent runtime test. The owner's internal agent result is not this QA chat's runtime acceptance.

Correct latest internal-agent artifact: `ecology-damage-r4/independent-services-r42-contact-final.json`, summary **243 checks / failures []**. The similarly named `independent-services-r42-final.json` is the earlier **235** summary, with a different contact result; do not conflate them. Latest report records basal entry before stem entry and actual `trunk` contact, but explicitly skips renderer standing-MultiMesh disappearance verification. Its scope is environment service/physics, not whole-game visuals.

`visual-test-results.json` identifies `ecology-r4.2`, failures [], and branch_00 → stem_00 → trunk targets. It labels isolated assets and real physics, not whole-game acceptance. The final snapshot has two registered/modified entities and zero moving/dynamic fragments; these numbers are not dense-scene budget or habitat distribution evidence. Source/resource freeze belongs to `r42-frozen-core-hashes.json`, not older `frozen-resource-hashes.json`.

## Existing-image comparison

Viewed original concept sheets `docs/art/ecology-damage-r4/01-species-age.png` and `02-branch-root.png`, plus current owner captures `01-species-age-perspective.png`, `03-reference-row-0/1/2.png`, `05b-main-stem-subtree-falling.png` and `09-reloaded-same-camera.png`.

- Pine has a dominant upright trunk and tiered lateral branches; oak has broad, crooked forks; alder shows multiple ascending stems and a narrower upright crown. These inspected silhouettes show structural differences beyond uniform scale or recolor.
- Age rows vary crown/branch arrangement, but full concept fidelity is not established. Old pine remains comparatively straight with a few bare upper tips; it does not reproduce the concept's strongly twisted, broken old crown. Old oak remains substantially leafy rather than strongly hollow/dead as pictured. Alder stems converge onto a short common base, with less exposed multi-stem/root complexity than the reference.
- Foliage is visibly stippled/high-frequency in the supplied views. This static review cannot determine motion shimmer or final normal-camera readability. Pine branch layering is quite regular; leaf/needle/material detail and close-up joins still need final game views.
- The inspected stem-fracture image shows a reduced standing crown and a fallen leafy portion; the reload image shows fallen tree material and separated rock pieces. Still images alone cannot establish same-aim contact ordering, dynamic collision changes, full temporal fall quality or OS-process persistence.

Therefore: limited evidence of species structure differentiation, **no final art or integrated gameplay pass**. No claim that all original standing geometry is absent in every frame or all parts/colliders are correct follows from these selected images.

## Remaining gates

Keep E1–E6 in `ACCEPTANCE-PLAN.md`: actual skill destruction/collision updates, independent fresh-process reload, r4.1 compatibility or non-destructive rejection, and real three-habitat distribution/performance. Inspect same-scale near/LOD views and continuous destruction transitions in the allocated independent window. Preserve historical failed captures; no broad rerun is initiated here.

CPU reproduction: `py -3 godot/reports/systems-independent/audit_ecology_owner.py`; records latest report SHA256 and compares the frozen manifest and four reference-image hashes in `ECOLOGY-OWNER-CPU-AUDIT.json`. The manifest expanded from nine to eleven entries between the initial read and final check; final eleven entries and four references all match. Asset reference hashes establish identity, not visual quality or complete generated-resource stability.
