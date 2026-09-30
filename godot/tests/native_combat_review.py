"""Build normal-speed clips and ordered frame strips from native main-scene QA frames."""
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw


base = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("godot/reports/native-combat-sequence")
review = base / "review"
review.mkdir(exist_ok=True)
manifest = json.loads((base / "manifest.json").read_text(encoding="utf-8"))
for clip in manifest["clips"]:
    name = clip["name"]
    frames = [Image.open(base / name / f"f{i:03d}.jpg").convert("RGB") for i in range(clip["frames"])]
    # The unaltered full-scene frames remain beside the manifest. A centered
    # crop exposes knees, elbows and hands at a useful review scale.
    crops = [frame.crop((475, 185, 815, 555)) for frame in frames]
    crops[0].save(
        review / f"{name}.gif",
        save_all=True,
        append_images=crops[1:],
        # GIF uses 10 ms ticks; 30/30/40 ms repeats average exactly 30 fps.
        duration=[30 if index % 3 < 2 else 40 for index in range(len(crops))],
        loop=0,
        optimize=True,
    )
    indices = list(range(0, len(crops), 2))
    columns = 6
    rows = (len(indices) + columns - 1) // columns
    cell_w, cell_h = crops[0].size
    strip = Image.new("RGB", (cell_w * columns, (cell_h + 24) * rows), (18, 18, 24))
    draw = ImageDraw.Draw(strip)
    for item, index in enumerate(indices):
        x = item % columns * cell_w
        y = item // columns * (cell_h + 24)
        draw.text((x + 6, y + 4), f"frame {index:02d} / {index / 30:.2f}s", fill="white")
        strip.paste(crops[index], (x, y + 24))
    strip.save(review / f"{name}-strip.jpg", quality=91)
    print(name, len(frames), review / f"{name}.gif", review / f"{name}-strip.jpg")
