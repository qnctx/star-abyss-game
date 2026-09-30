"""Independent hidden Godot window. Never attaches to a user's running game."""
import argparse, ctypes, hashlib, json, pathlib, subprocess, sys, time
from ctypes import wintypes
ROOT=pathlib.Path(__file__).resolve().parents[2]
OUT=ROOT/'godot/reports/martial-r4'
OUT.mkdir(parents=True,exist_ok=True)
parser=argparse.ArgumentParser()
parser.add_argument('--script',default='res://tests/native_martial_r4_verify.gd')
parser.add_argument('--tag',default='basic')
parser.add_argument('--width',type=int,default=1152)
parser.add_argument('--height',type=int,default=720)
parser.add_argument('--timeout',type=float,default=300)
parser.add_argument('--test-arg',action='append',default=[])
parser.add_argument('--no-capture',action='store_true')
options=parser.parse_args()
FILES=['native_main.gd','native_player.gd','native_motion_r2.gd','native_martial_skills.gd','native_martial_library.gd','native_vfx_martial.gd','native_ascension.gd','native_surface_blink.gd','native_enemy_r3.gd','native_world.gd','native_planet.gd','native_planet_field.gd','native_planet_ecology.gd','native_environment_damage.gd','native_environment_damage_assets.gd','native_surface_deformation.gd']
def hashes():
    paths=['scripts/'+name for name in FILES]+['assets/martial-r4/'+name for name in ['c2-martial-r4.glb','charge.glb','martial_qi.gdshader','pressure.glb','impact.glb']]
    paths += [str(path.relative_to(ROOT/'godot')).replace('\\','/') for path in sorted((ROOT/'godot/assets/planet-ecology-r4').iterdir()) if path.suffix in ('.res','.json')]
    return {name:hashlib.sha256((ROOT/'godot'/name).read_bytes()).hexdigest() for name in paths}
before=hashes()
user=ctypes.windll.user32
user.CreateWindowExW.restype=ctypes.c_void_p
user.CreateWindowExW.argtypes=[ctypes.c_ulong,ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p]
parent=user.CreateWindowExW(0,'STATIC','Martial R4 independent verification',0x80000000,0,0,options.width,options.height,None,None,None,None)
try:
    args=[r'D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe','--path',str(ROOT/'godot'),'--wid',str(parent),'--resolution',f'{options.width}x{options.height}','--rendering-driver','opengl3','--audio-driver','Dummy','--script',options.script,'--'] + ([] if options.no_capture else ['--capture']) + options.test_arg
    log_path=OUT/(options.tag+'-capture.log')
    with log_path.open('w',encoding='utf8') as log:
        process=subprocess.Popen(args,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
        msg=wintypes.MSG();started=time.monotonic()
        while process.poll() is None:
            while user.PeekMessageW(ctypes.byref(msg),None,0,0,1):
                user.TranslateMessage(ctypes.byref(msg));user.DispatchMessageW(ctypes.byref(msg))
            if time.monotonic()-started>options.timeout:
                process.kill();process.wait();raise RuntimeError('Only our independent capture timed out')
            time.sleep(.005)
    after=hashes()
    changed=[name for name in before if before[name]!=after[name]]
    (OUT/(options.tag+'-dependency-hashes.json')).write_text(json.dumps({'before':before,'after':after,'changed':changed,'normal_engine_physics':True,'viewport':f'{options.width}x{options.height}','window':'hidden independent process'},indent=2))
    for line in log_path.read_text(encoding='utf8').splitlines():
        if any(key in line for key in ['PASS:','FAIL:','SCRIPT ERROR',' at:','RESULT']): print(line)
    if changed: print('DEPENDENCIES_CHANGED',changed)
    sys.exit(process.returncode or (2 if changed else 0))
finally:
    user.DestroyWindow.argtypes=[ctypes.c_void_p]
    user.DestroyWindow(parent)
