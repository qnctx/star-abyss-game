"""Render enemy art in Godot/OpenGL under a never-shown Win32 parent."""
import ctypes
import subprocess
import time
from ctypes import wintypes
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
user32 = ctypes.windll.user32
user32.CreateWindowExW.restype = ctypes.c_void_p
user32.CreateWindowExW.argtypes = [ctypes.c_ulong, ctypes.c_wchar_p, ctypes.c_wchar_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p]
parent = user32.CreateWindowExW(0, 'STATIC', 'Enemy R3 visual verification', 0x80000000, 0, 0, 1280, 720, None, None, None, None)
assert parent
try:
    log_path = ROOT / 'godot/reports/enemy-r3/capture.log'
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open('w', encoding='utf-8') as log:
        proc = subprocess.Popen([r'D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe', '--path', str(ROOT / 'godot'), '--wid', str(parent), '--resolution', '1280x720', '--rendering-driver', 'opengl3', '--audio-driver', 'Dummy', '--disable-vsync', '--script', 'res://tests/native_enemy_r3_visual.gd'], stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW)
        msg = wintypes.MSG()
        started = time.monotonic()
        while proc.poll() is None:
            while user32.PeekMessageW(ctypes.byref(msg), None, 0, 0, 1):
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))
            if time.monotonic() - started > 180:
                proc.kill()
                raise RuntimeError('Own hidden Godot visual capture exceeded 180 seconds')
            time.sleep(.01)
    print(log_path.read_text(encoding='utf-8'))
    raise SystemExit(proc.returncode)
finally:
    user32.DestroyWindow.argtypes = [ctypes.c_void_p]
    user32.DestroyWindow(parent)
