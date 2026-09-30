"""Render the real main scene under a never-shown Win32 parent window."""
import ctypes
import subprocess
import sys
import time
from ctypes import wintypes
from pathlib import Path

user32 = ctypes.windll.user32
user32.CreateWindowExW.restype = ctypes.c_void_p
user32.CreateWindowExW.argtypes = [
    ctypes.c_ulong, ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_ulong,
    ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
    ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
]
parent = user32.CreateWindowExW(
    0, "STATIC", "Native R2 hidden verification", 0x80000000,
    0, 0, 1280, 720, None, None, None, None,
)
if not parent:
    raise RuntimeError("Hidden parent creation failed")

log_path = Path("godot/reports/r2-main/capture.log")
log_path.parent.mkdir(parents=True, exist_ok=True)
try:
    command = [
        r"D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe",
        "--path", "godot", "--wid", str(parent), "--resolution", "1280x720",
        "--rendering-driver", "opengl3", "--audio-driver", "Dummy",
        "--disable-vsync", "--script", "res://tests/native_r2_main_visual.gd",
    ]
    with log_path.open("w", encoding="utf-8") as log:
        process = subprocess.Popen(
            command, stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW,
        )
        message = wintypes.MSG()
        started = time.monotonic()
        while process.poll() is None:
            while user32.PeekMessageW(ctypes.byref(message), None, 0, 0, 1):
                user32.TranslateMessage(ctypes.byref(message))
                user32.DispatchMessageW(ctypes.byref(message))
            if time.monotonic() - started > 120:
                process.kill()
                raise RuntimeError("Own hidden preview timed out")
            time.sleep(0.01)
    print(log_path.read_text(encoding="utf-8"))
    sys.exit(process.returncode)
finally:
    user32.DestroyWindow.argtypes = [ctypes.c_void_p]
    user32.DestroyWindow(parent)
