# Gait R5 — new image-first concept audit

Batch: exactly two built-in imagegen calls, newly generated 2026-09-27. No paid 3D and no third generation. Source identity input: `../reference.png`, used only for C2 costume/identity. Product GLB/driver were unchanged during generation and this audit.

1. `concept-walk-r5.png` from `exec-6b2d1281-d20f-4f51-950e-5537cf357760.png`; exact prompt `prompt-walk.txt`.
2. `concept-run-sprint-r5.png` from `exec-37d6b1d0-3c82-4d8a-bfe9-57b250d293c1.png`; exact prompt `prompt-run-sprint.txt`.

## Image audit before production

| Image/region | Usable visual intent | Fault / production restriction |
| --- | --- | --- |
| Walk 01/05 contact | C2 identity, modest forward body, front heel contact, rear toe, relaxed opposite arms | Left/right labels cannot be trusted across the sheet |
| Walk 02/06 down | Soft supporting knee, flat loading boot, raised rear heel | Use as isolated weight-acceptance pose, not the printed sequence |
| Walk 03/07 pass | Upright support silhouette | Swing foot remains behind rather than passing the supporting ankle: reject as passing target |
| Walk 04/08 up | Low advancing shoe silhouette | Near duplicate contact, missing clear heel-rise/forward-passing phase: reject as full up pose |
| Walk front/back | Character silhouette and alignment | Does not define continuous leg alternation |
| Walk HEEL closeup | Boot identity only | Forefoot touches line with raised heel, contrary to label: reject foot contact geometry |
| Walk FLAT / TOE closeups | Flat sole / ankle rise over forefoot | Use only these corresponding contact types |
| Walk dotted paths | Small pelvis movement and behind-body heel recovery | Schematic, not measured joint trajectory |
| Run 1/2 | Bent-knee landing/loading, rear folded heel | Supporting leg identity must be explicitly assigned in authored keys |
| Run 3/4 | Rear toe push, separated airborne recovery | Do not copy the printed alternating leg labels |
| Run 5–8 | Local bent-leg shapes | Opposite-leg and arm half-cycle is inconsistent; 8 is planted rather than flight: reject as a temporal sequence |
| Sprint 1–8 | Moderate torso lean, forceful rear push, heel folding | Nearly repeated push-off pose, missing coherent contact/down/passing/flight: reject as a temporal sequence |
| Landing/recovery detail | Bent-knee foot contact, high heel behind | Valid local visual targets; not complete gait proof |

Both images preserve recognizable C2 identity and contain useful specific motion poses, but **neither is accepted as a correct complete animation cycle**. The controller and independent verifier were informed before any product modification. Do not silently copy erroneous panels, fake approval, or generate beyond the approved batch.

## Correct phase contract for authoring (text, not a third generated image)

Walk: L heel contact → L load / R toe off → L mid-support / R foot passes low → L heel rise / R foot advances → R heel contact → exact opposite-leg half-cycle. No walking flight. Arms oppose advancing legs. Up/down is small, not pelvis crouch.

Run/sprint: L soft contact → L compression / R passes → L rear push / R advances → flight toward R contact → R contact → opposite-leg sequence. Rear heel folds behind, knee stays anatomically forward, the advancing knee does not lock straight. Torso lean increases for sprint; avoid merely accelerating a repeated walking pose. Preserve explicit left/right identity through source keys and exported clips.

Any later source mapping must point to accepted local regions above and document correction of rejected phases; these generated pages must not be represented as fully accurate phase evidence.
