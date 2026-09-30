import importlib.util
for name in ['PIL','imageio','imageio_ffmpeg','cv2']:
    print(name, bool(importlib.util.find_spec(name)))
try:
    import imageio_ffmpeg
    print('ffmpeg',imageio_ffmpeg.get_ffmpeg_exe())
except ImportError:pass
