"""CPU-only archive and inspect the first support-r43 producer failure."""
from __future__ import annotations

import hashlib
import json
from collections import Counter
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports" / "martial-support-r43"
ARCHIVE = REPORTS / "first-failed"


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    ARCHIVE.mkdir(exist_ok=True)
    manifest = {}
    for source in sorted(REPORTS.iterdir()):
        if not source.is_file():
            continue
        target = ARCHIVE / source.name
        if target.exists():
            if digest(target) != digest(source):
                raise RuntimeError(f"Refusing to replace archived first failure: {target}")
        else:
            shutil.copy2(source, target)
        manifest[source.name] = {"sha256": digest(target), "bytes": target.stat().st_size}
    manifest_path = ARCHIVE / "archive-manifest.json"
    if not manifest_path.exists():
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    source_manifest = {}
    for relative in (
        "tests/native_martial_support_persistence_runtime.gd",
        "tests/native_martial_support_persistence_reload.gd",
        "docs/martial-support-r43-scope.json",
    ):
        source = ROOT / relative
        target = ARCHIVE / source.name
        if not target.exists():
            shutil.copy2(source, target)
        source_manifest[relative] = {"sha256": digest(target), "bytes": target.stat().st_size}
    source_manifest_path = ARCHIVE / "source-archive-manifest.json"
    if not source_manifest_path.exists():
        source_manifest_path.write_text(json.dumps(source_manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    report = json.loads((ARCHIVE / "environment-runtime.json").read_text(encoding="utf-8"))
    handoff = json.loads((ARCHIVE / "cross-process-fixture.json").read_text(encoding="utf-8"))
    summary = {"report_keys": list(report), "failed": report.get("failed"), "handoff_complete": handoff.get("complete"), "parts": {}}
    fixtures = report.get("support_fixtures", handoff.get("support_fixtures", {}))
    for entity_id, fixture in fixtures.items():
        for phase in ("original_standing", "before_crater", "settled_after_crater"):
            snapshot = fixture.get(phase, {})
            for part_name, part in snapshot.get("parts", {}).items():
                probes = part.get("terrain_probes", [])
                ready = [p for p in probes if p.get("ready")]
                negatives = [p for p in ready if p["clearance"] < -0.2]
                first_hit = part.get("first_entity_hit", {})
                attempts = first_hit.get("attempts", [first_hit.get("attempt", {})])
                summary["parts"][f"{entity_id}/{phase}/{part_name}"] = {
                    "body_class": part.get("body_class"), "body_world_pose": part.get("body_world_pose"),
                    "mesh_world_pose": part.get("mesh_world_pose"), "shapes": part.get("shapes"),
                    "vertex_count": part.get("unique_vertex_count"), "missing_support_samples": part.get("missing_support_samples"),
                    "lowest_contact": part.get("lowest_contact"), "closest_ray_surface_contact": part.get("closest_ray_surface_contact"),
                    "lowest_clearance": part.get("lowest_clearance"), "highest_clearance": part.get("highest_clearance"),
                    "penetrating_vertex_count": len(negatives), "first_entity_hit": first_hit,
                    "first_hit_colliders": dict(Counter(p.get("collider", "none") for p in attempts)),
                }
    target = ARCHIVE / "cpu-failure-audit.json"
    target.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"archive": str(ARCHIVE), "archived_files": len(manifest), "failed": summary["failed"], "handoff_complete": summary["handoff_complete"]}, ensure_ascii=False))
    for key, part in summary["parts"].items():
        if key.endswith("/stump") or key.endswith("/chunk_4"):
            print(json.dumps({"part": key, "body_class": part["body_class"], "vertices": part["vertex_count"], "lowest": part["lowest_clearance"], "highest": part["highest_clearance"], "penetrating_vertices": part["penetrating_vertex_count"], "lowest_contact": part["lowest_contact"], "first_hit": part["first_entity_hit"].get("hit"), "occluders": part["first_hit_colliders"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
