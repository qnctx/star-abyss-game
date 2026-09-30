"""Run the real Godot generation guard in two headless processes.

This runner never edits production code or an existing user save. It preserves
all unique fixture files and logs. A passing exit confirms version protection,
not physical destruction or visual quality.

Example (only after the shared project parses):
  python godot/tests/run_environment_generation_guard.py --godot C:/tools/Godot.exe
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone
import uuid


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else "MISSING"


def load_report(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Report is not an object: {path}")
    return value


def run_phase(args: argparse.Namespace, project: Path, output: Path,
              slot: str, phase: str, seed_report: Path) -> dict:
    report = output / f"{phase}.json"
    log = output / f"{phase}.log"
    command = [
        str(args.godot), "--headless", "--path", str(project),
        "--script", "res://tests/native_environment_generation_guard.gd", "--",
        f"--guard-mode={phase}", f"--guard-slot={slot}",
        f"--guard-report={report}", f"--guard-manifest={seed_report}",
        f"--guard-expected-generation={args.expected_generation}",
        f"--guard-old-generation={args.old_generation}",
        f"--guard-warning={args.warning}",
    ]
    result = {"command": command, "report": str(report), "log": str(log)}
    with log.open("w", encoding="utf-8") as stream:
        try:
            completed = subprocess.run(
                command, cwd=project, stdout=stream, stderr=subprocess.STDOUT,
                timeout=args.timeout, check=False,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            result["returncode"] = completed.returncode
            result["timed_out"] = False
        except subprocess.TimeoutExpired:
            # subprocess.run kills and waits for its own child on timeout.
            result["returncode"] = None
            result["timed_out"] = True
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--godot", type=Path, required=True)
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, help="Parent directory for a unique report run")
    parser.add_argument("--expected-generation", default="ecology-r4.2")
    parser.add_argument("--old-generation", default="ecology-r4.1")
    parser.add_argument("--warning", default="环境未恢复", help="Required persistent visible HUD phrase")
    parser.add_argument("--timeout", type=float, default=300.0, help="Seconds per child process")
    args = parser.parse_args()
    args.godot = args.godot.resolve()
    project = args.project.resolve()
    if not args.godot.is_file() or not (project / "project.godot").is_file():
        parser.error("--godot must name an executable file and --project a Godot project")
    if args.expected_generation == args.old_generation:
        parser.error("old and expected generations must differ")
    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ_") + uuid.uuid4().hex[:12]
    output = (args.output or project / "reports" / "environment-generation-guard").resolve() / run_id
    output.mkdir(parents=True, exist_ok=False)
    slot_leaf = f"martial_r4_verify_generation_{run_id}.json"
    slot = "user://" + slot_leaf
    combined = {"run_id": run_id, "slot": slot, "project": str(project),
                "output": str(output), "failed": [], "post_exit_hashes": {},
                "scope": "Generation protection only; no tree destruction or visual acceptance."}
    failed = combined["failed"]
    tracked: dict[str, Path] = {}
    before: dict[str, str] = {}
    try:
        seed_path = output / "seed.json"
        seed_process = run_phase(args, project, output, slot, "seed", seed_path)
        combined["seed_process"] = seed_process
        if seed_process["returncode"] != 0 or seed_process["timed_out"]:
            raise RuntimeError("Seed process failed; see seed.log")
        seed = load_report(seed_path)
        combined["seed"] = seed
        if seed.get("failed"):
            raise RuntimeError("Seed report contains failed checks")
        entries = seed.get("files", {})
        required = {"main", "backup", "mirror", "mirror_backup", "valid_current_source"}
        if set(entries) != required:
            raise RuntimeError("Seed did not create the complete protected fixture set")
        for label, entry in entries.items():
            path = Path(entry["path"]).resolve()
            if not path.name.startswith(slot_leaf):
                raise RuntimeError(f"Fixture escaped its unique file prefix: {path}")
            tracked[label] = path
            before[label] = sha256(path)
            if before[label] == "MISSING" or before[label] != entry["sha256"]:
                raise RuntimeError(f"Seed exit changed fixture bytes: {label}")
        if len({path.parent for path in tracked.values()}) != 1:
            raise RuntimeError("Fixture files are not in one explicit user-data directory")
        combined["before_probe_hashes"] = before.copy()
        # No writes to the fixtures occur in Python. The real Main child owns
        # all auto-save, F5, explicit-save and window-close attempts.
        probe_process = run_phase(args, project, output, slot, "probe", seed_path)
        combined["probe_process"] = probe_process
        if probe_process["returncode"] != 0 or probe_process["timed_out"]:
            failed.append("Probe did not finish via a successful Main close")
        probe_path = output / "probe.json"
        if not probe_path.is_file():
            failed.append("Probe report is missing")
        else:
            probe = load_report(probe_path)
            combined["probe"] = probe
            failed.extend(probe.get("failed", []))
            if probe.get("pid") == seed.get("pid"):
                failed.append("Seed and probe were not distinct processes")
            if not probe.get("close_requested") or not probe.get("close_handler_returned"):
                failed.append("Production Main close notification was not completed")
            stages = {sample.get("stage") for sample in probe.get("samples", [])}
            if not {"after_ready", "after_real_auto_save", "after_explicit_save", "after_real_f5"} <= stages:
                failed.append("Probe skipped a required persistence/visibility stage")
    except (OSError, ValueError, KeyError, RuntimeError) as error:
        failed.append(str(error))
    finally:
        # This runs only after subprocess.run has waited for child exit (also
        # after its timeout kill). It detects close-time writes missed by a
        # before-close assertion inside the engine.
        for label, path in tracked.items():
            try:
                after = sha256(path)
            except OSError as error:
                after = "UNREADABLE: " + str(error)
            combined["post_exit_hashes"][label] = {"path": str(path), "before": before.get(label), "after": after}
            if after != before.get(label):
                failed.append(f"Original {label} bytes changed after child exit")
        combined["passed"] = not failed
        final_path = output / "result.json"
        final_path.write_text(json.dumps(combined, ensure_ascii=False, indent=2), encoding="utf-8")
        print(("PASS" if combined["passed"] else "FAIL") + ": " + str(final_path))
    return 0 if combined["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
