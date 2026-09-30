import ctypes,pathlib,subprocess,sys,time
from ctypes import wintypes
here=pathlib.Path(__file__).resolve().parent
root=here.parents[1]
label=sys.argv[1] if len(sys.argv)>1 else 'segments01'
if not label.replace('-','').isalnum():raise ValueError('Simple label required')
out=root/'godot'/'reports'/'planet-world-r2'/label
out.mkdir(parents=True,exist_ok=True)
u=ctypes.windll.user32
u.CreateWindowExW.restype=ctypes.c_void_p
u.CreateWindowExW.argtypes=[ctypes.c_ulong,ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p]
parent=u.CreateWindowExW(0,'STATIC','Gait R4 independent',0x80000000,0,0,960,540,None,None,None,None)
try:
    cmd=[r'D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe','--path',str(root/'godot'),'--wid',str(parent),'--resolution','960x540','--rendering-driver','opengl3','--audio-driver','Dummy','--script','res://scripts/native_planet_visual_probe.gd','--','--label='+label]
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
    sys.exit(proc.returncode)
finally:
    u.DestroyWindow.argtypes=[ctypes.c_void_p]
    u.DestroyWindow(parent)
