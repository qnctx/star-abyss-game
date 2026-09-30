"""Hidden, isolated Godot render. Does not focus or control a user's game."""
import ctypes, subprocess, time, sys
from ctypes import wintypes
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'godot/reports/ecology-damage-r4'
OUT.mkdir(parents=True, exist_ok=True)
u = ctypes.windll.user32
u.CreateWindowExW.restype = ctypes.c_void_p
u.CreateWindowExW.argtypes = [ctypes.c_ulong,ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p]
parent = u.CreateWindowExW(0,'STATIC','Ecology R4 isolated capture',0x80000000,0,0,1440,900,None,None,None,None)
if not parent: raise RuntimeError('Hidden capture parent failed')
script = sys.argv[1] if len(sys.argv)>1 else 'native_environment_damage_visual.gd'
if script not in ['native_environment_damage_visual.gd','native_environment_damage_integrated.gd','native_environment_damage_natural_support.gd']:
    raise ValueError('Only owned ecology R4 tests permitted')
try:
    habitat = sys.argv[2] if len(sys.argv)>2 else None
    budget = sys.argv[3] if len(sys.argv)>3 else 'conservative'
    profile = sys.argv[4] if len(sys.argv)>4 else None
    if habitat is not None and habitat not in ['forest','transition','wetland']: raise ValueError('Unknown habitat')
    if budget not in ['conservative','candidate']: raise ValueError('Unknown budget')
    if profile not in [None,'profile','reopen']: raise ValueError('Unknown test mode')
    if profile=='reopen' and script!='native_environment_damage_natural_support.gd': raise ValueError('Reopen is only for the owned natural support test')
    label=script+('-'+habitat if habitat else '')+('-candidate' if budget=='candidate' else '')+('-'+profile if profile else '')
    logpath=OUT/(label+'.log')
    with logpath.open('w',encoding='utf8') as log:
        cmd=[r'D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe','--path',str(ROOT/'godot'),'--wid',str(parent),'--resolution','1440x900','--rendering-driver','opengl3','--audio-driver','Dummy','--disable-vsync','--script','res://tests/'+script,'--','--visual']
        if habitat is not None:
            cmd.append('--habitat='+habitat)
        if budget=='candidate': cmd.append('--budget=candidate')
        if profile: cmd.append('--reopen' if profile=='reopen' else '--profile')
        proc=subprocess.Popen(cmd,cwd=ROOT,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
        msg=wintypes.MSG(); deadline=time.monotonic()+240
        while proc.poll() is None:
            while u.PeekMessageW(ctypes.byref(msg),None,0,0,1): u.TranslateMessage(ctypes.byref(msg)); u.DispatchMessageW(ctypes.byref(msg))
            if time.monotonic()>deadline: proc.kill(); proc.wait(); raise TimeoutError('Ecology capture exceeded 240s')
            time.sleep(.01)
    print(logpath.read_text(encoding='utf8'),end='')
    sys.exit(proc.returncode)
finally:
    u.DestroyWindow.argtypes=[ctypes.c_void_p]
    u.DestroyWindow(parent)
