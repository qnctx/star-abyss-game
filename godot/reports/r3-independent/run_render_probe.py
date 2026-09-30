"""Own hidden rendered process; no interaction with the user's game window."""
import ctypes, pathlib, subprocess, sys, time
from ctypes import wintypes
HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
script_name = sys.argv[1] if len(sys.argv)>1 else 'normal_time_probe.gd'
if script_name not in ['normal_time_probe.gd','combat_live_probe.gd','melee_targeted_probe.gd','visual_final_probe.gd','small_ui_probe.gd','cleave_final_probe.gd','descent_diagnostic.gd','hit_miss_final_probe.gd']:
    raise ValueError('Unknown independent probe')
# Preserve each attempt instead of silently replacing failed-run evidence.
for name in (['normal-time-samples.json','normal-time-summary.json','render-probe.log'] if script_name=='normal_time_probe.gd' else ['visual-final.json','render-probe.log'] if script_name=='visual_final_probe.gd' else ['melee-targeted.json','render-probe.log'] if script_name=='melee_targeted_probe.gd' else ['combat-live.json','render-probe.log'] if script_name=='combat_live_probe.gd' else ['render-probe.log']):
    old = HERE/name
    if old.exists():
        old.rename(HERE/(str(time.time_ns())+'-'+name))
user32 = ctypes.windll.user32
user32.CreateWindowExW.restype = ctypes.c_void_p
user32.CreateWindowExW.argtypes = [ctypes.c_ulong,ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p]
width,height=(960,540) if script_name=='small_ui_probe.gd' else (1280,720)
parent = user32.CreateWindowExW(0,'STATIC','R3 independent hidden probe',0x80000000,0,0,width,height,None,None,None,None)
if not parent: raise RuntimeError('Cannot create hidden verification parent')
try:
    cmd = [r'D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe','--path',str(ROOT/'godot'),'--wid',str(parent),'--resolution',f'{width}x{height}','--rendering-driver','opengl3','--audio-driver','Dummy','--script','res://reports/r3-independent/'+script_name]
    if '--distance-2.3' in sys.argv:cmd += ['--','--distance-2.3']
    if '--distance-2.6' in sys.argv:cmd += ['--','--distance-2.6']
    with (HERE/'render-probe.log').open('w',encoding='utf-8') as log:
        proc = subprocess.Popen(cmd,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
        msg = wintypes.MSG()
        started = time.monotonic()
        while proc.poll() is None:
            while user32.PeekMessageW(ctypes.byref(msg),None,0,0,1):
                user32.TranslateMessage(ctypes.byref(msg))
                user32.DispatchMessageW(ctypes.byref(msg))
            if time.monotonic()-started>60:
                proc.kill()
                raise RuntimeError('Own probe timed out')
            time.sleep(.01)
    print((HERE/'render-probe.log').read_text(encoding='utf-8'))
    if proc.returncode==0 and script_name=='melee_targeted_probe.gd':
        case='2.6' if '--distance-2.6' in sys.argv else '2.3' if '--distance-2.3' in sys.argv else '2.0'
        (HERE/('melee-final-'+case+'.json')).write_bytes((HERE/'melee-targeted.json').read_bytes())
    sys.exit(proc.returncode)
finally:
    user32.DestroyWindow.argtypes = [ctypes.c_void_p]
    user32.DestroyWindow(parent)
