"""Make temporal QA strips from the existing 30 fps motion preview GIF.

This is a preview review aid only; final acceptance uses the native main scene.
"""
from pathlib import Path
from PIL import Image, ImageDraw


source = Path("godot/assets/motion-r2/evidence/native-motion-orbit.gif")
output = Path("godot/reports/combat-timeline-preview")
output.mkdir(parents=True, exist_ok=True)
im = Image.open(source)
print(f"frames={im.n_frames} size={im.size} duration_ms={im.info.get('duration')}")
clips = {"jab": 75, "cross": 90, "kick": 105, "guard": 120, "hit": 135, "cast": 150}
for name, first in clips.items():
    sample_indices = list(range(first, first + 15))
    frames = []
    for index in sample_indices:
        im.seek(index)
        frames.append(im.convert("RGB"))
    width, height = frames[0].size
    sheet = Image.new("RGB", (width * 5, (height + 24) * 3), (20, 20, 26))
    draw = ImageDraw.Draw(sheet)
    for j, frame in enumerate(frames):
        x = (j % 5) * width
        y = (j // 5) * (height + 24)
        sheet.paste(frame, (x, y + 24))
        draw.text((x + 4, y + 4), f"{name} {j * 0.06:.2f}s f{sample_indices[j]}", fill="white")
    path = output / f"{name}-strip.jpg"
    sheet.save(path, quality=88)
    print(path)
