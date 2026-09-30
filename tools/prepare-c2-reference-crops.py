"""Losslessly extract the six supplied C2 views; run only with user consent."""
import argparse, hashlib, json
from pathlib import Path
from PIL import Image

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('output', type=Path)
args = parser.parse_args()
source = Image.open(args.source)
if source.size != (1774, 887):
    raise ValueError(f'Unexpected reference dimensions: {source.size}')
views = {
    'front': (30, 65, 315, 800),
    'front-quarter': (350, 65, 611, 800),
    'left': (645, 65, 870, 800),
    'back': (887, 65, 1180, 800),
    'right': (1185, 65, 1430, 800),
    'rear-quarter': (1475, 65, 1735, 800),
}
args.output.mkdir(parents=True, exist_ok=True)
record = {'source': str(args.source.resolve()),
          'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
          'operation': 'lossless crop only; no generation, rescaling or recoloring',
          'views': []}
for name, box in views.items():
    target = args.output / f'{name}.png'
    crop = source.crop(box)
    crop.save(target)
    saved = Image.open(target)
    if saved.tobytes() != crop.tobytes():
        raise RuntimeError(f'Pixel verification failed: {name}')
    record['views'].append({'name': name, 'path': target.name, 'box': box,
                            'size': crop.size, 'pixelsVerified': True,
                            'sha256': hashlib.sha256(target.read_bytes()).hexdigest()})
(args.output / 'reference-provenance.json').write_text(
    json.dumps(record, indent=2), encoding='utf-8')
print(json.dumps({'status': 'prepared', 'views': len(views), 'pixelsVerified': True}))
