"""Independent complete-main baseline; never shown Win32 parent, isolated save.

Run from any directory: py -3 <this file> [--snapshot-only] [--smoke]
Every invocation creates a new report directory. No acceptance verdict is inferred.
"""
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
REPORT = ROOT / 'godot/reports/terrain-r3-independent'
RUN = REPORT / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
GODOT = r'D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe'

def manifest():
    paths = [ROOT / 'godot/project.godot']
    for folder in ('godot/scripts', 'godot/scenes', 'godot/assets', 'docs/art/planet-review-r3'):
        paths.extend(p for p in (ROOT / folder).rglob('*') if p.is_file())
    return {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(paths) if p.suffix not in ('.uid', '.import', '.pyc')}

def write(name, value):
    (RUN / name).write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')

def main():
    RUN.mkdir(parents=True, exist_ok=False)
    before = manifest()
    write('sha-before.json', before)
    (RUN / 'git-status.txt').write_bytes(subprocess.check_output(['git', 'status', '--short'], cwd=ROOT))
    write('run.json', {'utc': datetime.now(timezone.utc).isoformat(), 'root': str(ROOT),
          'argv': sys.argv, 'phase': 'frozen verification' if '--frozen' in sys.argv else 'pre-freeze diagnostic',
          'production_files': len(before)})
    write('test-sha.json', {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
          for p in (ROOT / 'godot/tests').glob('*terrain_r3_independent*') if p.is_file()})
    print(RUN, flush=True)
    if '--snapshot-only' in sys.argv:
        return 0
    user32 = ctypes.windll.user32
    user32.CreateWindowExW.restype = ctypes.c_void_p
    user32.CreateWindowExW.argtypes = [ctypes.c_ulong, ctypes.c_wchar_p, ctypes.c_wchar_p,
        ctypes.c_ulong, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
        ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p]
    user32.GetForegroundWindow.restype = ctypes.c_void_p
    foreground = user32.GetForegroundWindow()
    parent = user32.CreateWindowExW(0, 'STATIC', 'Terrain R3 independent hidden capture',
                                  0x80000000, 0, 0, 1280, 720, None, None, None, None)
    if not parent:
        raise RuntimeError('Hidden parent creation failed')
    env = os.environ.copy()
    env['TERRAIN_R3_OUTPUT'] = str(RUN)
    env['TERRAIN_R3_SMOKE'] = '1' if '--smoke' in sys.argv else '0'
    selected = next((key for key in ('seams','compat','flight','edge','vehicle','ui','perf','descent') if '--'+key in sys.argv), 'main')
    command = [GODOT, '--path', str(ROOT / 'godot'), '--wid', str(parent),
               '--resolution', '1280x720', '--rendering-driver', 'opengl3',
               '--audio-driver', 'Dummy', '--disable-vsync', '--script',
               'res://tests/terrain_r3_independent_' + selected + '.gd']
    code = -1
    try:
        with (RUN / 'godot.log').open('w', encoding='utf-8') as log:
            process = subprocess.Popen(command, cwd=ROOT, env=env, stdout=log, stderr=log,
                                       creationflags=subprocess.CREATE_NO_WINDOW)
            message = wintypes.MSG()
            deadline = time.monotonic() + (900 if selected == 'flight' else 600)
            while process.poll() is None:
                while user32.PeekMessageW(ctypes.byref(message), None, 0, 0, 1):
                    user32.TranslateMessage(ctypes.byref(message))
                    user32.DispatchMessageW(ctypes.byref(message))
                if time.monotonic() > deadline:
                    process.kill()
                    process.wait()
                    raise TimeoutError('Capture exceeded bounded deadline')
                time.sleep(0.01)
            code = process.returncode
    finally:
        after = manifest()
        write('sha-after.json', after)
        changed = [p for p in sorted(before.keys() | after.keys()) if before.get(p) != after.get(p)]
        write('integrity.json', {'exit_code': code, 'production_changed_during_run': changed,
              'foreground_before': foreground, 'foreground_after': user32.GetForegroundWindow(),
              'final_acceptance': False, 'reason': ('Frozen execution; acceptance requires report/visual review' if '--frozen' in sys.argv else 'Await explicit integration freeze and visual review')})
        user32.DestroyWindow.argtypes = [ctypes.c_void_p]
        user32.DestroyWindow(parent)
    print((RUN / 'godot.log').read_text(encoding='utf-8'), end='')
    return code

if __name__ == '__main__':
    raise SystemExit(main())
