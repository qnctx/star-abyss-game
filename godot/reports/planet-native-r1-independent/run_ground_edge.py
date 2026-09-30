import ctypes,pathlib,subprocess,sys,time,hashlib,json
from ctypes import wintypes
here=pathlib.Path(__file__).resolve().parent
root=here.parents[2]
label=sys.argv[1] if len(sys.argv)>1 else 'ground-edge05'
if not label.replace('-','').isalnum():raise ValueError('Simple label required')
out=here/label
out.mkdir(exist_ok=True)
def manifest():
    files=list((root/'godot/scripts').glob('*.gd'))+list((root/'godot/assets/terrain').glob('*'))+list((root/'godot/scenes').glob('*.tscn'))+[root/'godot/assets/motion-r2/c2-motion-r2.glb']
    return {str(f.relative_to(root)):hashlib.sha256(f.read_bytes()).hexdigest() for f in files if f.is_file()}
before=manifest()
(out/'resource-before.json').write_text(json.dumps(before,indent=2),encoding='utf-8')
u=ctypes.windll.user32
u.CreateWindowExW.restype=ctypes.c_void_p
u.CreateWindowExW.argtypes=[ctypes.c_ulong,ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p]
parent=u.CreateWindowExW(0,'STATIC','Gait R4 independent',0x80000000,0,0,960,540,None,None,None,None)
try:
    cmd=[r'D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe','--path',str(root/'godot'),'--wid',str(parent),'--resolution','960x540','--rendering-driver','opengl3','--audio-driver','Dummy','--script','res://reports/planet-native-r1-independent/ground_edge.gd','--','--label='+label]
    if '--lightweight' in sys.argv:cmd.append('--lightweight')
    with (out/'capture.log').open('w',encoding='utf-8') as log:
        proc=subprocess.Popen(cmd,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
        msg=wintypes.MSG()
        start=time.monotonic()
        while proc.poll() is None:
            while u.PeekMessageW(ctypes.byref(msg),None,0,0,1):
                u.TranslateMessage(ctypes.byref(msg));u.DispatchMessageW(ctypes.byref(msg))
            if time.monotonic()-start>240:
                proc.kill();raise RuntimeError('Own gait capture timeout')
            time.sleep(.005)
    print((out/'capture.log').read_text(encoding='utf-8'))
    after=manifest()
    (out/'resource-after.json').write_text(json.dumps(after,indent=2),encoding='utf-8')
    print('RESOURCE_CHANGED', [k for k in before if before[k]!=after.get(k)])
    sys.exit(proc.returncode)
finally:
    u.DestroyWindow.argtypes=[ctypes.c_void_p]
    u.DestroyWindow(parent)
