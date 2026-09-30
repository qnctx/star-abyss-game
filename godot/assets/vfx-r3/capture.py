"""Normal-speed GL Compatibility preview under a never-shown Win32 parent."""
import ctypes
import subprocess
import time
import sys
import datetime
import hashlib
import json
from ctypes import wintypes
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent / 'evidence'
SCRIPT = 'res://assets/vfx-r3/preview.gd'
if '--main' in sys.argv:
    OUT = OUT / 'full-world'
    SCRIPT = 'res://assets/vfx-r3/main_preview.gd'
if '--no-png' in sys.argv:
    OUT = OUT / 'baseline'
TAG = datetime.datetime.now().strftime('capture-%Y%m%d-%H%M%S') if '--main' in sys.argv else ''
if TAG:
    parent_out=OUT
    OUT=OUT/TAG
    parent_out.mkdir(exist_ok=True,parents=True)
    (parent_out/'latest-run.txt').write_text(TAG,encoding='utf-8')
OUT.mkdir(exist_ok=True,parents=True)
(OUT / '.gdignore').touch()
print('R3_CAPTURE_OUT='+str(OUT),flush=True)
inputs=[ROOT/'godot/scripts'/name for name in ['native_vfx_r3.gd','native_motion_r2.gd','native_player.gd','native_main.gd','native_enemy_r3.gd']]
inputs+=list(Path(__file__).resolve().parent.glob('qi-*-r3.glb'))
inputs+=[ROOT/'godot/assets/vfx-r3/qi_ribbon.gdshader',ROOT/'godot/assets/motion-r2/c2-motion-r2.glb']
inputs+=[ROOT/'godot/assets/vfx-r3/main_preview.gd']
def hashes():return {str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs if p.is_file()}
before=hashes()
user32 = ctypes.windll.user32
user32.CreateWindowExW.restype = ctypes.c_void_p
user32.CreateWindowExW.argtypes = [ctypes.c_ulong,ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p]
parent = user32.CreateWindowExW(0,'STATIC','R3 VFX normal-time preview',0x80000000,0,0,1280,720,None,None,None,None)
if not parent:
    raise RuntimeError('Hidden preview parent failed')
try:
    with (OUT/'capture.log').open('w',encoding='utf-8') as log:
        command=[r'D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe','--path',str(ROOT/'godot'),'--wid',str(parent),'--resolution','1280x720','--rendering-driver','opengl3','--audio-driver','Dummy','--script',SCRIPT]
        if TAG:command += ['--','--capture-tag',TAG]
        if '--no-png' in sys.argv:command += ['--no-png']
        if '--tier' in sys.argv:command += ['--tier',sys.argv[sys.argv.index('--tier')+1]]
        proc = subprocess.Popen(command,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
        message = wintypes.MSG()
        start = time.monotonic()
        while proc.poll() is None:
            while user32.PeekMessageW(ctypes.byref(message),None,0,0,1):
                user32.TranslateMessage(ctypes.byref(message))
                user32.DispatchMessageW(ctypes.byref(message))
            if time.monotonic()-start > 110:
                proc.kill()
                raise RuntimeError('Own preview timed out')
            time.sleep(0.01)
    print((OUT/'capture.log').read_text(encoding='utf-8'))
    after=hashes()
    (OUT/'capture-inputs.json').write_text(json.dumps({'stable':before==after,'before':before,'after':after},indent=2),encoding='utf-8')
    if proc.returncode:
        raise SystemExit(proc.returncode)
finally:
    user32.DestroyWindow.argtypes = [ctypes.c_void_p]
    user32.DestroyWindow(parent)
