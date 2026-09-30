"""Render in a never-shown Win32 parent; cannot take focus from user's game."""
import ctypes,subprocess,sys,time,hashlib
from ctypes import wintypes
from pathlib import Path
u=ctypes.windll.user32
u.CreateWindowExW.restype=ctypes.c_void_p
u.CreateWindowExW.argtypes=[ctypes.c_ulong,ctypes.c_wchar_p,ctypes.c_wchar_p,ctypes.c_ulong,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_void_p]
hwnd=u.CreateWindowExW(0,'STATIC','C2 R7 hidden verification',0x80000000,0,0,960,720,None,None,None,None)
if not hwnd:raise RuntimeError('Hidden parent creation failed')
try:
 args=[r'D:\Godot_v4.6.2-stable_win64.exe\Godot_v4.6.2-stable_win64_console.exe','--path','godot','--wid',str(hwnd),'--resolution','960x720','--rendering-driver','opengl3','--audio-driver','Dummy','--disable-vsync','--script',sys.argv[1] if len(sys.argv)>1 else 'res://assets/motion-r2/preview.gd']
 if len(sys.argv)>2:args+=['--']+sys.argv[2:]
 log_path=Path('godot/assets/motion-r2/evidence/gait-r7') / ('capture-'+Path(sys.argv[1]).stem+'-'+hashlib.sha256(' '.join(sys.argv[2:]).encode()).hexdigest()[:8]+'.log')
 log_path.parent.mkdir(parents=True,exist_ok=True)
 log=log_path.open('w',encoding='utf-8')
 p=subprocess.Popen(args,stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
 msg=wintypes.MSG();start=time.monotonic();last_log_check=start
 while p.poll() is None:
  while u.PeekMessageW(ctypes.byref(msg),None,0,0,1):
   u.TranslateMessage(ctypes.byref(msg));u.DispatchMessageW(ctypes.byref(msg))
  if time.monotonic()-last_log_check>.5:
   last_log_check=time.monotonic()
   diagnostic=log_path.read_text(encoding='utf-8',errors='replace')
   if 'SCRIPT ERROR:' in diagnostic:
    p.kill();p.wait();print(diagnostic);raise RuntimeError('Own preview script failed; stopped only its child process')
  if time.monotonic()-start>120:
   p.kill();raise RuntimeError('Own preview timed out')
  time.sleep(.01)
 log.close();print(log_path.read_text(encoding='utf-8'));sys.exit(p.returncode)
finally:
 u.DestroyWindow.argtypes=[ctypes.c_void_p];u.DestroyWindow(hwnd)
