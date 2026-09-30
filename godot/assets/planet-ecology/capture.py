import ctypes,pathlib,subprocess,time
from ctypes import wintypes
here=pathlib.Path(__file__).resolve().parent
root=here.parents[2]
out=here/'evidence';out.mkdir(exist_ok=True)
u=ctypes.windll.user32
u.CreateWindowExW.restype=ctypes.c_void_p
u.CreateWindowExW.argtypes=[ctypes.c_ulong,ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p]
parent=u.CreateWindowExW(0,'STATIC','Ecology isolated capture',0x80000000,0,0,960,540,None,None,None,None)
try:
 cmd=[r'D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe','--path',str(root/'godot'),'--wid',str(parent),'--resolution','960x540','--rendering-driver','opengl3','--audio-driver','Dummy','--script','res://assets/planet-ecology/verify.gd']
 with (out/'capture.log').open('w',encoding='utf-8') as log:
  proc=subprocess.Popen(cmd,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
  msg=wintypes.MSG();start=time.monotonic()
  while proc.poll() is None:
   while u.PeekMessageW(ctypes.byref(msg),None,0,0,1):u.TranslateMessage(ctypes.byref(msg));u.DispatchMessageW(ctypes.byref(msg))
   if time.monotonic()-start>100:proc.kill();raise RuntimeError('Capture timeout')
   time.sleep(.005)
 print((out/'capture.log').read_text(encoding='utf-8'))
finally:
 u.DestroyWindow.argtypes=[ctypes.c_void_p];u.DestroyWindow(parent)
