"""Run the isolated main-scene visual regression inside a never-shown Win32 parent.

This preserves focus on the user's running game. Screenshots are written by the
Godot regression script under godot/reports/; no default save is opened.
"""
import ctypes
import hashlib
import json
import subprocess
import sys
import time
from ctypes import wintypes
from datetime import datetime, timezone
from pathlib import Path


user32 = ctypes.windll.user32
user32.CreateWindowExW.restype = ctypes.c_void_p
user32.CreateWindowExW.argtypes = [
    ctypes.c_ulong, ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_ulong,
    ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
    ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
]
parent = user32.CreateWindowExW(
    0, "STATIC", "Hidden native issue verification", 0x80000000,
    0, 0, 1280, 720, None, None, None, None,
)
if not parent:
    raise RuntimeError("Could not create hidden capture parent")

try:
    script = sys.argv[1] if len(sys.argv) > 1 else "res://tests/native_issue_regression.gd"
    if not script.startswith("res://tests/") or not script.endswith(".gd"):
        raise ValueError("Capture accepts only a project test script")
    combat = script == "res://tests/native_combat_sequence.gd"
    log_path = Path("godot/reports/native-combat-capture.log" if combat else "godot/reports/native-issue-capture.log")
    version = None
    if combat:
        version = {
            "started_utc": datetime.now(timezone.utc).isoformat(),
            "sha256": {
                name: hashlib.sha256(Path("godot", name).read_bytes()).hexdigest()
                for name in (
                    "scripts/native_player.gd",
                    "scripts/native_motion_r2.gd",
                    "assets/motion-r2/c2-motion-r2.glb",
                )
            },
        }
        capture_dir = Path("godot/reports/native-combat-sequence")
        if "--guard-physics" in sys.argv[2:]:
            capture_dir /= "after-hit-physics-30hz"
        elif "--guard-only" in sys.argv[2:]:
            capture_dir /= "after-hit-fix"
        capture_dir.mkdir(parents=True, exist_ok=True)
        (capture_dir / "version.json").write_text(json.dumps(version, indent=2), encoding="utf-8")
    command = [
        r"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe",
        "--path", "godot", "--wid", str(parent), "--resolution", "1280x720",
        "--rendering-driver", "opengl3", "--audio-driver", "Dummy",
        "--disable-vsync", "--script", script,
    ]
    if combat and len(sys.argv) > 2:
        command += ["--", *sys.argv[2:]]
    elif not combat:
        command += ["--", "--visual"]
    with log_path.open("w", encoding="utf-8") as log:
        if version is not None:
            log.write("NATIVE_CAPTURE_VERSION=" + json.dumps(version) + "\n")
            log.flush()
        process = subprocess.Popen(
            command, stdout=log, stderr=log,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        message = wintypes.MSG()
        deadline = time.monotonic() + (300.0 if combat else 120.0)
        while process.poll() is None:
            while user32.PeekMessageW(ctypes.byref(message), None, 0, 0, 1):
                user32.TranslateMessage(ctypes.byref(message))
                user32.DispatchMessageW(ctypes.byref(message))
            if time.monotonic() > deadline:
                process.kill()
                log.flush()
                print(log_path.read_text(encoding="utf-8"))
                raise TimeoutError("Hidden Godot capture exceeded its deadline")
            time.sleep(0.01)
    print(log_path.read_text(encoding="utf-8"), end="")
    sys.exit(process.returncode)
finally:
    user32.DestroyWindow.argtypes = [ctypes.c_void_p]
    user32.DestroyWindow(parent)
